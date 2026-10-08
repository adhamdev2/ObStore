import { Router } from "express";
import { normalizeUserSettings, UserDB, type UserSettings } from "../models/User";

const router = Router();
import { getModArchiveInfo } from "../lib/pluginLoader";
import { findRpfFiles } from "../lib/fs-utils";


router.get("/settings", async (req, res) => {
    try {
        const user = await UserDB.findById(req.user!.id);

        if (!user) {
            return res.json(normalizeUserSettings());
        }

        res.json(normalizeUserSettings(user.settings));
    } catch {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

router.put("/settings", async (req, res) => {
    try {
        const { theme, language, notifications, fivemDir } = req.body;
        let user = await UserDB.findById(req.user!.id);

        if (!user) {
            const settings = normalizeUserSettings({ theme, language, notifications, fivemDir });
            user = await UserDB.insert({
                discordId: req.user!.id,
                username: req.user!.username || "Unknown",
                avatar: req.user!.avatar,
                settings,
                downloads: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                versions: []
            });
        } else {
            const settings = normalizeUserSettings(user.settings);

            if (theme !== undefined) settings.theme = theme;
            if (language !== undefined) settings.language = language;
            if (notifications !== undefined) settings.notifications = notifications;
            if (fivemDir !== undefined) settings.fivemDir = fivemDir;

            await UserDB.update(req.user!.id, { settings, updatedAt: new Date() });
            user.settings = settings;
        }

        res.json(normalizeUserSettings(user.settings));
    } catch (error) {
        console.error("Update settings error:", error);
        res.status(500).json({ error: "Failed to update settings" });
    }
});

// Download history endpoints
router.get("/downloads", async (req, res) => {
    try {
        const user = await UserDB.findById(req.user!.id);
        res.json(user?.downloads || []);
    } catch {
        res.status(500).json({ error: "Failed to fetch downloads" });
    }
});

router.post("/downloads", async (req, res) => {
    try {
        const { id, name, version, type, modType } = req.body;
        if (!id || !name || !type) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await UserDB.findById(req.user!.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        let finalFiles: string[] = req.body.files || [];
        if (finalFiles.length === 0 && (type === "mod" || type === "mods")) {
            const archiveInfo = await getModArchiveInfo(id, "mods");
            if (archiveInfo) {
                const rpfFiles = await findRpfFiles(archiveInfo.pluginDir);
                finalFiles = rpfFiles.map(f => f.relativePath);
            }
        }

        const downloads = user.downloads || [];
        const existingIndex = downloads.findIndex(d => d.id === id);

        const newDownload = {
            id,
            name,
            version: version || "1.0.0",
            type,
            ...(typeof modType === "string" ? { modType } : {}),
            date: new Date().toISOString(),
            files: finalFiles
        };

        if (existingIndex >= 0) {
            downloads.splice(existingIndex, 1);
            downloads.unshift(newDownload);
        } else {
            downloads.unshift(newDownload);
        }

        await UserDB.update(req.user!.id, { downloads, updatedAt: new Date() });
        res.json({ success: true, downloads });
    } catch (error) {
        console.error("Add download error:", error);
        res.status(500).json({ error: "Failed to record download" });
    }
});


router.delete("/downloads", async (req, res) => {
    try {
        const user = await UserDB.findById(req.user!.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        await UserDB.update(req.user!.id, { downloads: [], updatedAt: new Date() });
        
        res.json({ success: true, downloads: [] });
    } catch {
        res.status(500).json({ error: "Failed to clear downloads" });
    }
});

router.delete("/downloads/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserDB.findById(req.user!.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const downloads = (user.downloads || []).filter(d => d.id !== id);
        await UserDB.update(req.user!.id, { downloads, updatedAt: new Date() });
        
        res.json({ success: true, downloads });
    } catch {
        res.status(500).json({ error: "Failed to remove download" });
    }
});

export default router;
