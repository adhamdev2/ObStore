import { app, BrowserWindow, shell, session, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { registerIpcHandlers } from "./ipc/index.js";
import squirrelStartup from "electron-squirrel-startup";
import { createCleanupHandlers, cleanupAllSecureSessions } from "./services/SecurityManager.js";
import { updateService } from "./services/UpdateService.js";

// Setup logging early
const isDev = !app.isPackaged;
const logDir = path.join(app.getPath("userData"), "logs");
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "main.log");

function writeLog(level: "log" | "error" | "warn", ...args: any[]) {
    const msg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")}\n`;
    fs.appendFileSync(logFile, msg);
    if (isDev) {
        if (level === "log") originalLog(...args);
        else if (level === "error") originalError(...args);
        else if (level === "warn") originalWarn(...args);
    }
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
console.log = (...args) => writeLog("log", ...args);
console.error = (...args) => writeLog("error", ...args);
console.warn = (...args) => writeLog("warn", ...args);

if (squirrelStartup) app.quit();

createCleanupHandlers();

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

writeLog("log", `=== App Starting ===`);
writeLog("log", `Version: ${app.getVersion()}`);
writeLog("log", `Platform: ${process.platform} ${process.arch}`);
writeLog("log", `isDev: ${isDev}`);

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
const frontendUrl = isDev ? "https://ob1.store" : (process.env.FRONTEND_URL || "https://ob1.store");
const PROTOCOL = "fivem-launcher";

// ─── Splash helpers ───────────────────────────────────────────────────────────
function sendSplashProgress(progress: number, message: string) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send("splash-progress", {
            progress,
            message,
            version: app.getVersion()
        });
    }
}

function closeSplashAndShowMain() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSize(1800, 900);
        mainWindow.center();
        mainWindow.show();
        mainWindow.focus();
    }
}

// ─── Splash window ────────────────────────────────────────────────────────────
function createSplashWindow() {
    const iconPath = path.join(__dirname, "../app.ico");
    splashWindow = new BrowserWindow({
        width: 340,
        height: 420,
        frame: false,
        transparent: false,
        resizable: false,
        center: true,
        show: false,
        icon: iconPath,
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, "splash-preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        title: "OB Store"
    });

    splashWindow.loadFile(path.join(__dirname, "splash.html"));
    splashWindow.once("ready-to-show", () => {
        splashWindow?.show();
        // Start progress animation immediately
        sendSplashProgress(10, "Starting...");
    });
}

