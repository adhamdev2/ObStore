import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config";

const JWT_SECRET = config.JWT_SECRET;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    let token: string | null = null;
    
    console.log(`\n--- [Auth Middleware] Request mapping to: ${req.originalUrl} ---`);
    console.log(`[Auth Middleware] Incoming Headers:`, { 
        authorization: req.headers.authorization ? "Present" : "Missing",
        cookie: req.headers.cookie ? "Present" : "Missing",
        origin: req.headers.origin,
        host: req.headers.host
    });

    // Only source of truth: Bearer Token from Authorization Header
    if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        } else {
            console.log(`[Auth Middleware] ⚠️ Malformed Authorization header found.`);
        }
    }

    // SANITIZATION: Remove accidental wrapping quotes
    if (token && typeof token === 'string') {
        token = token.replace(/^["']|["']$/g, '');
        
        // 🚨 CRITICAL: Explicitly reject legacy session strings
        if (token.startsWith('s:') || token.startsWith('s%3A')) {
            console.warn(`[Auth Middleware] 🛑 Rejecting legacy session string in Authorization header.`);
            return res.status(401).json({ error: "Legacy session detected. Please log in again." });
        }
    }

    console.log(`[Auth Middleware] Resolution:`, token ? `Token Found (Start: ${token.substring(0, 10)}...)` : 'No Token Found');

    if (!token) {
        console.log(`[Auth Middleware] ❌ Access Denied: Missing Bearer token in Authorization header.`);
        return res.status(401).json({ error: "Not authenticated: Missing Bearer token" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        // Verify decoded token has user payload
        if (!decoded || !decoded.id) {
            console.log(`[Auth Middleware] ❌ Access Denied: Invalid JWT payload.`);
            return res.status(401).json({ error: "Not authenticated: Invalid payload" });
        }

        req.user = {
            id: decoded.id,
            username: decoded.username
        };
        console.log(`[Auth Middleware] ✅ Access Granted for User ID: ${req.user.id}`);
        next();
    } catch (err: any) {
        console.warn(`[Auth Middleware] ❌ Invalid token:`, err.message);
        return res.status(401).json({ error: "Not authenticated: Token expired or invalid" });
    }
}
