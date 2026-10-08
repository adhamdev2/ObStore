import { Router, Request, Response } from "express";
import { sendHomeDownloadWebhook } from "../lib/webhooks";

const router = Router();

router.post("/track", async (req: Request, res: Response): Promise<void> => {
    try {
        const ip = req.ip || (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || "Unknown";
        const userAgent = Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"] || "Unknown";
        const referer = Array.isArray(req.headers.referer) ? req.headers.referer[0] : (req.headers.referer || req.headers.referrer) || "Unknown";
        
        const authenticated = !!(req as any).user?.id;
        const userId = authenticated ? (req as any).user?.id : undefined;
        const username = authenticated ? (req as any).user?.username : undefined;

        await sendHomeDownloadWebhook({
            ip,
            userAgent,
            referer,
            authenticated,
            userId,
            username,
        });

        res.json({ success: true });
    } catch (error) {
        console.error("[Home Download Track] Error:", error);
        res.status(500).json({ error: "Failed to track download" });
    }
});

export default router;