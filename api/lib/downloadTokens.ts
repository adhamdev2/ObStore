import crypto from "crypto";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

export type DownloadTokenPayload = {
    downloadId: string;
    modId: string;
    userId: string;
    type?: string;
};

export function createDownloadId() {
    return crypto.randomUUID();
}

export function signDownloadToken(payload: DownloadTokenPayload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "5m" });
}

export function verifyDownloadToken(token: string): DownloadTokenPayload {
    return jwt.verify(token, JWT_SECRET) as DownloadTokenPayload;
}
