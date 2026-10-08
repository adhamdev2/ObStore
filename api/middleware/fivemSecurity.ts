import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../lib/config";

const usedNonces = new Map<string, number>();

function constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function canonicalize(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}

function reject(res: Response): void {
    res.status(401).json({ error: "Request rejected" });
}

export function requireFivemRequest(req: Request, res: Response, next: NextFunction) {
    const authorization = req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const nonce = req.header("x-request-nonce") || "";
    const timestamp = Number(req.header("x-request-timestamp"));
    const signature = req.header("x-request-signature") || "";
    const now = Math.floor(Date.now() / 1000);

    if (!token || !nonce || !Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > config.FIVEM_CLOCK_SKEW_SECONDS || nonce.length < 16 || nonce.length > 128) {
        return reject(res);
    }

    let claims: jwt.JwtPayload & { sid?: string; licenseId?: string; hwidHash?: string; userId?: string; kind?: string };
    try {
        claims = jwt.verify(token, config.JWT_SECRET, { issuer: "fivemModes" }) as typeof claims;
    } catch {
        return reject(res);
    }

    if (!claims.sid || claims.kind !== "fivem" || !claims.licenseId || !claims.hwidHash || !claims.userId) return reject(res);

    const replayKey = `${claims.sid}:${nonce}`;
    for (const [key, expiresAt] of usedNonces) if (expiresAt <= now) usedNonces.delete(key);
    if (usedNonces.has(replayKey)) return reject(res);

    const canonical = [req.method, req.originalUrl, timestamp, nonce, canonicalize(req.body ?? {})].join("\n");
    const expected = crypto.createHmac("sha256", token).update(canonical).digest("hex");
    if (!constantTimeEqual(signature, expected)) return reject(res);

    usedNonces.set(replayKey, now + config.FIVEM_CLOCK_SKEW_SECONDS);
    req.fivemSession = { sessionId: claims.sid, licenseId: claims.licenseId, hwidHash: claims.hwidHash, userId: claims.userId };
    next();
}

export function hashHwid(hwid: string): string {
    return crypto.createHash("sha256").update(hwid).digest("hex");
}

export function signFivemPayload(payload: unknown): string {
    return crypto.createHmac("sha256", config.FIVEM_HMAC_SECRET).update(canonicalize(payload)).digest("hex");
}

export { canonicalize };
