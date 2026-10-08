import dotenv from "dotenv";
import path from "path";
import { getDataPath } from "./paths";

// Initialize environment variables ASAP
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.dev";

// Load from root and api directory to ensure coverage
dotenv.config({ path: path.resolve(process.cwd(), "..", envFile) }); // Root .env/.env.dev
dotenv.config({ path: path.resolve(process.cwd(), envFile) });      // api/.env/.env.dev
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export const config = {
    PORT: Number(process.env.PORT) || 3004,
    JWT_SECRET: process.env.JWT_SECRET || "",
    FIVEM_LICENSES_JSON: process.env.FIVEM_LICENSES_JSON || "{}",
    FIVEM_HMAC_SECRET: process.env.FIVEM_HMAC_SECRET || "",
    FIVEM_CLOCK_SKEW_SECONDS: Number(process.env.FIVEM_CLOCK_SKEW_SECONDS) || 30,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || "",
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || "",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV || "development"
};

if (config.NODE_ENV === "production" && (!config.JWT_SECRET || !config.FIVEM_HMAC_SECRET)) {
    throw new Error("JWT_SECRET and FIVEM_HMAC_SECRET are required in production");
}

if (!config.JWT_SECRET) {
    console.warn("[Config] JWT_SECRET is not configured; authentication routes are not safe to deploy.");
}

export default config;
