import { Router, Request, Response } from "express";
import { getActivisionRoles, getUserClientRole } from "../../client/helpers/getUserActivisionRoles";
import { UserDB, normalizeUserSettings } from "../models/User";
import { syncUserAccess } from "../services/syncService";
import { requireAuth } from "../middleware/auth";
import { sendLoginWebhook } from "../lib/webhooks";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const router = Router();

const LAUNCHER_REDIRECT_SCHEME = "fivem-launcher://login-success";

const getConfig = () => {
    const {
        JWT_SECRET,
        DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET,
        DISCORD_REDIRECT_URI: ENV_REDIRECT_URI,
        NODE_ENV,
        NEXT_PUBLIC_API_BASE_URL,
        VITE_API_BASE_URL
    } = process.env;

    if (!JWT_SECRET || !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        throw new Error("Missing required environment variables for Auth");
    }

    const rawApiBaseUrl = NEXT_PUBLIC_API_BASE_URL || VITE_API_BASE_URL || "";
    const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "");
    const DISCORD_REDIRECT_URI = ENV_REDIRECT_URI || (apiBaseUrl ? `${apiBaseUrl}/auth/discord/callback` : "");

    return { JWT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, isProduction: NODE_ENV === "production" };
};

const config = getConfig();

const DiscordService = {
    async exchangeCodeForToken(code: string): Promise<string> {
        const params = new URLSearchParams({
            client_id: config.DISCORD_CLIENT_ID,
            client_secret: config.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: config.DISCORD_REDIRECT_URI
        });

        const { data } = await axios.post("https://discord.com/api/oauth2/token", params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        return data.access_token;
    },

    async getUserInfo(accessToken: string) {
        const { data } = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return data;
    }
};

router.get("/discord/login", (req: Request, res: Response) => {
    if (!config.DISCORD_REDIRECT_URI) {
        return res.status(500).json({ error: "Configuration Error: Missing Redirect URI" });
    }

    const scopes = encodeURIComponent(["identify", "guilds"].join(" "));
    const redirectUri = encodeURIComponent(config.DISCORD_REDIRECT_URI);
    const url = `https://discord.com/api/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

    res.redirect(url);
});

router.get("/discord/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ error: "Authorization code is required" });

    try {
        const accessToken = await DiscordService.exchangeCodeForToken(code);
        const userData = await DiscordService.getUserInfo(accessToken);

        const results = await Promise.allSettled([
            getActivisionRoles(userData.id),
            getUserClientRole(userData.id)
        ]);

        const activisionRoles = results[0].status === 'fulfilled' ? (results[0].value as string[] | []) : [];
        const clientRole = results[1].status === 'fulfilled' ? (results[1].value as string | null) : null;
        
        const safeActivisionRoles = Array.isArray(activisionRoles) ? activisionRoles : [];
        const existingUser = await UserDB.findById(userData.id);
        const userUpdateData: any = {
            username: userData.username,
            avatar: userData.avatar,
            roleName: clientRole,
            versions: safeActivisionRoles,
            updatedAt: new Date()
        };

        if (existingUser) {
            await UserDB.update(userData.id, userUpdateData);
        } else {
            await UserDB.insert({
                discordId: userData.id,
                ...userUpdateData,
                settings: normalizeUserSettings(),
                downloads: [],
                createdAt: new Date()
            });
        }

        // Generate stateless JWT Token instead of memory Session
        const token = jwt.sign(
            { id: userData.id, username: userData.username, avatar: userData.avatar },
            config.JWT_SECRET,
            { expiresIn: '7d' } 
        );

        console.log(`[Auth Callback] 🔑 JWT Generated Successfully!`);
        console.log(`[Auth Callback] Token start: ${token.substring(0, 20)}...`);

        sendLoginWebhook({
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            roleName: clientRole,
            versions: safeActivisionRoles,
        });

        // Force encoded token for redirection
        const encodedToken = encodeURIComponent(token);
        const redirectUrl = `${LAUNCHER_REDIRECT_SCHEME}?token=${encodedToken}`;
        
        console.log(`[Auth Callback] 🚀 Redirecting to: ${redirectUrl.split('?')[0]}?token=REDARKED`);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error("[Auth] Discord OAuth Error:", error);
        res.status(500).json({ error: "Authentication failed. Please try again." });
    }
});

// We use requireAuth directly here inline or we can call the central middleware

router.get("/me", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await UserDB.findById(userId);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const forceRefresh = req.query.refresh === "true";
        // Perform real-time sync with 30s buffer unless forced
        const updatedUser = await syncUserAccess(userId, forceRefresh);
        const userToReturn = updatedUser || user;

        res.json({
            id: userToReturn.discordId,
            username: userToReturn.username,
            avatar: userToReturn.avatar,
            settings: normalizeUserSettings(userToReturn.settings),
            versions: Array.isArray(userToReturn.versions) ? userToReturn.versions : [],
            roleName: userToReturn.roleName,
            downloads: userToReturn.downloads || [],
            suspended: userToReturn.suspended || false
        });

    } catch (err: any) {
        console.error("[Auth] Sync Error:", err.message);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

router.post("/logout", (req: Request, res: Response) => {
    res.json({ success: true, message: "Logged out successfully" });
});

export default router;
