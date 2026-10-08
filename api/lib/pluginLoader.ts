import fs from "fs/promises";
import path from "path";

export type AvailableMod = {
    id: string;
    name: string;
    description: string;
    version: string | string[];
    available: boolean;
    category: string;
    image: string;
    archiveFile: string | null;
    modVersion: string;
};

export type ModArchiveInfo = {
    pluginId: string;
    archiveFileName: string;
    archivePath: string;
    type: string;
    pluginDir: string;
    version: string | string[];
    modVersion: string;
};

function resolveFromApiRoot(...segments: string[]) {
    const directPath = path.resolve(__dirname, "..", ...segments);
    const builtPath = path.resolve(__dirname, "..", "..", ...segments);
    return path.normalize(directPath).includes(`${path.sep}build${path.sep}`) ? builtPath : directPath;
}

async function getImageUrl(pluginPath: string, type: string, pluginId: string) {
    const imageNames = [
        "logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "logo.gif",
        "image.png", "image.jpg", "image.jpeg", "image.webp", "image.gif"
    ];
    for (const imageName of imageNames) {
        const imagePath = path.join(pluginPath, imageName);
        try {
            await fs.access(imagePath);
            return `/api/plugins/${type}/${encodeURIComponent(pluginId)}/${encodeURIComponent(imageName)}`;
        } catch {
            continue;
        }
    }
    return null;
}

export async function getAvailableMods(type: string = "versions"): Promise<AvailableMod[]> {
    const pluginsDir = resolveFromApiRoot("data", "plugins", type);
    const mods: AvailableMod[] = [];

    try {
        await fs.access(pluginsDir);
    } catch {
        return [];
    }

    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginId = entry.name;
        const pluginPath = path.join(pluginsDir, pluginId);

        try {
            const configPathTs = path.join(pluginPath, "config.ts");
            const configText = await fs.readFile(configPathTs, "utf-8").catch(() => null);
            const config: Partial<AvailableMod> = {};

            if (configText) {
                const nameMatch = configText.match(/\bname:\s*['"`]([^'"`]+)['"`]/);
                if (nameMatch) config.name = nameMatch[1];

                const arrayMatch = configText.match(/\bversion:\s*\[([\s\S]*?)\]/);
                if (arrayMatch) {
                    config.version = arrayMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
                } else {
                    const stringMatch = configText.match(/\bversion:\s*['"`]([^'"`]+)['"`]/);
                    if (stringMatch) config.version = stringMatch[1];
                }

                const descMatch = configText.match(/\bdescription:\s*['"`]([^'"`]+)['"`]/);
                if (descMatch) config.description = descMatch[1];

                const categoryMatch = configText.match(/\bcategory:\s*['"`]([^'"`]+)['"`]/);
                if (categoryMatch) config.category = categoryMatch[1];

                const availableMatch = configText.match(/\bavailable:\s*(true|false)/i);
                if (availableMatch) config.available = availableMatch[1].toLowerCase() === "true";

                const modVersionMatch = configText.match(/\bmodVersion:\s*['"`]([^'"`]+)['"`]/);
                if (modVersionMatch) config.modVersion = modVersionMatch[1];
            }

            if (!config.name) continue;

            const image = await getImageUrl(pluginPath, type, pluginId);

            mods.push({
                id: pluginId,
                name: config.name || pluginId,
                description: config.description || "",
                version: config.version || "1.0",
                available: config.available ?? true,
                category: config.category || type,
                image: image || "",
                archiveFile: "ob-store.com.zip",
                modVersion: config.modVersion || "1.0" 
            });
        } catch (error) {
            console.error(`[PluginLoader] Error reading ${type} plugin ${pluginId}:`, error);
        }
    }

    return mods;
}

export async function getModArchiveInfo(pluginId: string, type?: string): Promise<ModArchiveInfo | null> {
    const searchTypes = type ? [type] : ["versions", "mods", "plugins"];
    
    for (const searchType of searchTypes) {
        const pluginsDir = resolveFromApiRoot("data", "plugins", searchType);
        const pluginPath = path.join(pluginsDir, pluginId);

        try {
            await fs.access(pluginPath);
            
            let version: string | string[] = "1.0";
            try {
                const configPathTs = path.join(pluginPath, "config.ts");
                const configText = await fs.readFile(configPathTs, "utf-8");
                const arrayMatch = configText.match(/\bversion:\s*\[([\s\S]*?)\]/);
                if (arrayMatch) {
                    version = arrayMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
                } else {
                    const stringMatch = configText.match(/\bversion:\s*['"`]([^'"`]+)['"`]/);
                    if (stringMatch) version = stringMatch[1];
                }
            } catch {}

            let modVersion = "1.0"
            try {
                const configPathTs = path.join(pluginPath, "config.ts");
                const configText = await fs.readFile(configPathTs, "utf-8");
                const versionMatch = configText.match(/\bmodVersion:\s*(?:['"`]([^'"]+)['"]|[\[\s*['"`]([^'"]+)['"](?:\s*,\s*['"`]([^'"]+)['"])* \s*\])/);
                if (versionMatch) {
                    if (versionMatch[1]) modVersion = versionMatch[1];
                    else if (versionMatch[2]) modVersion = versionMatch[2];
                }
            } catch {}

            return {
                pluginId,
                archiveFileName: "download.zip",
                archivePath: "", 
                type: searchType,
                pluginDir: pluginPath,
                version,
                modVersion
            };
        } catch {
            continue;
        }
    }

    return null;
}

export async function getValidVersionNames(): Promise<string[]> {
    try {
        const codesPath = resolveFromApiRoot("data", "codes.json");
        const codesText = await fs.readFile(codesPath, "utf-8");
        const codes = JSON.parse(codesText);
        return Object.keys(codes);
    } catch (error) {
        console.error("[PluginLoader] Error reading codes.json:", error);
        return ["v1", "v1.5", "v2", "v3", "v4", "v5", "v6"];
    }
}