import { Router } from "express";
import { verifyDownloadToken } from "../lib/downloadTokens";
import { getModArchiveInfo } from "../lib/pluginLoader";
import { UserDB } from "../models/User";
import { sendDownloadWebhook } from "../lib/webhooks";
import type { Archiver } from "archiver";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require("archiver");
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { getDataPath } from "../lib/paths";

const router = Router();

// --- Archive cache: single fixed directory, predictable file names ---
const CACHE_DIR = path.join(getDataPath(), ".archive-cache");
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_FILES = 50;
const archiveCache = new Map<string, { filePath: string; size: number; expires: number }>();

// Ensure cache dir exists on startup & purge any stale files from previous runs
(async () => {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        // Remove leftover .zip files not tracked in memory (server restart scenario)
        const files = await fs.readdir(CACHE_DIR);
        for (const file of files) {
            if (!file.endsWith(".zip")) continue;
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stat = await fs.stat(filePath);
                if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
                    await fs.unlink(filePath).catch(() => {});
                }
            } catch {
                await fs.unlink(filePath).catch(() => {});
            }
        }
        console.log("[Download] Archive cache ready:", CACHE_DIR);
    } catch (err) {
        console.error("[Download] Failed to init archive cache:", err);
    }
})();

// Also clean up any old mod-dl-* dirs from /tmp left by previous versions
(async () => {
    try {
        const tmpBase = os.tmpdir();
        const entries = await fs.readdir(tmpBase, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith("mod-dl-")) {
                await fs.rm(path.join(tmpBase, entry.name), { recursive: true, force: true }).catch(() => {});
            }
        }
        console.log("[Download] Old /tmp mod-dl-* dirs cleaned");
    } catch {}
})();

// Periodic cache eviction
const _cacheTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of archiveCache) {
        if (entry.expires < now) {
            fs.unlink(entry.filePath).catch(() => {});
            archiveCache.delete(key);
        }
    }
}, 5 * 60 * 1000);
if (_cacheTimer.unref) _cacheTimer.unref();

const isExcludedAsset = (name: string) =>
    name.toLowerCase().includes("image.") || name.toLowerCase().includes("logo.") || name.toLowerCase() === "config.ts";

async function addDirectoryFiles(archive: Archiver, sourceDir: string, archiveDir: string): Promise<number> {
    let count = 0;
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        if (isExcludedAsset(entry.name) || entry.isSymbolicLink()) continue;
        const sourcePath = path.join(sourceDir, entry.name);
        const archivePath = path.posix.join(archiveDir, entry.name);
        if (entry.isDirectory()) {
            count += await addDirectoryFiles(archive, sourcePath, archivePath);
        } else if (entry.isFile()) {
            archive.file(sourcePath, { name: archivePath });
            count++;
        }
    }
    return count;
}

async function addFilesToArchive(archive: Archiver, archiveInfo: any): Promise<void> {
    const entries = await fs.readdir(archiveInfo.pluginDir, { withFileTypes: true });
    let fileCount = 0;

    if (archiveInfo.type === "mods" || archiveInfo.type === "versions") {
        const standardFolders = ["mods", "plugins", "citizen"];
        const standardNames = new Set(standardFolders);

        for (const folderName of standardFolders) {
            const sourceFolder = entries.find(entry => entry.isDirectory() && entry.name.toLowerCase() === folderName);
            if (sourceFolder) {
                fileCount += await addDirectoryFiles(
                    archive,
                    path.join(archiveInfo.pluginDir, sourceFolder.name),
                    folderName
                );
            }
        }

        // Some version packages keep their RPF/ASI/assets directly in the
        // version folder. Route those files into FiveM.app\mods instead of
        // returning an archive containing only empty standard folders.
        for (const entry of entries) {
            if (entry.isSymbolicLink() || isExcludedAsset(entry.name) || standardNames.has(entry.name.toLowerCase())) continue;
            const sourcePath = path.join(archiveInfo.pluginDir, entry.name);
            if (entry.isDirectory()) {
                fileCount += await addDirectoryFiles(archive, sourcePath, path.posix.join("mods", entry.name));
            } else if (entry.isFile()) {
                archive.file(sourcePath, { name: path.posix.join("mods", entry.name) });
                fileCount++;
            }
        }
    } else {
        const archiveFolder = archiveInfo.type === "plugins" ? "plugins" : "";
        for (const entry of entries) {
            if (entry.isSymbolicLink() || isExcludedAsset(entry.name)) continue;
            const sourcePath = path.join(archiveInfo.pluginDir, entry.name);
            const archivePath = archiveFolder ? path.posix.join(archiveFolder, entry.name) : entry.name;
            if (entry.isDirectory()) {
                fileCount += await addDirectoryFiles(archive, sourcePath, archivePath);
            } else if (entry.isFile()) {
                archive.file(sourcePath, { name: archivePath });
                fileCount++;
            }
        }
    }

    if (fileCount === 0) throw new Error(`No installable files found in mod folder: ${archiveInfo.pluginDir}`);
    await archive.finalize();
}

/** Sanitize modId for use as a filename */
function safeCacheFileName(modId: string): string {
    return modId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120) + ".zip";
}

