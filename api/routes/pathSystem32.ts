import { Router } from "express";
import { UserDB, type UserSettings } from "../models/User";
import path from "path";
import os from "os";

const router = Router();

function derivePathsFromExe(fivemExePath: string) {
    const windowsPath = path.win32;
    const normalizedPath = windowsPath.normalize(fivemExePath.trim());
    const executableDirectory = windowsPath.dirname(normalizedPath);
    const isInsideFiveMApp = windowsPath.basename(executableDirectory).toLowerCase() === "fivem.app";
    const fivemDir = isInsideFiveMApp ? windowsPath.dirname(executableDirectory) : executableDirectory;
    const fivemAppData = isInsideFiveMApp ? executableDirectory : windowsPath.join(fivemDir, "FiveM.app");
    
    return {
        fivemApp: normalizedPath,
        fivemAppData,
        fivemModsDIRS: ["mods", "plugins", "citizen"].map(dir => windowsPath.join(fivemAppData, dir)),
        fivemPath: fivemDir
    };
}

function validateFiveMInstallation(fivemExePath: string): { valid: boolean; error?: string; paths?: ReturnType<typeof derivePathsFromExe> } {
    try {
        const normalizedPath = path.win32.normalize(fivemExePath.trim());

        if (path.win32.extname(normalizedPath).toLowerCase() !== ".exe") {
            return { valid: false, error: "Selected file must be an executable (.exe)" };
        }

        // The stored path belongs to the user's computer, not the API server.
        // Only derive paths here; Electron validates and creates local folders.
        return { valid: true, paths: derivePathsFromExe(normalizedPath) };
    } catch (e) {
        return { valid: false, error: "Invalid FiveM path" };
    }
}

function getAutoFiveMPath(): string | null {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const possiblePaths = [
        path.join(localAppData, "FiveM", "FiveM.exe"),
        path.join(localAppData, "FiveM"),
        path.join(process.env.APPDATA || "", "..", "Local", "FiveM", "FiveM.exe"),
        path.join(process.env.APPDATA || "", "..", "Local", "FiveM"),
    ];

    for (const p of possiblePaths) {
        const normalized = path.normalize(p);
        try {
            require("fs").accessSync(normalized);
            return normalized;
        } catch {}
    }
    return null;
}

router.get("/", async (req, res) => {
    try {
        const user = await UserDB.findById(req.user!.id);

        if (!user) {
            return res.status(401).json({ error: "401 Unauthorized" });
        }

        console.log(`[Paths API] Raw user.settings.fivemDir: ${JSON.stringify(user?.settings?.fivemDir)}`);
        
        let fivemExePath = user?.settings.fivemDir ?? getAutoFiveMPath() ?? "";
        
        // Handle if fivemDir is an object (from {path:...} or {error:...})
        if (typeof fivemExePath === "object" && fivemExePath !== null) {
            const obj = fivemExePath as Record<string, unknown>;
            if ("path" in obj && typeof obj.path === "string") {
                fivemExePath = obj.path;
            } else {
                fivemExePath = "";
            }
        }
        
        console.log(`[Paths API] Processed fivemExePath: ${fivemExePath}`);
        
        if (!fivemExePath) return res.status(400).json({ error: "FiveM directory not found. Please set it in Settings." });

        const validation = validateFiveMInstallation(fivemExePath);
        if (!validation.valid) {
            console.log(`[Paths API] Validation failed: ${validation.error}`);
            return res.status(400).json({ error: validation.error || "Invalid FiveM installation" });
        }

        console.log(`[Paths API] Returning paths: ${JSON.stringify(validation.paths)}`);
        return res.status(200).json({
            paths: validation.paths,
            autoDetected: !user?.settings.fivemDir
        })
    } catch (error) {
        console.error("Failed to load paths:", error);
        res.status(500).json({ error: "Failed to load paths" });
    }
});

export default router;