import { Router } from "express";
import { getAvailableMods, getModArchiveInfo, getValidVersionNames } from "../lib/pluginLoader";
import { createDownloadId, signDownloadToken } from "../lib/downloadTokens";
import { UserDB } from "../models/User";
import { syncUserAccess } from "../services/syncService";
import { sendDownloadWebhook } from "../lib/webhooks";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from "stream";
import type { Archiver } from "archiver";
import { z } from "zod";
const archiver = require("archiver");

const router = Router();
const activeStageSessions = new Map<string, { userId: string; expiresAt: number }>();

function createLicenseKey(): string {
    return `OB1-LICENSE-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

const licenseStubSchema = z.object({ modId: z.string().min(1).max(128), type: z.string().optional() });
const stageSessionSchema = z.object({ mod_id: z.string().min(1).max(128), license_key: z.string().min(16).max(256), hwid: z.string().length(64) });

function resourceName(modId: string): string {
    const safe = modId.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    return `ob1_${safe || "mod"}`;
}

function resourceServerScript(id: string, version: string): string {
    return `const crypto = require('crypto');
const resourceId = '${id}';
const version = '${version.replace(/'/g, "\\'")}';
const apiUrl = (GetConvar('ob1_api_url', 'https://api.ob1.store') || '').replace(/\\/+$/, '');
const secret = GetConvar('ob1_hmac_secret', '');
const licenseKey = GetConvar('ob1_license_key', '');

function canonicalize(value) {
    if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonicalize(item)).join(',') + '}';
    return JSON.stringify(value);
}

function request(body) {
    return new Promise(resolve => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const nonce = crypto.randomBytes(16).toString('hex');
        const requestBody = JSON.stringify({ ...body, resourceId, licenseKey, nonce });
        const signature = crypto.createHmac('sha256', secret).update(timestamp + '\\n' + requestBody).digest('hex');
        PerformHttpRequest(apiUrl + '/api/v1/mods/stream-payload', (status, responseBody) => {
            let parsed = null;
            try { parsed = responseBody ? JSON.parse(responseBody) : null; } catch (_) {}
            resolve({ status, body: parsed });
        }, 'POST', requestBody, { ['Content-Type']: 'application/json', ['X-OB1-Timestamp']: timestamp, ['X-OB1-Signature']: signature });
    });
}

function heartbeat() {
    if (!secret) return console.error('[OB1] ob1_hmac_secret is not configured');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ resourceId, version, serverId: GetConvar('sv_hostname', 'fivem') });
    const signature = crypto.createHmac('sha256', secret).update(timestamp + '\\n' + body).digest('hex');
    PerformHttpRequest(apiUrl + '/api/fivem/resource-heartbeat', (status) => {
        if (status < 200 || status >= 300) console.error('[OB1] resource authorization rejected: ' + status);
    }, 'POST', body, { ['Content-Type']: 'application/json', ['X-OB1-Timestamp']: timestamp, ['X-OB1-Signature']: signature });
}

heartbeat();
setInterval(heartbeat, 60000);

