import { UserDB, UserRecord } from "../models/User";
import { getActivisionRoles, getUserClientRole } from "../../client/helpers/getUserActivisionRoles";

/**
 * Ensures user permissions (Discord roles) are up to date.
 * Implements a 30-second cache to prevent hammering Discord API.
 */
export async function syncUserAccess(userId: string, force: boolean = false): Promise<UserRecord | null> {
    try {
        const user = await UserDB.findById(userId);
        if (!user) return null;

        const now = new Date();
        const lastSync = user.lastSync ? new Date(user.lastSync) : new Date(0);
        
        // 5-second buffer for faster testing feedback
        const diffMs = now.getTime() - lastSync.getTime();
        if (!force && diffMs < 5 * 1000) {
            return user;
        }

        console.log(`[Sync Service] 🔄 Refreshing Discord roles for ${user.username} (${userId})...`);

        // Fetch latest data from Discord
        const results = await Promise.allSettled([
            getActivisionRoles(userId),
            getUserClientRole(userId)
        ]);

        const activisionRoles = results[0].status === 'fulfilled' ? results[0].value : null;
        const clientRole = results[1].status === 'fulfilled' ? (results[1].value as string | null) : null;

        if (results[0].status === 'rejected') console.error("[Sync Service] Discord Roles Fetch Rejected:", results[0].reason);
        if (results[1].status === 'rejected') console.error("[Sync Service] Client Role Fetch Rejected:", results[1].status);

        const prevVersions = Array.isArray(user.versions) ? [...user.versions] : [];
        const versionsFetchSucceeded = Array.isArray(activisionRoles);
        const safeDiscordVersions = versionsFetchSucceeded ? [...activisionRoles] : prevVersions;
        
        // An empty array is a successful lookup with no entitlement. null or a
        // rejected request means Discord was unavailable, so retain known grants.
        const versionsChanged = versionsFetchSucceeded && JSON.stringify([...prevVersions].sort()) !== JSON.stringify([...safeDiscordVersions].sort());
        const roleNameChanged = user.roleName !== clientRole;

        if (versionsChanged || roleNameChanged || !user.lastSync) {
            console.log(`[Sync Service] 💾 Updating user ${user.username}: Versions changed: ${versionsChanged}, Role changed: ${roleNameChanged}`);
            const updateData: any = {
                versions: safeDiscordVersions,
                roleName: clientRole,
                lastSync: now.toISOString(),
                updatedAt: now
            };
            
            await UserDB.update(userId, updateData);
            
            // Return updated object
            return {
                ...user,
                ...updateData
            };
        } else {
            // Just update lastSync to prevent re-syncing too soon
            await UserDB.update(userId, { lastSync: now.toISOString() });
            return { ...user, lastSync: now.toISOString() };
        }
    } catch (error: any) {
        console.error("[Sync Service] Sync Error Details:", error.message);
        // On error, return existing user data to avoid blocking access
        return UserDB.findById(userId);
    }
}
