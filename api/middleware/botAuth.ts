import type { NextFunction, Request, Response } from "express";

const BOT_API_KEY = process.env.BOT_API_KEY;

export function requireBotAuth(req: Request, res: Response, next: NextFunction) {
    if (!BOT_API_KEY) {
        console.error("[Bot Auth] BOT_API_KEY is not configured");
        return res.status(500).json({ error: "Bot API not configured" });
    }

    const apiKey = req.headers["x-bot-api-key"];

    if (!apiKey || apiKey !== BOT_API_KEY) {
        return res.status(403).json({ error: "Invalid or missing bot API key" });
    }

    next();
}
