import type { NextFunction, Request, Response } from "express";
import { config } from "../lib/config";

const UPDATE_API_TOKEN = process.env.UPDATE_API_TOKEN || process.env.API_TOKEN;

export function requireUpdateAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.status(401).json({ error: "Authorization header required" });
        return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        res.status(401).json({ error: "Invalid authorization format. Use: Bearer <token>" });
        return;
    }

    const token = parts[1].replace(/^["']|["']$/g, "");

    if (!UPDATE_API_TOKEN) {
        console.error("[UpdateAuth] UPDATE_API_TOKEN not configured on server");
        res.status(500).json({ error: "Server configuration error" });
        return;
    }

    if (token !== UPDATE_API_TOKEN) {
        console.warn("[UpdateAuth] Invalid token attempt from:", req.ip);
        res.status(403).json({ error: "Invalid API token" });
        return;
    }

    next();
}

export function optionalUpdateAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
            const token = parts[1].replace(/^["']|["']$/g, "");
            if (token === UPDATE_API_TOKEN) {
                (req as any).isAdmin = true;
            }
        }
    }
    next();
}

export default { requireUpdateAuth, optionalUpdateAuth };