function decryptPayload(payload) {
    if (!payload || payload.resourceId !== resourceId || payload.modId !== '${id}') return null;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAAD(Buffer.from(resourceId + ':' + '${id}'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function loadPayload(target) {
    const result = await request({ modId: '${id}' });
    if (result.status < 200 || result.status >= 300 || !result.body?.payload || !result.body?.signature) return emitNet('ob1:loader:stop', target, 'authorization_failed');
    const expected = crypto.createHmac('sha256', secret).update(canonicalize(result.body.payload)).digest('hex');
    const received = Buffer.from(result.body.signature, 'hex');
    if (received.length !== expected.length / 2 || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), received)) return emitNet('ob1:loader:stop', target, 'invalid_signature');
    const sourceCode = decryptPayload(result.body.payload);
    if (!sourceCode) return emitNet('ob1:loader:stop', target, 'decrypt_failed');
    emitNet('ob1:loader:payload', target || -1, sourceCode);
}

on('onServerResourceStart', resourceName => { if (resourceName === GetCurrentResourceName()) loadPayload(); });
onNet('ob1:loader:request', () => loadPayload(String(global.source)));
`;
}

function resourceClientLoader(): string {
    return `local running = false
local resourceName = GetCurrentResourceName()

local function stopLoader(reason)
    running = false
    TriggerEvent('ob1:loader:stopped', reason or 'authorization_failed')
end

local function executePayload(sourceCode)
    if type(sourceCode) ~= 'string' or #sourceCode == 0 or #sourceCode > 1024 * 1024 then return stopLoader('invalid_payload') end
    local environment = {
        AddEventHandler = AddEventHandler,
        RegisterNetEvent = RegisterNetEvent,
        TriggerEvent = TriggerEvent,
        TriggerServerEvent = TriggerServerEvent,
        GetGameTimer = GetGameTimer,
        Citizen = Citizen,
        Wait = Wait,
        resourceName = resourceName
    }
    local chunk, compileError = load(sourceCode, '@' .. resourceName .. '/memory', 't', environment)
    if not chunk then return stopLoader('payload_compile_failed:' .. tostring(compileError)) end
    local ok, runtimeError = pcall(chunk)
    if not ok then return stopLoader('payload_runtime_failed:' .. tostring(runtimeError)) end
    running = true
end

RegisterNetEvent('ob1:loader:payload')
AddEventHandler('ob1:loader:payload', executePayload)
RegisterNetEvent('ob1:loader:stop')
AddEventHandler('ob1:loader:stop', function(reason) stopLoader(reason) end)

CreateThread(function()
    while true do
        Wait(60000)
        if running then TriggerServerEvent('ob1:loader:request') end
    end
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource == resourceName then TriggerServerEvent('ob1:loader:request') end
end)
`;
}

router.post("/:id/license-stub", async (req, res) => {
    const parsed = licenseStubSchema.safeParse({ modId: req.params.id, type: req.query.type });
    if (!parsed.success) return res.status(400).json({ error: "Invalid mod" });

    const archiveInfo = await getModArchiveInfo(parsed.data.modId, parsed.data.type);
    if (!archiveInfo) return res.status(404).json({ error: "Mod not found" });
    // Use the same short-lived entitlement cache as the mods listing route so
    // a forced Discord refresh cannot disagree with the mod the user just saw.
    const user = await syncUserAccess(req.user!.id) || await UserDB.findById(req.user!.id);
    const versions = Array.isArray(user?.versions) ? user.versions : [];
    const availableVersions = Array.isArray(archiveInfo.version) ? archiveInfo.version : [archiveInfo.version];
    const modSupportsAllVersions = availableVersions.some(version => normalizeVersionName(version) === normalizeVersionName("All Versions"));
    const licensedVersion = modSupportsAllVersions && versions.length > 0
        ? "All Versions"
        : availableVersions.find(version => versions.some(current => normalizeVersionName(current) === normalizeVersionName("All Versions") || normalizeVersionName(current) === normalizeVersionName(version)));
    if (!user || !licensedVersion) {
        console.warn("[License Stub] Access denied", {
            userId: req.user!.id,
            modId: parsed.data.modId,
            type: archiveInfo.type,
            availableVersions,
            entitledVersions: versions
        });
        return res.status(403).json({ error: "You do not have access to this version." });
    }

    const licenseKey = createLicenseKey();
    const modLicenses = Array.isArray(user?.modLicenses) ? user.modLicenses : [];
    modLicenses.push({ modId: parsed.data.modId, licenseKey, type: archiveInfo.type, version: String(licensedVersion), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    await UserDB.update(req.user!.id, { modLicenses, updatedAt: new Date() });
    res.status(201).json({ mod_id: parsed.data.modId, license_key: licenseKey, version: String(licensedVersion), type: archiveInfo.type });
});

router.post("/:id/stage-session", async (req, res) => {
    const parsed = stageSessionSchema.safeParse({ ...req.body, mod_id: req.params.id });
    const refreshedUser = await syncUserAccess(req.user!.id);
    const user = refreshedUser || await UserDB.findById(req.user!.id);
    const license = parsed.success ? user?.modLicenses?.find(item => item.licenseKey === parsed.data.license_key) : undefined;
    const currentVersions = Array.isArray(user?.versions) ? user.versions : [];
    const hasActiveVersion = (version: string) => normalizeVersionName(version) === normalizeVersionName("All Versions")
        ? currentVersions.length > 0
        : currentVersions.some(current => normalizeVersionName(current) === normalizeVersionName("All Versions") || normalizeVersionName(current) === normalizeVersionName(version));
    if (!parsed.success || !license || license.modId !== parsed.data.mod_id || license.expiresAt <= Date.now() || !hasActiveVersion(license.version) || (license.hwid && license.hwid !== parsed.data.hwid)) {
        return res.status(401).json({ error: "Request rejected" });
    }
    license.hwid ||= parsed.data.hwid;
    await UserDB.update(req.user!.id, { modLicenses: user!.modLicenses, updatedAt: new Date() });

    const archiveInfo = await getModArchiveInfo(parsed.data.mod_id, license.type);
    if (!archiveInfo) return res.status(404).json({ error: "Payload not found" });
    const availableVersions = Array.isArray(archiveInfo.version) ? archiveInfo.version : [archiveInfo.version];
    if (!availableVersions.some(version => normalizeVersionName(version) === normalizeVersionName(license.version))) {
        return res.status(403).json({ error: "Licensed version is no longer available." });
    }
    const files = await collectSecureFiles(archiveInfo.pluginDir);
    if (files.length === 0) return res.status(404).json({ error: "No stageable files found" });
    const key = crypto.randomBytes(32);
    const encryptedFiles = files.map(file => {
        const iv = crypto.randomBytes(12);
        const aad = Buffer.from(`${parsed.data.mod_id}:${file.relativePath}`);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(file.data), cipher.final()]);
        file.data.fill(0);
        return { relativePath: file.relativePath, ciphertextBase64: ciphertext.toString("base64"), ivBase64: iv.toString("base64"), authTagBase64: cipher.getAuthTag().toString("base64"), aadBase64: aad.toString("base64") };
    });
    const sessionId = crypto.randomUUID();
    activeStageSessions.set(sessionId, { userId: req.user!.id, expiresAt: Date.now() + 90_000 });
    const keyBase64 = key.toString("base64");
    key.fill(0);
    res.status(200).type("application/json");
    res.write(`{"sessionId":${JSON.stringify(sessionId)},"expiresIn":90,"keyBase64":${JSON.stringify(keyBase64)},"files":[`);
    for (let index = 0; index < encryptedFiles.length; index++) {
        if (index > 0) res.write(",");
        res.write(JSON.stringify(encryptedFiles[index]));
    }
    res.end("]}");
});

router.post("/stage-session/:sessionId/terminate", async (req, res) => {
    const session = activeStageSessions.get(req.params.sessionId);
    if (!session || session.userId !== req.user!.id) {
        activeStageSessions.delete(req.params.sessionId);
        return res.status(404).json({ error: "Session not found" });
    }
    activeStageSessions.delete(req.params.sessionId);
    res.json({ terminated: true });
});

router.get("/:id/resource", async (req, res) => {
    try {
        const archiveInfo = await getModArchiveInfo(req.params.id, req.query.type as string);
        if (!archiveInfo) return res.status(404).json({ error: "Resource not found" });
        const name = resourceName(archiveInfo.pluginId);
        const version = Array.isArray(archiveInfo.version) ? archiveInfo.version[0] : archiveInfo.version;
        const output = new PassThrough();
        const chunks: Buffer[] = [];
        output.on("data", chunk => chunks.push(Buffer.from(chunk)));
        output.on("end", () => {
            res.status(200).type("application/zip").setHeader("Content-Disposition", `attachment; filename="${name}.zip"`).send(Buffer.concat(chunks));
        });
        const archive: Archiver = archiver("zip", { zlib: { level: 9 } });
        archive.on("error", error => { if (!res.headersSent) res.status(500).json({ error: "Resource build failed" }); });
        archive.pipe(output);
        archive.append(`fx_version 'cerulean'\ngame 'gta5'\nserver_script 'server/server.js'\n`, { name: `${name}/fxmanifest.lua` });
        archive.append(resourceClientLoader(), { name: `${name}/client/loader.lua` });
        archive.append(resourceServerScript(name, String(version || "1.0")), { name: `${name}/server/server.js` });
        await archive.finalize();
    } catch (error) {
        console.error("[Resource Download] Failed:", error);
        if (!res.headersSent) res.status(500).json({ error: "Resource unavailable" });
    }
});

async function collectSecureFiles(root: string, current = ""): Promise<{ relativePath: string; data: Buffer }[]> {
    const directory = path.join(root, current);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: { relativePath: string; data: Buffer }[] = [];
    for (const entry of entries) {
        if (entry.name.toLowerCase().includes("image.") || entry.name.toLowerCase().includes("logo.") || entry.name === "config.ts") continue;
        const relativePath = path.join(current, entry.name);
        if (entry.isDirectory()) files.push(...await collectSecureFiles(root, relativePath));
        else if (entry.isFile()) files.push({ relativePath: relativePath.replace(/\\/g, "/"), data: await fs.readFile(path.join(root, relativePath)) });
    }
    return files;
}

router.post("/:id/secure-session", async (req, res) => {
    try {
        const type = req.query.type as string;
        const archiveInfo = await getModArchiveInfo(req.params.id, type);
        if (!archiveInfo) return res.status(404).json({ error: "Archive not found" });

        const user = await syncUserAccess(req.user!.id, true) || await UserDB.findById(req.user!.id);
        const versions = Array.isArray(user?.versions) ? user.versions : [];
        const availableVersions = Array.isArray(archiveInfo.version) ? archiveInfo.version : [archiveInfo.version];
        if ((type === "version" || type === "versions") && !availableVersions.some(version => hasVersionAccess(versions, version))) {
            return res.status(403).json({ error: "You do not have access to this version." });
        }

        const key = crypto.randomBytes(32);
        const files = await collectSecureFiles(archiveInfo.pluginDir);
        if (files.length === 0) return res.status(404).json({ error: "No secure files found" });

        const encryptedFiles = files.map(file => {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
            const ciphertext = Buffer.concat([cipher.update(file.data), cipher.final()]);
            return {
                relativePath: file.relativePath,
                ciphertextBase64: ciphertext.toString("base64"),
                ivBase64: iv.toString("base64"),
                authTagBase64: cipher.getAuthTag().toString("base64")
            };
        });

        res.json({ keyBase64: key.toString("base64"), files: encryptedFiles, expiresIn: 60 });
    } catch (error) {
        console.error("[Secure Download] Failed:", error);
        res.status(500).json({ error: "Secure session unavailable" });
    }
});

const normalizeVersionName = (version: string) => version.trim().toLowerCase();

const hasVersionAccess = (versions: string[], candidate: string) => {
    const normalizedVersions = new Set(versions.map(normalizeVersionName));
    return normalizedVersions.has(normalizeVersionName(candidate));
};

const modMatchesUserVersions = (modVersions: string[], versions: string[], validVersionNames: string[]) => {
    if (versions.length === 0) return false;

    const normalizedVersions = new Set(versions.map(normalizeVersionName));
    const normalizedValidVersions = new Set(validVersionNames.map(normalizeVersionName));

    return modVersions.some((version) => {
        if (normalizeVersionName(version) === normalizeVersionName("All Versions")) {
            return true;
        }

        return normalizedValidVersions.has(normalizeVersionName(version)) && normalizedVersions.has(normalizeVersionName(version));
    });
};

router.get("/", async (req, res) => {
    try {
        const type = req.query.type === "ModPack" ? "mods" : "versions";
        const userId = req.user!.id;
        const updatedUser = await syncUserAccess(userId);
        const userToUse = updatedUser || await UserDB.findById(userId);
        const versions = Array.isArray(userToUse?.versions) ? userToUse!.versions : [];

        let mods = await getAvailableMods(type);

        if (type === "mods") {
            const plugins = await getAvailableMods("plugins");
            mods = [...mods, ...plugins];
        }

        const validVersionNames = await getValidVersionNames();
        const filteredMods = mods.filter(mod => {
            const modVersions = Array.isArray(mod.version) ? mod.version : [mod.version];
            return modMatchesUserVersions(modVersions, versions, validVersionNames);
        });

        res.json(filteredMods);
    } catch (error) {
        res.status(500).json({ error: "Failed to load mods" });
    }
});

router.get("/all", async (req, res) => {
    try {
        const type = req.query.type === "ModPack" ? "mods" : "versions";
        const userId = req.user!.id;
        const updatedUser = await syncUserAccess(userId);
        const userToUse = updatedUser || await UserDB.findById(userId);
        const versions = Array.isArray(userToUse?.versions) ? userToUse!.versions : [];

        let mods = await getAvailableMods(type);

        if (type === "mods") {
            const plugins = await getAvailableMods("plugins");
            mods = [...mods, ...plugins];
        }
        const validVersionNames = await getValidVersionNames();
        const filteredMods = mods.filter(mod => {
            const modVersions = Array.isArray(mod.version) ? mod.version : [mod.version];
            return modMatchesUserVersions(modVersions, versions, validVersionNames);
        });

        res.json(filteredMods);
    } catch (error) {
        res.status(500).json({ error: "Failed to load mods" });
    }
});

router.get("/:id/archive", async (req, res) => {
    try {
        const type = req.query.type as string;
        const archiveInfo = await getModArchiveInfo(req.params.id, type);

        if (!archiveInfo) {
            res.status(404).json({ error: "Archive not found" });
            return;
        }

        res.json({ error: "Archive downloading via this endpoint is deprecated. Use /downloads instead." });
    } catch (error) {
        res.status(500).json({ error: "Failed to get archive info" });
    }
});

router.post("/:id/downloads", async (req, res) => {
    try {
        const type = req.query.type as string;
        const archiveInfo = await getModArchiveInfo(req.params.id, type);

        if (!archiveInfo) {
            res.status(404).json({ error: "Archive not found" });
            return;
        }

        // Permission check
        if (type === "versions" || type === "version") {
            const userId = req.user!.id;
            const user = await syncUserAccess(userId, true) || await UserDB.findById(userId);
            
            const versions = Array.isArray(user?.versions) ? user!.versions : [];
            const hasAccess = Array.isArray(archiveInfo.version)
                ? archiveInfo.version.some(v => hasVersionAccess(versions, v))
                : hasVersionAccess(versions, archiveInfo.version);

            if (!hasAccess) {
                res.status(403).json({ error: "You do not have access to this version." });
                return;
            }
        }

        const downloadId = createDownloadId();
        const token = signDownloadToken({
            downloadId,
            modId: req.params.id,
            userId: req.user!.id,
            type: archiveInfo.type || type
        });

        res.status(201).json({
            downloadId,
            downloadUrl: `/api/mod-downloads/${downloadId}.zip?token=${encodeURIComponent(token)}${type ? `&type=${type}` : ""}`,
            fileName: `${archiveInfo.pluginId || req.params.id}.zip`,
            modId: req.params.id,
            modName: archiveInfo.pluginId || req.params.id,
            type: archiveInfo.type || type || "unknown",
            version: archiveInfo.version,
            size: 0
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to create download session" });
    }
});

import { findRpfFiles } from "../lib/fs-utils";

router.get("/:id/rpf-files", async (req, res) => {
    return res.status(410).json({ error: "Raw mod downloads are disabled; use license-stub and stage-session." });
    /*
    try {
        const type = req.query.type as string;
        const archiveInfo = await getModArchiveInfo(req.params.id, type);

        if (!archiveInfo) {
            res.status(404).json({ error: "Mod archive not found" });
            return;
        }

        // Permission check
        if (type === "versions" || type === "version") {
            const userId = req.user!.id;
            const user = await syncUserAccess(userId, true) || await UserDB.findById(userId);
            
            const versions = Array.isArray(user?.versions) ? user!.versions : [];
            const hasAccess = Array.isArray(archiveInfo.version)
                ? archiveInfo.version.some(v => hasVersionAccess(versions, v))
                : hasVersionAccess(versions, archiveInfo.version);

            if (!hasAccess) {
                res.status(403).json({ error: "You do not have access to this version." });
                return;
            }
        }

        const rpfFiles = await findRpfFiles(archiveInfo.pluginDir);
        
        const filesWithUrl = rpfFiles.map(file => ({
            ...file,
            url: `/api/plugins/${archiveInfo.type}/${encodeURIComponent(archiveInfo.pluginId)}/${file.relativePath.split("/").map(encodeURIComponent).join("/")}`
        }));

        const user = await UserDB.findById(req.user!.id);
        const modType = archiveInfo.type || type || "unknown";
        console.log(`[Download] User ${user?.username || req.user!.id} downloading RPF ${req.params.id} (${modType})`);
        sendDownloadWebhook(
            {
                id: req.user!.id,
                username: user?.username || "Unknown",
                avatar: user?.avatar,
            },
            {
                id: req.params.id,
                name: archiveInfo.pluginId,
                version: Array.isArray(archiveInfo.version) ? archiveInfo.version.join(", ") : archiveInfo.version,
                type: modType,
            }
        );

        res.json({ files: filesWithUrl });
    } catch (error) {
        console.error("Failed to fetch RPF files:", error);
        res.status(500).json({ error: "Failed to fetch RPF files" });
    }
    */
});

export default router;
