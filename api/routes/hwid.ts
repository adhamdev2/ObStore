import { Router, type Request, type Response } from "express";
import { UserDB } from "../models/User";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { hwid } = req.body as { hwid?: string };
        const userId = (req as any).user?.discordId;

        if (!hwid) {
            res.status(400).json({ error: "HWID is required" });
            return;
        }

        const user = await UserDB.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        // Check if this HWID is already linked to another user
        const existingUser = await UserDB.findOne(u => u.hwid === hwid && u.discordId !== userId);
        if (existingUser) {
            res.status(409).json({ 
                error: "This device is already linked to another account",
                code: "HWID_CONFLICT"
            });
            return;
        }

        // Update user's HWID
        user.hwid = hwid;
        user.updatedAt = new Date();
        await UserDB.update(userId, user);

        res.json({ success: true, message: "HWID registered successfully" });
    } catch (error) {
        console.error("[HWID] Register error:", error);
        res.status(500).json({ error: "Failed to register HWID" });
    }
});

router.get("/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.discordId;
        const user = await UserDB.findById(userId);
        
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.json({ 
            hwid: user.hwid || null,
            hasHwid: !!user.hwid
        });
    } catch (error) {
        console.error("[HWID] Status error:", error);
        res.status(500).json({ error: "Failed to get HWID status" });
    }
});

router.post("/verify", requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { hwid } = req.body as { hwid?: string };
        const userId = (req as any).user?.discordId;

        if (!hwid) {
            res.status(400).json({ error: "HWID is required", allowed: false });
            return;
        }

        const user = await UserDB.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found", allowed: false });
            return;
        }

        // If user has no HWID registered, register this one
        if (!user.hwid) {
            const existingUser = await UserDB.findOne(u => u.hwid === hwid && u.discordId !== userId);
            if (existingUser) {
                res.status(409).json({ 
                    error: "This device is already linked to another account",
                    allowed: false,
                    code: "HWID_CONFLICT"
                });
                return;
            }
            user.hwid = hwid;
            user.updatedAt = new Date();
            await UserDB.update(userId, user);
            res.json({ allowed: true, message: "HWID registered" });
            return;
        }

        // Check if HWID matches
        if (user.hwid === hwid) {
            res.json({ allowed: true });
            return;
        }

        // HWID mismatch - check if this HWID belongs to another user
        const otherUser = await UserDB.findOne(u => u.hwid === hwid);
        if (otherUser) {
            res.status(403).json({ 
                error: "This device is linked to a different account",
                allowed: false,
                code: "HWID_MISMATCH"
            });
            return;
        }

        // Unknown HWID for this account
        res.status(403).json({ 
            error: "This device is not authorized for your account",
            allowed: false,
            code: "HWID_UNAUTHORIZED"
        });
    } catch (error) {
        console.error("[HWID] Verify error:", error);
        res.status(500).json({ error: "Failed to verify HWID", allowed: false });
    }
});

export default router;