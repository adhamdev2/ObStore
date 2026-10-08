import { config } from "./lib/config";
import { getDataPath } from "./lib/paths";
import { errorHandler } from "./middleware/errorHandler";
import { updateWsServer } from "./services/updateWsServer";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import routes from "./routes";

let botProcess: ChildProcess | null = null;

const BOT_PID_FILE = path.resolve(__dirname, "..", "client", ".bot.pid");

function killExistingBot() {
    try {
        if (fs.existsSync(BOT_PID_FILE)) {
            const pid = parseInt(fs.readFileSync(BOT_PID_FILE, "utf-8").trim(), 10);
            if (!isNaN(pid)) {
                try {
                    process.kill(pid, "SIGTERM");
                    console.log(`[Bot] Killed existing bot process (PID: ${pid})`);
                } catch (e) {
                    // Process might not exist anymore
                }
            }
            fs.unlinkSync(BOT_PID_FILE);
        }
    } catch (e) {
        // Ignore errors
    }
}

function writeBotPid(pid: number) {
    try {
        fs.writeFileSync(BOT_PID_FILE, String(pid), "utf-8");
    } catch (e) {
        console.error("[Bot] Failed to write PID file:", e);
    }
}

function removeBotPid() {
    try {
        if (fs.existsSync(BOT_PID_FILE)) {
            fs.unlinkSync(BOT_PID_FILE);
        }
    } catch (e) {
        // Ignore
    }
}

function startBot() {
    if (botProcess) {
        console.log("[Bot] Bot is already running, skipping...");
        return;
    }

    // Kill any existing bot process
    killExistingBot();

    const isDev = config.NODE_ENV !== "production";
    const clientDir = path.resolve(__dirname, "..", "client");

    const command = isDev ? "npx" : "node";
    const args = isDev
        ? ["tsx", "index.ts"]
        : ["build/index.js"];

    console.log(`🤖 [Bot] Starting bot in ${isDev ? "development" : "production"} mode...`);

    botProcess = spawn(command, args, {
        cwd: clientDir,
        stdio: "inherit",
        shell: true,
    });

    if (botProcess.pid) {
        writeBotPid(botProcess.pid);
    }

    botProcess.on("error", (err) => {
        console.error("❌ [Bot] Failed to start bot process:", err.message);
    });

    botProcess.on("exit", (code, signal) => {
        console.warn(`⚠️ [Bot] Bot process exited with code ${code}, signal ${signal}`);
        botProcess = null;
        removeBotPid();

        // Auto-restart after 5 seconds if it crashes
        if (code !== 0 && code !== null) {
            console.log("🔄 [Bot] Restarting bot in 5 seconds...");
            setTimeout(startBot, 5000);
        }
    });

    console.log(`✅ [Bot] Bot process spawned (PID: ${botProcess.pid})`);
}

function stopBot() {
    if (botProcess && botProcess.pid) {
        console.log("🛑 [Bot] Stopping bot process...");
        botProcess.kill("SIGTERM");
        botProcess = null;
        removeBotPid();
    }
}

// Graceful shutdown
process.on("SIGINT", () => {
    stopBot();
    updateWsServer.stop();
    process.exit(0);
});

process.on("SIGTERM", () => {
    stopBot();
    updateWsServer.stop();
    process.exit(0);
});

// Kill existing bot on startup
killExistingBot();

export async function application(port: number) {
    const app = express();
    
    // Trust reverse proxy (e.g., Nginx, Cloudflare) for rate limiting
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '2000mb' }));
    app.use(express.urlencoded({ limit: '2000mb', extended: true }));

    // Security Headers
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
    }));

    // Allow CORS for enterprise needs
    app.use(cors({
        origin: function (origin, callback) {
            const allowedOrigins = [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "https://ob1.store",
                "https://www.ob1.store",
                "https://api.ob1.store",
                "null"
            ];

            // Allow if no origin (e.g. mobile apps, curl) or if strictly matching allowed
            if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith("file://") || origin.startsWith("fivem-launcher")) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        exposedHeaders: ["X-Archive-Size", "Content-Length"]
    }));

    app.use(cookieParser());
    app.use(express.json());
    app.set("json space", 3);

    // Logging Middleware
    app.use((req, res, next) => {
        if (process.env.NODE_ENV !== "production") {
            console.log(`[API] ${req.method} ${req.url}`);
        }
        next();
    });

    const pluginsDir = getDataPath("plugins");
    app.use("/api/plugins", express.static(pluginsDir));

    app.use("/api", routes);
    app.use("/", routes);

    // Centralized Error Handling
    app.use(errorHandler);

    const server = app.listen(port, () => {
        console.log("Enterprise API server is running on port ");
        startBot();
        updateWsServer.start(server);
    });
}

application(config.PORT).catch(err => {
    console.log(`[Main] Using Port from Context: ${config.PORT}`);
    console.error("Failed to start API:", err);
});

