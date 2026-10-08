import { Router, Request, Response, NextFunction } from "express";
import { UserDB } from "../models/User";

const router = Router();

// Middleware to check admin secret
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers["x-admin-secret"];
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "sk_admin_2f8a9c3e7d1b4f6a";
    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

router.use(requireAdmin);

// Get all app users
router.get("/users", async (req, res) => {
    try {
        const users = await UserDB.findAll();
        const appUsers = users.map(u => ({
            id: u.discordId,
            name: u.username,
            username: u.username,
            email: "N/A", // Not stored in UserDB usually
            discordId: u.discordId,
            discordAvatar: u.avatar || "",
            online: false, // will be handled by WS
            hardwareId: u.hwid || null,
            suspended: !!u.suspended,
            version: u.versions && u.versions.length > 0 ? u.versions[0] : "1.0.0",
            created_at: u.createdAt
        }));
        res.json({ users: appUsers });
    } catch (e) {
        res.status(500).json({ error: "Failed to get users" });
    }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await UserDB.delete(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// Suspend user
router.post("/users/:id/suspend", async (req, res) => {
    try {
        const { id } = req.params;
        const { suspend } = req.body;
        const user = await UserDB.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });
        await UserDB.update(id, { suspended: suspend, updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to suspend user" });
    }
});

// Unbind hardware
router.post("/users/:id/hardware/unbind", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserDB.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });
        await UserDB.update(id, { hwid: undefined, updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to unbind hardware" });
    }
});


// Update hardware
router.post("/users/:id/hardware/update", async (req, res) => {
    try {
        const { id } = req.params;
        const { hardwareId } = req.body;
        if (!hardwareId || typeof hardwareId !== 'string' || hardwareId.trim().length === 0) {
            return res.status(400).json({ error: "Invalid hardware ID" });
        }
        const user = await UserDB.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });
        await UserDB.update(id, { hwid: hardwareId.trim(), updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to update hardware" });
    }
});

import { updateWsServer } from '../services/updateWsServer';

router.get('/online', (req, res) => {
    res.json({ online: updateWsServer.getOnlineHwids() });
});

export default router;

