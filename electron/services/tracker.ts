import { app } from "electron";
import fs from "fs/promises";
import path from "path";

export interface TrackedItem {
    id: string;
    name: string;
    type: "version" | "modpack";
    files: string[];
    installedAt: string;
    fivemPath: string;
}

export const getTrackerPath = () => {
    return path.join(app.getPath("userData"), "installed_mods.json");
};

export const ensureTrackerData = async (): Promise<TrackedItem[]> => {
    const p = getTrackerPath();
    try {
        const data = await fs.readFile(p, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
};

export const getInstalledItems = async (fivemPath?: string): Promise<TrackedItem[]> => {
    const items = await ensureTrackerData();
    if (fivemPath) {
        const normalizePath = (p: string) => p ? p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() : '';
        const normalizedTarget = normalizePath(fivemPath);
        return items.filter(i => normalizePath(i.fivemPath) === normalizedTarget);
    }
    return items;
};

export const saveInstalledItem = async (item: Omit<TrackedItem, "installedAt">): Promise<void> => {
    const items = await ensureTrackerData();
    const existingIndex = items.findIndex(i => i.id === item.id);
    
    const newItem: TrackedItem = {
        ...item,
        installedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        items[existingIndex] = newItem;
    } else {
        items.push(newItem);
    }

    await fs.writeFile(getTrackerPath(), JSON.stringify(items, null, 2), "utf-8");
};

export const uninstallItem = async (id: string, fallbackFiles?: string[], fivemPath?: string): Promise<boolean> => {
    const items = await ensureTrackerData();
    const itemIndex = items.findIndex(i => i.id === id);
    
    let rawFiles: string[] = [];

    if (itemIndex !== -1) {
        rawFiles = items[itemIndex].files;
    } else if (fallbackFiles && fallbackFiles.length > 0) {
        rawFiles = fallbackFiles;
    } else {
        return false;
    }

    let filesToDelete: string[] = [];

    if (fivemPath) {
        let baseFivemAppDir = "";
        if (fivemPath.toLowerCase().endsWith("fivem.app")) {
            baseFivemAppDir = fivemPath;
        } else {
            baseFivemAppDir = path.join(fivemPath, "FiveM.app");
        }

        filesToDelete = rawFiles.map((f: string) => {
            if (path.isAbsolute(f)) {
                return f;
            }
            return path.join(baseFivemAppDir, "mods", path.basename(f));
        });

        console.log(`[Electron Tracker] Resolved baseFivemAppDir: ${baseFivemAppDir}`);
        console.log(`[Electron Tracker] Resolved filesToDelete:`, filesToDelete);
    } else {
        filesToDelete = rawFiles;
        console.log(`[Electron Tracker] NO fivemPath provided! Relying on rawFiles:`, filesToDelete);
    }

    // Delete files
    console.log(`[Electron Tracker] Attempting to delete ${filesToDelete.length} files...`);
    let hasFileNotFoundError = false;
    let hasOtherError = false;

    for (const filePath of filesToDelete) {
        try {
            await fs.rm(filePath, { force: true, recursive: true });
            console.log(`[Electron Tracker] Successfully deleted: ${filePath}`);
            
            const parent = path.dirname(filePath);
            const parentStats = await fs.readdir(parent).catch(() => []);
            if (parentStats.length === 0) {
                await fs.rmdir(parent).catch(() => {});
            }
        } catch (err: any) {
            if (err.code === "ENOENT") {
                console.log(`[Electron Tracker] File not found (already removed): ${filePath}`);
                hasFileNotFoundError = true;
            } else {
                console.error(`Failed to delete tracked file ${filePath}:`, err);
                hasOtherError = true;
            }
        }
    }

    // Remove from tracker if:
    // - File not found (already gone), OR
    // - No other errors occurred
    // If other errors occurred, don't remove from tracker so user can retry
    const shouldRemoveFromTracker = hasFileNotFoundError || !hasOtherError;
    
    if (shouldRemoveFromTracker && itemIndex !== -1) {
        items.splice(itemIndex, 1);
        await fs.writeFile(getTrackerPath(), JSON.stringify(items, null, 2), "utf-8");
        console.log(`[Electron Tracker] Removed mod ${id} from tracker`);
    } else if (hasOtherError) {
        console.log(`[Electron Tracker] Keeping mod ${id} in tracker due to deletion errors`);
    }
    
    return true;
};