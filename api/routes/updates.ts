import { Router, type Request, type Response } from "express";
import multer from "multer";
import { updateService } from "../services/updateService";
import { updateWsServer } from "../services/updateWsServer";
import { requireUpdateAuth } from "../middleware/updateAuth";
import { z } from "zod";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
    },
    fileFilter: (_req, file, cb) => {
        const originalName = file.originalname.toLowerCase();
        if (file.mimetype === "application/octet-stream" || 
            file.mimetype === "application/x-msdownload" ||
            originalName.endsWith(".exe") ||
            originalName.endsWith(".nupkg")) {
            cb(null, true);
        } else {
            cb(new Error("Only .exe and .nupkg files are allowed"));
        }
    },
});

const uploadSchema = z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in format x.y.z"),
    changelog: z.string().optional(),
});

router.post(
    "/data/app.exe",
    requireUpdateAuth,
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "package", maxCount: 20 },
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const files = req.files as Record<string, Express.Multer.File[]> | undefined;
            const installer = files?.file?.[0];
            const squirrelPackages = files?.package ?? [];
            const releases = typeof req.body.releases === "string" ? req.body.releases : "";

            if (!installer || squirrelPackages.length === 0 || !releases) {
                res.status(400).json({ error: "Installer, Squirrel packages, and RELEASES file are required" });
                return;
            }

            const parseResult = uploadSchema.safeParse(req.body);
            if (!parseResult.success) {
                res.status(400).json({ 
                    error: "Invalid version format", 
                    details: parseResult.error.flatten().fieldErrors 
                });
                return;
            }

            const { version, changelog } = parseResult.data;
            const fileBuffer = installer.buffer;

            console.log(`[Update] Uploading version ${version} (${fileBuffer.length} bytes)`);

            const updateInfo = await updateService.saveUpdate(fileBuffer, version, {
                releases,
                packages: squirrelPackages.map((file) => ({
                    packageName: file.originalname,
                    packageBuffer: file.buffer,
                })),
            }, changelog);
            
            updateWsServer.broadcastUpdate(updateInfo);

            res.json({
                success: true,
                version: updateInfo.version,
                build: updateInfo.build,
                fileSize: updateInfo.fileSize,
                sha256: updateInfo.sha256,
                releaseDate: updateInfo.releaseDate,
                squirrelPackages: squirrelPackages.map((file) => file.originalname),
            });
        } catch (err: any) {
            console.error("[Update] Upload error:", err);
            res.status(500).json({ error: err.message || "Upload failed" });
        }
    }
);

router.get("/data/app.exe", async (req: Request, res: Response): Promise<void> => {
    try {
        const filePath = updateService.getFilePath();
        
        if (!updateService.fileExists()) {
            res.status(404).json({ error: "No update file available" });
            return;
        }

        const stats = updateService.getFileStats();
        if (!stats) {
            res.status(404).json({ error: "Update file not found" });
            return;
        }

        const range = req.headers.range;
        const fileSize = stats.size;

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", 'attachment; filename="app.exe"');
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "no-store");

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize) {
                res.setHeader("Content-Range", `bytes */${fileSize}`);
                res.status(416).end();
                return;
            }

            const chunkSize = end - start + 1;
            const file = require("fs").createReadStream(filePath, { start, end });
            
            res.status(206);
            res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            res.setHeader("Content-Length", chunkSize);
            
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });
        } else {
            res.setHeader("Content-Length", fileSize);
            const file = require("fs").createReadStream(filePath);
            file.on("error", (err: any) => {
                console.error("[Update] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });
        }
    } catch (err: any) {
        console.error("[Update] Download error:", err);
        res.status(500).json({ error: "Download failed" });
    }
});

// electron-updater (NSIS provider) expects latest.yml at the root of the feed URL
// This endpoint generates it dynamically from our manifest
router.get("/win32/latest.yml", (req: Request, res: Response): void => {
    const current = updateService.getCurrent();
    if (!current) {
        res.status(404).end();
        return;
    }

    const stats = updateService.getFileStats();
    const fileSize = stats?.size ?? current.fileSize;
    // electron-updater requires sha512 in base64 format
    const sha512 = current.sha512 ?? current.sha256 ?? "";

    // Build absolute download URL so electron-updater fetches from the correct endpoint
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const downloadUrl = `${baseUrl}/api/update/data/app.exe`;

    // electron-updater NSIS latest.yml format — url must be an absolute URL or filename only
    const yaml = [
        `version: ${current.version}`,
        `files:`,
        `  - url: ${downloadUrl}`,
        `    sha512: ${sha512}`,
        `    size: ${fileSize}`,
        `path: ${downloadUrl}`,
        `sha512: ${sha512}`,
        `releaseDate: '${current.releaseDate}'`,
    ].join("\n");

    res.setHeader("Content-Type", "application/yaml");
    res.setHeader("Cache-Control", "no-store");
    res.send(yaml);
});