async function buildArchiveToDisk(archiveInfo: any, modId: string): Promise<{ path: string; size: number }> {
    const cached = archiveCache.get(modId);
    if (cached && cached.expires > Date.now()) {
        try {
            await fs.access(cached.filePath);
            return { path: cached.filePath, size: cached.size };
        } catch {
            archiveCache.delete(modId);
        }
    }

    // Enforce cache size limit – delete oldest files
    if (archiveCache.size >= MAX_CACHE_FILES) {
        const sorted = [...archiveCache.entries()].sort((a, b) => a[1].expires - b[1].expires);
        const toRemove = sorted.slice(0, archiveCache.size - MAX_CACHE_FILES + 1);
        for (const [key, entry] of toRemove) {
            fs.unlink(entry.filePath).catch(() => {});
            archiveCache.delete(key);
        }
    }

    await fs.mkdir(CACHE_DIR, { recursive: true });
    const fileName = safeCacheFileName(modId);
    const finalPath = path.join(CACHE_DIR, fileName);
    const tmpPath = finalPath + ".tmp";

    try {
        await new Promise<void>((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 0 }, statConcurrency: 4 });
            const output = fsSync.createWriteStream(tmpPath);
            archive.pipe(output);
            
            const cleanup = () => {
                if (!output.closed && !output.destroyed) {
                    output.destroy();
                }
            };

            archive.on("error", (err: any) => { cleanup(); reject(err); });
            output.on("error", (err: any) => { cleanup(); reject(err); });
            output.on("close", resolve);
            
            void addFilesToArchive(archive, archiveInfo).catch((err: any) => {
                cleanup();
                reject(err);
            });
        });

        // Atomic rename – overwrites any old cached file for same mod
        await fs.rename(tmpPath, finalPath);
        const stats = await fs.stat(finalPath);
        archiveCache.set(modId, { filePath: finalPath, size: stats.size, expires: Date.now() + CACHE_TTL_MS });

        return { path: finalPath, size: stats.size };
    } catch (error) {
        await fs.unlink(tmpPath).catch(() => {});
        throw error;
    }
}

// HEAD handler: pre-build archive so the client gets accurate Content-Length
router.head("/:downloadFileName", async (req, res) => {
    const downloadId = req.params.downloadFileName.replace(/\.zip$/, "");
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
        res.status(401).json({ error: "Missing download token" });
        return;
    }

    let payload;
    try {
        payload = verifyDownloadToken(token);
    } catch {
        res.status(401).json({ error: "Download token expired or invalid" });
        return;
    }

    if (payload.downloadId !== downloadId) {
        res.status(401).json({ error: "Invalid download token" });
        return;
    }

    const archiveInfo = await getModArchiveInfo(payload.modId, payload.type);
    if (!archiveInfo) {
        res.status(404).json({ error: "Archive not found" });
        return;
    }

    try {
        const { size: totalSize } = await buildArchiveToDisk(archiveInfo, `${payload.type || archiveInfo.type}_${payload.modId}`);
        res.setHeader("Content-Length", totalSize.toString());
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("X-Archive-Size", totalSize.toString());
        res.status(200).end();
    } catch (err) {
        console.error("[Download] HEAD error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to determine archive size" });
    }
});

router.get("/:downloadFileName", async (req, res) => {
    const downloadId = req.params.downloadFileName.replace(/\.zip$/, "");
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
        res.status(401).json({ error: "Missing download token" });
        return;
    }

    let payload;
    try {
        payload = verifyDownloadToken(token);
    } catch {
        res.status(401).json({ error: "Download token expired or invalid" });
        return;
    }

    if (payload.downloadId !== downloadId) {
        res.status(401).json({ error: "Invalid download token" });
        return;
    }

    const archiveInfo = await getModArchiveInfo(payload.modId, payload.type);
    if (!archiveInfo) {
        res.status(404).json({ error: "Archive not found" });
        return;
    }

    console.log(`[Download] ${payload.userId} → ${payload.modId} (${archiveInfo.type})`);

    // Fire webhook in background
    UserDB.findById(payload.userId).then(user => {
        sendDownloadWebhook(
            { id: payload.userId, username: user?.username || "Unknown", avatar: user?.avatar },
            {
                id: payload.modId,
                name: archiveInfo.pluginId,
                version: Array.isArray(archiveInfo.version) ? archiveInfo.version.join(", ") : archiveInfo.version,
                type: archiveInfo.type || "unknown",
            }
        );
    }).catch(() => {});

    const rangeHeader = req.headers.range;

    // Range request → serve from disk file
    if (rangeHeader) {
        try {
            const { path: archivePath, size: totalSize } = await buildArchiveToDisk(archiveInfo, `${payload.type || archiveInfo.type}_${payload.modId}`);

            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            const chunkSize = end - start + 1;

            res.status(206);
            res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Content-Length", chunkSize.toString());
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename="${payload.modId}.zip"`);
            res.setHeader("X-Archive-Size", totalSize.toString());

            const stream = fsSync.createReadStream(archivePath, { start, end });
            stream.on("error", (err: any) => {
                console.error("[Download] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            stream.pipe(res);
            req.on("close", () => {
                if (!stream.destroyed) stream.destroy();
            });
        } catch (err) {
            console.error("[Download] Range error:", err);
            if (!res.headersSent) res.status(500).json({ error: "Download failed" });
        }
        return;
    }

    // Normal request → also serve from disk so we can return Content-Length for accurate progress
    try {
        const { path: archivePath, size: totalSize } = await buildArchiveToDisk(archiveInfo, `${payload.type || archiveInfo.type}_${payload.modId}`);

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${payload.modId}.zip"`);
        res.setHeader("Content-Length", totalSize.toString());
        res.setHeader("X-Archive-Size", totalSize.toString());
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "no-store");

        const stream = fsSync.createReadStream(archivePath);
        stream.on("error", (err: any) => {
            console.error("[Download] stream error:", err);
            if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
        req.on("close", () => {
            if (!stream.destroyed) stream.destroy();
        });
    } catch (err) {
        console.error("[Download] Failed:", err);
        if (!res.headersSent) res.status(500).json({ error: "Download failed" });
        else res.end();
    }
});

export default router;
