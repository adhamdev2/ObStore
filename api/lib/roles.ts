export const VERSION_ROLES: Record<string, string> = {
    "1489431038882222261": "v1",
    "1489428644630761622": "v1.5",
    "1489426697706147857": "v2",
    "1489421435712704688": "v3",
    "1489416940060410048": "v4",
    "1489412729855938620": "v5",
    "1499841145893818408": "v6",
    "1407812630764064919": "OB.Guns.skin",
    "1499841422340128839": "OB.pvp",
    "1499841406267687094": "OB.real",
    "1518295016156565766": "OB.Guns.skin.v2",
};

export const VERSION_PRIORITY = ["v1", "v1.5", "v2", "v3", "v4", "v5", "v6", "OB.pvp", "OB.real", "OB.Guns.skin", "OB.Guns.skin.v2"];

export const PREMIUM_ROLES_MAP: Record<string, string> = {
    "1552635126830080020": "[OB]",
    "1452011604634767401": "ViP Client",
    "1427282181759434823": "Premium Client",
    "1402381305613647970": "Client",
};

export const PREMIUM_ROLES = Object.keys(PREMIUM_ROLES_MAP);

export function getHighestVersion(roleIds: string[]): string[] {
    if (roleIds.includes("1552635126830080020")) {
        return [...VERSION_PRIORITY];
    }

    const matchedVersions: string[] = [];

    for (const roleId of roleIds) {
        const version = VERSION_ROLES[roleId];
        if (version && !matchedVersions.includes(version)) {
            matchedVersions.push(version);
        }
    }

    return matchedVersions;
}

export function isPremiumMember(roleIds: string[]): boolean {
    return roleIds.some(roleId => PREMIUM_ROLES.includes(roleId));
}

export function getPremiumRoleName(roleIds: string[]): string {
    const priority = ["1552635126830080020", "1452011604634767401", "1427282181759434823", "1402381305613647970"];
    
    for (const roleId of priority) {
        if (roleIds.includes(roleId)) {
            return PREMIUM_ROLES_MAP[roleId];
        }
    }
    
    return "User";
}