// Serve the installer directly at /win32/app.exe (electron-updater may request it here)
router.get("/win32/app.exe", async (req: Request, res: Response): Promise<void> => {
    try {
        const filePath = updateService.getFilePath();
        if (!updateService.fileExists()) { res.status(404).json({ error: "No update file available" }); return; }
        const stats = updateService.getFileStats();
        if (!stats) { res.status(404).end(); return; }
        const range = req.headers.range;
        const fileSize = stats.size;
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", 'attachment; filename="app.exe"');
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "no-store");
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            if (start >= fileSize || end >= fileSize) { res.setHeader("Content-Range", `bytes */${fileSize}`); res.status(416).end(); return; }
            res.status(206);
            res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            res.setHeader("Content-Length", end - start + 1);
            const file = require("fs").createReadStream(filePath, { start, end });
            file.on("error", (err: any) => {
                console.error("[Update] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });
        } else {
            res.setHeader("Content-Length", fileSize);
            const file = require("fs").createReadStream(filePath);
            file.on("error", (err: any) => {
                console.error("[Update] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });
        }
    } catch (err: any) {
        if (!res.headersSent) res.status(500).json({ error: "Download failed" });
    }
});

// Squirrel RELEASES at root level (used by fetchPackageInfo)
router.get("/win32/RELEASES", (req: Request, res: Response): void => {
    const filePath = updateService.getSquirrelFeedFile("RELEASES");
    if (!filePath) {
        res.status(404).end();
        return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.type("text/plain");
    res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) res.status(500).end();
    });
});

router.get("/win32/:version/:artifact", (req: Request, res: Response): void => {
    const version = req.params.version;
    const artifact = req.params.artifact;
    if (typeof version !== "string" || typeof artifact !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
        res.status(404).end();
        return;
    }

    const artifactPath = updateService.getSquirrelFeedFile(artifact);
    if (!artifactPath) {
        res.status(404).end();
        return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.type(artifact === "RELEASES" ? "text/plain" : "application/octet-stream");
    res.sendFile(artifactPath, (err) => {
        if (err && !res.headersSent) {
            console.error("[Update] Squirrel feed download error:", err);
            res.status(500).end();
        }
    });
});

// Serve latest Squirrel feed at base URL (for electron-updater)
router.get("/win32/RELEASES", (req: Request, res: Response): void => {
    const filePath = updateService.getSquirrelFeedFile("RELEASES");
    if (!filePath) {
        res.status(404).end();
        return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.type("text/plain");
    res.sendFile(filePath);
});

router.get("/win32/:artifact", (req: Request, res: Response): void => {
    const artifact = Array.isArray(req.params.artifact) ? req.params.artifact[0] : req.params.artifact;
    if (!artifact || !/^[A-Za-z0-9_.-]+\.nupkg$/.test(artifact)) {
        res.status(404).end();
        return;
    }
    const filePath = updateService.getSquirrelFeedFile(artifact);
    if (!filePath) {
        res.status(404).end();
        return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.type("application/octet-stream");
    res.sendFile(filePath);
});

router.get("/update/status", async (req: Request, res: Response): Promise<void> => {
    try {
        const clientVersion = req.query.version as string;
        const clientBuild = parseInt(req.query.build as string) || 0;

        if (!clientVersion) {
            res.status(400).json({ error: "version query parameter required" });
            return;
        }

        const current = updateService.getCurrent();
        
        if (!current) {
            res.json({
                hasUpdate: false,
                currentVersion: clientVersion,
                latestVersion: clientVersion,
                currentBuild: clientBuild,
                latestBuild: clientBuild,
            });
            return;
        }

        const { hasUpdate, mandatory } = updateService.getUpdateForClient(clientVersion, clientBuild);

        res.json({
            hasUpdate,
            currentVersion: clientVersion,
            latestVersion: current.version,
            currentBuild: clientBuild,
            latestBuild: current.build,
            mandatory,
            releaseDate: current.releaseDate,
            changelog: current.changelog,
            fileSize: current.fileSize,
        });
    } catch (err: any) {
        console.error("[Update] Status error:", err);
        res.status(500).json({ error: "Status check failed" });
    }
});

router.get("/update/manifest", async (_req: Request, res: Response): Promise<void> => {
    try {
        const manifest = updateService.getManifest();
        res.json(manifest);
    } catch (err: any) {
        console.error("[Update] Manifest error:", err);
        res.status(500).json({ error: "Failed to get manifest" });
    }
});

router.get("/update/ws-stats", requireUpdateAuth, async (_req: Request, res: Response): Promise<void> => {
    res.json(updateWsServer.getStats());
});

router.post("/update/broadcast-force", requireUpdateAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const current = updateService.getCurrent();
        if (!current) {
            res.status(400).json({ error: "No update available to broadcast" });
            return;
        }
        
        const deadline = req.body.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        updateWsServer.broadcastForceUpdate(current, deadline);
        
        res.json({ success: true, message: "Force update broadcast sent" });
    } catch (err: any) {
        console.error("[Update] Broadcast error:", err);
        res.status(500).json({ error: "Broadcast failed" });
    }
});

router.post('/heartbeat', async (req: Request, res: Response): Promise<void> => {
    const hwid = req.body.hwid;
    if (hwid && typeof hwid === 'string') {
        updateWsServer.recordHttpHeartbeat(hwid);
    }
    res.json({ success: true });
});

export default router;

