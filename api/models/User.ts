import { JsonDatabase } from "../lib/jsonDb";

export interface UserSettings {
    theme: "light" | "dark" | "system";
    language: string;
    notifications: boolean;
    fivemDir: string;
}

type LegacyUserSettings = Partial<UserSettings> & {
    fivemPath?: string;
};

export interface UserDownload {
    id: string;
    name: string;
    version: string;
    type: "mod" | "version";
    modType?: string;
    date: string;
    files?: string[];
}

export interface ModLicenseStub {
    modId: string;
    licenseKey: string;
    version: string;
    type?: string;
    hwid?: string;
    expiresAt: number;
}

export interface UserRecord {
    discordId: string;
    username: string;
    avatar?: string;
    settings: UserSettings;
    downloads: UserDownload[];
    code?: string;
    roleName?: string;
    activationCode?: string;
    versions: string[];
    lastSync?: string;
    isPremium?: boolean;
    createdAt: Date;
    updatedAt: Date;
    modLicenses?: ModLicenseStub[];
    hwid?: string;
    suspended?: boolean;
}

export const UserDB = new JsonDatabase<UserRecord, "discordId">("users.json", "discordId");

export function normalizeUserSettings(settings?: LegacyUserSettings): UserSettings {
    const fallback: UserSettings = {
        theme: "dark",
        language: "en",
        notifications: true,
        fivemDir: ""
    };

    if (!settings) return fallback;

    let rawPath = settings.fivemDir ?? settings.fivemPath ?? "";
    
    // Handle case where fivemDir might be an object (e.g., { path: "..." } or { error: "..." })
    if (typeof rawPath === "object" && rawPath !== null) {
        const obj = rawPath as Record<string, unknown>;
        if ("path" in obj && typeof obj.path === "string") {
            rawPath = obj.path;
        } else if ("error" in obj) {
            rawPath = "";
        } else {
            rawPath = "";
        }
    }
    
    let cleanPath = String(rawPath).trim();

    if (cleanPath) {
        cleanPath = cleanPath
            .replace(/\*.*$/, "")
            .replace(/[\\/]?FiveM\.app[\\/]?$/i, "")
            .replace(/[\\/]+$/, "");
    }

    return {
        theme: (settings.theme === "light" || settings.theme === "dark") ? settings.theme : fallback.theme,
        language: settings.language || fallback.language,
        notifications: settings.notifications ?? fallback.notifications,
        fivemDir: cleanPath
    };
}
