import { Request, Response, NextFunction } from "express";
import { UserDB } from "../models/User";
import { sendHwidAlertWebhook } from "../lib/webhooks";

const hwidAlertCache = new Map<string, number>();

export const requireHwid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const hwid = req.headers["x-device-hwid"] as string || req.body?.hwid;

        const user = await UserDB.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        // If NO HWID provided in request
        if (!hwid) {
            // If user has no HWID registered yet, allow (web user or first login)
            if (!user.hwid) {
                next();
                return;
            }
            // User has HWID registered but didn't provide one
            res.status(400).json({ 
                error: "Device HWID required",
                code: "HWID_REQUIRED"
            });
            return;
        }

        // HWID provided in request
        // If user has no HWID registered, register this one
        if (!user.hwid) {
            const existingUser = await UserDB.findOne(u => u.hwid === hwid && u.discordId !== userId);
            if (existingUser) {
                res.status(409).json({ 
                    error: "This device is already linked to another account",
                    code: "HWID_CONFLICT"
                });
                return;
            }
            user.hwid = hwid;
            user.updatedAt = new Date();
            await UserDB.update(userId, user);
            next();
            return;
        }

        // Check if HWID matches
        if (user.hwid === hwid) {
            next();
            return;
        }

        // HWID mismatch - check if this HWID belongs to another user
        const otherUser = await UserDB.findOne(u => u.hwid === hwid);

        // Send webhook alert (rate limited to once per 30 minutes per user)
        const cacheKey = `${userId}:${hwid}`;
        const lastAlert = hwidAlertCache.get(cacheKey);
        const now = Date.now();
        
        if (!lastAlert || now - lastAlert > 30 * 60 * 1000) {
            hwidAlertCache.set(cacheKey, now);
            
            // Get client info
            const ip = req.ip || req.headers["x-forwarded-for"] as string || "Unknown";
            const userAgent = req.headers["user-agent"] || "Unknown";

            await sendHwidAlertWebhook({
                user: {
                    id: user.discordId,
                    username: user.username,
                    avatar: user.avatar,
                    roleName: user.roleName,
                },
                registeredHwid: user.hwid,
                attemptedHwid: hwid,
                otherUser: otherUser ? { id: otherUser.discordId, username: otherUser.username } : null,
                ip,
                userAgent,
            });
        }

        if (otherUser) {
            res.status(403).json({ 
                error: "This device is linked to a different account",
                code: "HWID_MISMATCH"
            });
            return;
        }

        // Unknown HWID for this account
        res.status(403).json({ 
            error: "This device is not authorized for your account",
            code: "HWID_UNAUTHORIZED"
        });
    } catch (error) {
        console.error("[HWID Middleware] Error:", error);
        res.status(500).json({ error: "HWID verification failed" });
    }
};