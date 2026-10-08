import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../lib/config";
import { hashHwid, requireFivemRequest, signFivemPayload } from "../middleware/fivemSecurity";
import fs from "fs/promises";
import path from "path";
import { getModArchiveInfo } from "./../lib/pluginLoader";

const router = Router();
const fivemAuthLimit = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const authSchema = z.object({ licenseKey: z.string().min(16).max(256), hwid: z.string().min(8).max(512) });
const actionSchema = z.object({ action: z.enum(["economy.check", "inventory.inspect", "feature.trigger"]), input: z.record(z.string(), z.unknown()).default({}) });
const heartbeatSchema = z.object({ resourceId: z.string().regex(/^ob1_[a-z0-9_]+$/), version: z.string().max(64), serverId: z.string().max(128).optional() });
const streamSchema = z.object({ resourceId: z.string().regex(/^ob1_[a-z0-9_]+$/), modId: z.string().min(1).max(128), licenseKey: z.string().min(16).max(256), nonce: z.string().min(16).max(128) });
const usedStreamNonces = new Map<string, number>();

function licenses(): Record<string, { userId: string; features: string[] }> {
    try { return JSON.parse(config.FIVEM_LICENSES_JSON) as Record<string, { userId: string; features: string[] }>; } catch { return {}; }
}

router.post("/auth", fivemAuthLimit, (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    const record = parsed.success ? licenses()[parsed.data.licenseKey] : undefined;
    if (!record || !parsed.success) return res.status(401).json({ error: "Authentication failed" });

    const sessionId = crypto.randomUUID();
    const hwidHash = hashHwid(parsed.data.hwid);
    const token = jwt.sign({ kind: "fivem", sid: sessionId, licenseId: parsed.data.licenseKey, hwidHash, userId: record.userId }, config.JWT_SECRET, { expiresIn: "15m", issuer: "fivemModes" });
    res.json({ token, expiresIn: 900, features: record.features });
});

router.post("/action", requireFivemRequest, (req, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid action" });

    const payload = { requestId: crypto.randomUUID(), action: parsed.data.action, result: { accepted: true, input: parsed.data.input }, expiresAt: Math.floor(Date.now() / 1000) + 10 };
    res.json({ payload, signature: signFivemPayload(payload) });
});

router.post("/resource-heartbeat", (req, res) => {
    const timestamp = req.header("x-ob1-timestamp") || "";
    const signature = req.header("x-ob1-signature") || "";
    const body = JSON.stringify(req.body ?? {});
    const expected = crypto.createHmac("sha256", config.FIVEM_HMAC_SECRET).update(`${timestamp}\n${body}`).digest("hex");
    const timestampNumber = Number(timestamp);
    if (!config.FIVEM_HMAC_SECRET || !Number.isSafeInteger(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 60 || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(401).json({ error: "Request rejected" });
    }

    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid resource" });
    console.log(`[FiveM Resource] ${parsed.data.resourceId} heartbeat (${parsed.data.version})`);
    res.json({ accepted: true, expiresIn: 120 });
});

router.post("/mods/stream-payload", async (req, res) => {
    const timestamp = req.header("x-ob1-timestamp") || "";
    const signature = req.header("x-ob1-signature") || "";
    const rawBody = JSON.stringify(req.body ?? {});
    const expected = crypto.createHmac("sha256", config.FIVEM_HMAC_SECRET).update(`${timestamp}\n${rawBody}`).digest("hex");
    const timestampNumber = Number(timestamp);
    const parsed = streamSchema.safeParse(req.body);
    const record = parsed.success ? licenses()[parsed.data.licenseKey] : undefined;
    const now = Math.floor(Date.now() / 1000);
    const nonceKey = parsed.success ? `${parsed.data.resourceId}:${parsed.data.nonce}` : "";

    if (!config.FIVEM_HMAC_SECRET || !parsed.success || !record || !Number.isSafeInteger(timestampNumber) || Math.abs(now - timestampNumber) > 60 || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) || usedStreamNonces.has(nonceKey)) {
        return res.status(401).json({ error: "Request rejected" });
    }
    usedStreamNonces.set(nonceKey, now + 120);
    for (const [key, expiresAt] of usedStreamNonces) if (expiresAt <= now) usedStreamNonces.delete(key);

    try {
        const archiveInfo = await getModArchiveInfo(parsed.data.modId, "mods") || await getModArchiveInfo(parsed.data.modId, "plugins") || await getModArchiveInfo(parsed.data.modId, "versions");
        if (!archiveInfo) return res.status(404).json({ error: "Payload not found" });
        const payloadPath = path.join(archiveInfo.pluginDir, "payload.lua");
        const payload = await fs.readFile(payloadPath);
        const iv = crypto.randomBytes(12);
        const key = crypto.createHash("sha256").update(config.FIVEM_HMAC_SECRET).digest();
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(Buffer.from(`${parsed.data.resourceId}:${parsed.data.modId}`));
        const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
        const responsePayload = {
            resourceId: parsed.data.resourceId,
            modId: parsed.data.modId,
            algorithm: "aes-256-gcm",
            iv: iv.toString("base64"),
            authTag: cipher.getAuthTag().toString("base64"),
            ciphertext: ciphertext.toString("base64"),
            expiresAt: now + 90
        };
        res.json({ payload: responsePayload, signature: signFivemPayload(responsePayload) });
    } catch (error) {
        console.error("[FiveM Payload] Failed to stream payload:", error);
        res.status(404).json({ error: "Payload unavailable" });
    }
});

export default router;