// ─── Main window ──────────────────────────────────────────────────────────────
function createWindow() {
    const iconPath = path.join(__dirname, "../app.ico");

    // Start small and hidden — will expand after loading
    mainWindow = new BrowserWindow({
        width: 1800,
        height: 900,
        show: false,           // stays hidden until splash is done
        autoHideMenuBar: true,
        frame: false,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: false,
        },
        title: "ob"
    });

    mainWindow.setMenuBarVisibility(false);

    sendSplashProgress(25, "Loading interface...");

    mainWindow.loadURL(frontendUrl).catch(() => {
        setTimeout(() => mainWindow?.loadURL(frontendUrl), 2000);
    });

    // Preload routes after first load
    mainWindow.webContents.once("did-finish-load", () => {
        sendSplashProgress(60, "Loading pages...");

        // Pre-warm all routes by navigating to them in the background
        const routes = ["/mods", "/download", "/settings"];
        let routeIndex = 0;
        const progressPerRoute = 30 / routes.length;

        const preloadNext = () => {
            if (routeIndex >= routes.length) {
                // All routes loaded — go back to home and show app
                sendSplashProgress(98, "Almost ready...");
                mainWindow?.webContents.executeJavaScript(`
                    if (window.__nextRouter) {
                        window.__nextRouter.prefetch('/');
                    }
                `).catch(() => {});
                setTimeout(() => {
                    sendSplashProgress(100, "Ready!");
                    setTimeout(closeSplashAndShowMain, 300);
                }, 400);
                return;
            }

            const route = routes[routeIndex];
            const progress = 60 + (routeIndex + 1) * progressPerRoute;
            const labels: Record<string, string> = {
                "/mods": "Loading versions...",
                "/download": "Loading mods...",
                "/settings": "Loading settings..."
            };

            sendSplashProgress(Math.round(progress), labels[route] || "Loading...");

            // Use Next.js router prefetch via JS injection (stays on same page)
            mainWindow?.webContents.executeJavaScript(`
                (async () => {
                    try {
                        const { default: router } = await import('next/dist/client/router');
                        await router.prefetch('${route}');
                    } catch(e) {
                        // Try via window if module import fails
                        if (window.next?.router?.prefetch) {
                            await window.next.router.prefetch('${route}');
                        }
                    }
                })().catch(() => {})
            `).catch(() => {});

            routeIndex++;
            // Small delay between routes to not hammer the server
            setTimeout(preloadNext, 600);
        };

        preloadNext();
    });

    // Fallback: if loading takes too long, show app anyway after 12s
    const fallbackTimer = setTimeout(() => {
        writeLog("warn", "[Splash] Fallback timeout — showing main window");
        sendSplashProgress(100, "Ready!");
        closeSplashAndShowMain();
    }, 12000);

    mainWindow.once("ready-to-show", () => {
        clearTimeout(fallbackTimer);
        updateService.initialize(mainWindow!, process.env.API_BASE);
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url.includes("/auth/discord/login")) {
            event.preventDefault();
            const authWindow = new BrowserWindow({
                width: 500,
                height: 800,
                parent: mainWindow || undefined,
                modal: true,
                show: false,
                icon: path.join(__dirname, "../app.ico"),
                frame: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                },
                title: "Discord Login"
            });

            authWindow.setMenuBarVisibility(false);
            authWindow.once("ready-to-show", () => authWindow.show());

            authWindow.webContents.on("will-redirect", (event, newUrl) => {
                if (newUrl.startsWith(`${PROTOCOL}://`)) {
                    event.preventDefault();
                    handleDeepLink(newUrl);
                    authWindow.close();
                }
            });

            authWindow.webContents.on("will-navigate", (event, newUrl) => {
                if (newUrl.startsWith(`${PROTOCOL}://`)) {
                    event.preventDefault();
                    handleDeepLink(newUrl);
                    authWindow.close();
                }
            });

            authWindow.loadURL(url).catch(err => console.error("Discord Auth Window Error:", err));
        }
    });
}

// ─── Deep link ────────────────────────────────────────────────────────────────
async function handleDeepLink(rawUrl: string) {
    if (!rawUrl || !rawUrl.startsWith(`${PROTOCOL}://`)) return;

    if (!mainWindow) {
        createWindow();
    } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }

    try {
        const url = new URL(rawUrl.replace(/\/$/, ""));
        const token = url.searchParams.get("token");
        if (token) {
            const decodedToken = decodeURIComponent(token);
            console.log(`[Main] Sending auth token to frontend via IPC...`);
            mainWindow?.webContents.send("auth-success", decodedToken);
        }
    } catch (err) {
        console.error("Deep link error:", err);
    }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", (event, commandLine) => {
        const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
        if (url) handleDeepLink(url);
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        registerIpcHandlers();

        if (isDev) {
            const electronExe = process.execPath;
            const appPath = path.resolve(process.cwd());
            app.setAsDefaultProtocolClient(PROTOCOL, electronExe, [appPath]);
        } else {
            app.setAsDefaultProtocolClient(PROTOCOL);
        }

        const isRegistered = app.isDefaultProtocolClient(PROTOCOL);
        console.log(`[Main] Protocol ${PROTOCOL} registration status: ${isRegistered}`);
        if (!isRegistered && process.platform === "win32") {
            console.warn(`[Main] Warning: Protocol ${PROTOCOL} is not registered.`);
        }

        // Show splash first, then start loading main window
        createSplashWindow();
        // Small delay so splash renders before heavier work starts
        setTimeout(() => createWindow(), 300);

        const initialUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
        if (initialUrl) handleDeepLink(initialUrl);
    });
}

app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

let cleanupBeforeQuitStarted = false;
let allowQuitAfterCleanup = false;
app.on("before-quit", event => {
    if (allowQuitAfterCleanup) return;
    event.preventDefault();
    if (cleanupBeforeQuitStarted) return;
    cleanupBeforeQuitStarted = true;
    updateService.destroy();
    void cleanupAllSecureSessions().finally(() => {
        allowQuitAfterCleanup = true;
        app.quit();
    });
});

process.on("uncaughtException", (err) => {
    writeLog("error", "[UNCAUGHT EXCEPTION]", err.stack || err);
});
process.on("unhandledRejection", (reason) => {
    writeLog("error", "[UNHANDLED REJECTION]", reason);
});
