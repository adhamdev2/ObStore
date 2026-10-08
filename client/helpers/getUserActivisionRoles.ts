import { client } from "../index";

const roles = {
    "v1": "1489431038882222261",
    "v1.5": "1489428644630761622",
    "v2": "1489426697706147857",
    "v3": "1489421435712704688",
    "v4": "1489416940060410048",
    "v5": "1489412729855938620",
    "v6": "1499841145893818408",
    "v7": "1538185318141005905",
}

const clientRoles = {
    "[OB]": "1552635126830080020",
    "ViP Client": "1452011604634767401",
    "Premium Client": "1427282181759434823",
    "Client": "1402381305613647970",
}

const PRODUCT_ROLES = {
    "OB.real": "1499841406267687094",
    "OB.pvp": "1499841422340128839",
    "OB.Guns.skin": "1407812630764064919",
    "OB.Guns.skin.v2": "1518295016156565766",
}

// Each product grants these roles:
const PRODUCT_GRANTS: Record<string, string[]> = {
    "OB.real": [
        clientRoles["Client"],
        PRODUCT_ROLES["OB.real"],
        roles["v6"],
        roles["v5"],
        roles["v4"],
        roles["v2"],
        PRODUCT_ROLES["OB.Guns.skin"],  // guns pack v1 or guns pack
    ],
    "OB.pvp": [
        clientRoles["Client"],
        PRODUCT_ROLES["OB.pvp"],
        roles["v3"],
        roles["v1.5"],
        roles["v1"],
        PRODUCT_ROLES["OB.Guns.skin"],  // guns pack v1 or guns pack
    ],
    "OB.Guns.skin.v2": [
        clientRoles["Client"],
        PRODUCT_ROLES["OB.Guns.skin.v2"],
    ],
}

export const getActivisionRoles = async (userId: string): Promise<string[] | null> => {
    const guild = (client as any).guild;
    if (!guild) return null;
    try {
        const member = await guild.members.fetch(userId);
        if (!member) return null;

        const matchedVersions: string[] = [];
        const versionList = Object.keys(roles);

        const hasRole = (roleId: string) => member.roles.cache.has(roleId);

        if (hasRole(clientRoles["[OB]"])) {
            return [...versionList, "OB.Guns.skin", "OB.pvp", "OB.real", "OB.Guns.skin.v2"];
        }

        const hasOBReal = hasRole(PRODUCT_ROLES["OB.real"]);
        const hasOBPvp = hasRole(PRODUCT_ROLES["OB.pvp"]);
        const hasGunsSkinV2 = hasRole(PRODUCT_ROLES["OB.Guns.skin.v2"]);

        const rolesToAdd: string[] = [];

        if (hasOBReal) {
            const needed = PRODUCT_GRANTS["OB.real"].filter(id => !hasRole(id));
            rolesToAdd.push(...needed);
        } else if (hasOBPvp) {
            const needed = PRODUCT_GRANTS["OB.pvp"].filter(id => !hasRole(id));
            rolesToAdd.push(...needed);
        } else if (hasGunsSkinV2) {
            const needed = PRODUCT_GRANTS["OB.Guns.skin.v2"].filter(id => !hasRole(id));
            rolesToAdd.push(...needed);
        }

        if (rolesToAdd.length > 0) {
            try {
                await member.roles.add(rolesToAdd);
                rolesToAdd.forEach(roleId => member.roles.cache.set(roleId, {} as any));
                console.log(`[Discord Sync] Auto-assigned roles to ${member.user.tag}: ${rolesToAdd.join(", ")}`);
            } catch (err) {
                console.error(`[Discord Sync] Failed to auto-assign roles:`, err);
            }
        }

        for (const version of versionList) {
            const roleId = (roles as any)[version];
            if (member.roles.cache.has(roleId)) {
                matchedVersions.push(version);
            }
        }

        if (member.roles.cache.has(PRODUCT_ROLES["OB.Guns.skin"]) && !matchedVersions.includes("OB.Guns.skin")) {
            matchedVersions.push("OB.Guns.skin");
        }
        if (member.roles.cache.has(PRODUCT_ROLES["OB.pvp"]) && !matchedVersions.includes("OB.pvp")) {
            matchedVersions.push("OB.pvp");
        }
        if (member.roles.cache.has(PRODUCT_ROLES["OB.real"]) && !matchedVersions.includes("OB.real")) {
            matchedVersions.push("OB.real");
        }
        if (member.roles.cache.has(PRODUCT_ROLES["OB.Guns.skin.v2"]) && !matchedVersions.includes("OB.Guns.skin.v2")) {
            matchedVersions.push("OB.Guns.skin.v2");
        }

        return matchedVersions;
    } catch (error) {
        console.error("[Discord Helper] getActivisionRoles Error:", error);
        const discordError = error as { code?: number; status?: number };
        // A missing guild member is a successful entitlement revocation. For
        // rate limits, network failures, or Discord outages, preserve cached roles.
        if (discordError?.code === 10007 || discordError?.status === 404) return [];
        return null;
    }
}

export const getUserClientRole = async (userId: string): Promise<string | null> => {
    const guild = (client as any).guild;
    if (!guild) return null;
    try {
        const member = await guild.members.fetch(userId);
        if (!member) return null;

        const priority = ["[OB]", "ViP Client", "Premium Client", "Client"];

        for (const roleName of priority) {
            const roleId = (clientRoles as any)[roleName];
            if (member.roles.cache.has(roleId)) {
                return roleName;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

export const assignUserRoles = async (userId: string, version: string): Promise<{ success: boolean; message: string }> => {
    const guild = (client as any).guild;
    if (!guild) return { success: false, message: "Guild not found" };

    try {
        const member = await guild.members.fetch(userId);
        if (!member) return { success: false, message: "Member not found" };

        const versionRoleId = (roles as any)[version] || (PRODUCT_ROLES as any)[version];
        if (!versionRoleId) return { success: false, message: `Invalid version: ${version}` };

        const clientRoleId = clientRoles["Client"];
        const addedRoles: string[] = [];

        if (!member.roles.cache.has(versionRoleId)) {
            await member.roles.add(versionRoleId);
            addedRoles.push(version);
        }

        if (!member.roles.cache.has(clientRoleId)) {
            await member.roles.add(clientRoleId);
            addedRoles.push("Client");
        }

        if (addedRoles.length === 0) {
            return { success: true, message: "User already has both roles" };
        }

        return { success: true, message: `Added roles: ${addedRoles.join(", ")}` };
    } catch (error) {
        return { success: false, message: "Failed to assign roles" };
    }
}
