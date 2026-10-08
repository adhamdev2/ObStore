import { ipcMain, dialog, shell, BrowserWindow, app, net } from "electron"

// Map to track active download abort controllers for cancellation support
const downloadAbortControllers = new Map<string, AbortController>();
import path from "path"
import os from "os"
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile, copyFile, rmdir } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { resolveExistingPath } from "../utils/fs.js"
import { runHiddenExecutable } from "../utils/exec.js"
import { extractArchiveWindows, installExtractedModDirectories } from "../services/archive.js"
import { getInstalledItems, saveInstalledItem, uninstallItem, ensureTrackerData, getTrackerPath } from "../services/tracker.js"
import { createSecureSession, decryptAes256Gcm, cleanupSecureSession, holdExclusiveReadHandle, writeSecureFile } from "../services/SecurityManager.js"
import { ProcessWatchdog } from "../services/ProcessWatchdog.js"
import { getStableHwid } from "../services/Hwid.js"
import { createJunction, removeJunction } from "../services/SecurityManager.js"
import crypto from "crypto"
import { updateService } from "../services/UpdateService.js"

const execAsync = promisify(exec)

async function hideFiveMFolders(fivemPath: string): Promise<void> {
    try {
        const { resolveExistingPath } = await import("../utils/fs.js")
        const resolvedPath = await resolveExistingPath(fivemPath)
        if (!resolvedPath) return

        let fiveMRoot = resolvedPath
        if (path.extname(resolvedPath).toLowerCase() === ".exe") {
            fiveMRoot = path.dirname(resolvedPath)
        }
        if (path.basename(fiveMRoot).toLowerCase() === "fivem.app") {
            fiveMRoot = path.dirname(fiveMRoot)
        }

        const fiveMAppDir = path.join(fiveMRoot, "FiveM.app")
        const foldersToHide = ["mods", "plugins", "citizen"]

        for (const folder of foldersToHide) {
            const folderPath = path.join(fiveMAppDir, folder)
            try {
                await execAsync(`attrib +h +s "${folderPath}"`, { windowsHide: true })
                console.log(`[HideFolders] Hidden: ${folderPath}`)
            } catch (e) {
                console.log(`[HideFolders] Could not hide ${folderPath}:`, e)
            }
        }
    } catch (error) {
        console.error("[HideFolders] Error:", error)
    }
}

const secureWatchdog = new ProcessWatchdog()
type ActiveSecureSession = {
    session: Awaited<ReturnType<typeof createSecureSession>>
    junctionPath: string
    sessionName: string
    authToken?: string
}
let activeSecureSession: ActiveSecureSession | null = null
let secureLaunchInProgress = false
let secureCleanupInProgress = false
let activeSecureHandles: import("fs/promises").FileHandle[] = []

type DownloadModArchivePayload = {
    url?: string
    archivePath?: string
    targetPath?: string
    modId?: string
    modName?: string
    type?: "version" | "modpack"
    installDirectories?: string[]
    skipDeletion?: boolean
    downloadId?: string
}

export function registerIpcHandlers(): void {
    // The renderer tracks progress in memory. A fresh page load starts with an
    // empty snapshot and then receives new progress events.
    ipcMain.handle("get-active-downloads", () => ({}));

    ipcMain.handle("cancel-download", (_event, downloadId?: string) => {
        if (downloadId) {
            const controller = downloadAbortControllers.get(downloadId);
            if (controller) {
                controller.abort();
                downloadAbortControllers.delete(downloadId);
                console.log(`[Download] Cancelled download: ${downloadId}`);
            }
        } else {
            // Cancel all downloads
            for (const [id, controller] of downloadAbortControllers) {
                controller.abort();
                console.log(`[Download] Cancelled download: ${id}`);
            }
            downloadAbortControllers.clear();
        }
        return { success: true };
    });

    ipcMain.handle("select-folder", async (_event, defaultPath?: string) => {
        // Note: app.getPath('localAppData') is cleaner if available, but let's try to be robust. 
        // Actually Electron has app.getPath('localAppData') which is exactly what we want.

        const result = await dialog.showOpenDialog({
            properties: ["openDirectory"],
            defaultPath: app.getPath("appData").replace("Roaming", "Local") + "\\FiveM"
        })
        if (result.canceled) return null
        return result.filePaths[0]
    })

    ipcMain.on("window-minimize", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) win.minimize()
    })

    ipcMain.on("window-maximize", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize()
            } else {
                win.maximize()
            }
        }
    })

    ipcMain.on("window-close", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) win.close()
    })

    ipcMain.handle("select-file", async (event, options?: { extensions?: string[] }) => {
        const filters = options?.extensions ? [{ name: "Allowed Files", extensions: options.extensions }] : []
        const result = await dialog.showOpenDialog({ properties: ["openFile"], filters })
        if (result.canceled) return null
        return result.filePaths[0]
    })

    ipcMain.handle("select-fivem-exe", async (_event) => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "FiveM Executable", extensions: ["exe"] }],
            defaultPath: app.getPath("appData").replace("Roaming", "Local") + "\\FiveM"
        })
        if (result.canceled) return null
        const selectedPath = result.filePaths[0];
        if (path.extname(selectedPath).toLowerCase() !== ".exe") {
            return { error: "Please select an executable file (.exe)" };
        }
        return { path: selectedPath };
    })

    ipcMain.handle("get-auto-fivem-path", async () => {
        const appData = app.getPath("appData");
        const localAppData = process.platform === "win32" 
            ? appData.replace("Roaming", "Local")
            : appData;
        
        const possiblePaths = [
            path.join(localAppData, "FiveM"),
            path.join(localAppData, "FiveM", "FiveM.exe"),
            path.join(appData.replace("Roaming", "Local"), "FiveM"),
            path.join(appData.replace("Roaming", "Local"), "FiveM", "FiveM.exe"),
        ];

        for (const p of possiblePaths) {
            const { resolveExistingPath } = await import("../utils/fs.js");
            const resolved = await resolveExistingPath(p);
            if (resolved) {
                return resolved;
            }
        }
        return null;
    });

    ipcMain.handle("path-exists", async (_event, targetPath?: string) => {
        if (!targetPath?.trim()) return false;
        const { resolveExistingPath } = await import("../utils/fs.js");
        return Boolean(await resolveExistingPath(targetPath));
    });

    // Cache HWID at the process level — the PowerShell hardware query is
    // expensive (~1-2 s). Running it once per Electron process lifetime
    // is enough; hard refresh re-runs this but page navigation does not.
    let _cachedHwid: string | null = null;
    ipcMain.handle("get-hwid", async () => {
        if (_cachedHwid) return _cachedHwid;
        _cachedHwid = await getStableHwid();
        return _cachedHwid;
    });

    ipcMain.handle("save-mod-stub", async (_event, payload: { modId: string; licenseKey: string; version: string; type?: string }) => {
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(payload?.modId || "") || !/^OB1-LICENSE-[A-Z0-9]+$/.test(payload?.licenseKey || "")) {
            throw new Error("Invalid mod license stub");
        }
        const type = ["versions", "mods", "plugins"].includes(payload.type || "") ? payload.type : undefined;
        const root = path.join(app.getPath("userData"), "mod-stubs");
        const destination = type
            ? path.join(root, type, payload.modId, "mod_config.json")
            : path.join(root, payload.modId, "mod_config.json");
        await mkdir(path.dirname(destination), { recursive: true });
        const config = { mod_id: payload.modId, license_key: payload.licenseKey, version: payload.version, ...(type ? { type } : {}) };
        await writeFile(destination, JSON.stringify(config, null, 2), { encoding: "utf8", flag: "w" });
        const saved = JSON.parse(await readFile(destination, "utf8"));
        if (saved.mod_id !== config.mod_id || saved.license_key !== config.license_key || saved.version !== config.version) {
            throw new Error("The license config was written but could not be verified");
        }
        return { path: destination };
    });

    ipcMain.handle("read-mod-stub", async (_event, modId: string, requestedType?: string) => {
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(modId || "")) throw new Error("Invalid mod id");
        const type = ["versions", "mods", "plugins"].includes(requestedType || "") ? requestedType : undefined;
        const root = path.join(app.getPath("userData"), "mod-stubs");
        const expectedPath = type ? path.join(root, type, modId, "mod_config.json") : path.join(root, modId, "mod_config.json");
        const legacyPath = path.join(root, modId, "mod_config.json");
        const isValidStub = (value: any) => value && value.mod_id === modId && typeof value.license_key === "string" && /^OB1-LICENSE-[A-Z0-9]+$/.test(value.license_key) && typeof value.version === "string" && (!type || !value.type || value.type === type);

        try {
            const expected = JSON.parse(await readFile(expectedPath, "utf8"));
            if (isValidStub(expected)) return expected as { mod_id: string; license_key: string; version: string; type?: string };
        } catch (error: any) {
            if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }

        if (type && legacyPath !== expectedPath) {
            try {
                const legacy = JSON.parse(await readFile(legacyPath, "utf8"));
                if (isValidStub(legacy)) {
                    const migrated = { ...legacy, type };
                    await mkdir(path.dirname(expectedPath), { recursive: true });
                    await writeFile(expectedPath, JSON.stringify(migrated, null, 2), "utf8");
                    return migrated as { mod_id: string; license_key: string; version: string; type?: string };
                }
            } catch (error: any) {
                if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
            }
        }

        // Older builds used inconsistent folder/file names. Search the full
        // stub tree and trust the mod_id stored inside the JSON, not its name.
        const candidates: { filePath: string; modifiedAt: number }[] = [];
        const scan = async (directory: string, depth: number): Promise<void> => {
            if (depth > 3) return;
            let entries;
            try { entries = await readdir(directory, { withFileTypes: true }); }
            catch (error: any) { if (error?.code === "ENOENT") return; throw error; }
            for (const entry of entries) {
                const candidatePath = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    await scan(candidatePath, depth + 1);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
                    const statResult = await stat(candidatePath).catch(() => null);
                    if (statResult) candidates.push({ filePath: candidatePath, modifiedAt: statResult.mtimeMs });
                }
            }
        };
        await scan(root, 0);
        candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
        for (const candidate of candidates) {
            try {
                const found = JSON.parse(await readFile(candidate.filePath, "utf8"));
                if (!isValidStub(found)) continue;
                const recovered = { ...found, ...(type && !found.type ? { type } : {}) };
                const destinationPath = recovered.type && ["versions", "mods", "plugins"].includes(recovered.type)
                    ? path.join(root, recovered.type, modId, "mod_config.json")
                    : expectedPath;
                await mkdir(path.dirname(destinationPath), { recursive: true });
                await writeFile(destinationPath, JSON.stringify(recovered, null, 2), "utf8");
                const verified = JSON.parse(await readFile(destinationPath, "utf8"));
                if (!isValidStub(verified)) throw new Error("Recovered license config failed verification");
                return verified as { mod_id: string; license_key: string; version: string; type?: string };
            } catch (error: any) {
                if (error?.code === "ENOENT" || error instanceof SyntaxError) continue;
                throw error;
            }
        }
        throw new Error(`No saved license config found for mod '${modId}'. Download it again in the launcher.`);
    });

    ipcMain.handle("download-mod-archive", async (event, payload?: DownloadModArchivePayload) => {
        const downloadId = payload?.downloadId || `dl_${Date.now()}`;
        // Register abort controller for cancellation support
        const abortController = new AbortController();
        downloadAbortControllers.set(downloadId, abortController);

        try {
            const url = payload?.url?.trim();
            const rawTargetPath = payload?.targetPath?.trim();
            const installDirectories = payload?.installDirectories;

            if (!rawTargetPath) throw new Error("Missing target path");

        console.log(`[Download] rawTargetPath: ${rawTargetPath}`);
        console.log(`[Download] installDirectories: ${JSON.stringify(installDirectories)}`);

        let targetDirectory = rawTargetPath;
        const ext = path.extname(rawTargetPath).toLowerCase();
        if (ext === ".exe") {
            targetDirectory = path.dirname(rawTargetPath);
            console.log(`[Download] rawTargetPath is exe file, using parent dir: ${targetDirectory}`);
        } else if (ext === "") {
            console.log(`[Download] rawTargetPath is directory: ${targetDirectory}`);
        } else {
            targetDirectory = path.dirname(rawTargetPath);
            console.log(`[Download] rawTargetPath has extension ${ext}, using parent dir: ${targetDirectory}`);
        }

        if (!installDirectories?.length) throw new Error("Missing install directories");
        
        const expectedDirs = ["mods", "plugins", "citizen"];
        for (const expected of expectedDirs) {
            const found = installDirectories.some(d => d.toLowerCase().includes(expected.toLowerCase()));
            if (!found) {
                console.warn(`[Download] WARNING: Missing ${expected} directory in installDirectories`);
            }
        }

        await mkdir(targetDirectory, { recursive: true });
        const fileName = url ? path.basename(new URL(url).pathname) : null;

        if (!fileName) throw new Error("Missing archive file name");

        await mkdir(targetDirectory, { recursive: true });
        const destinationPath = path.join(targetDirectory, fileName);

        if (!url) throw new Error("Missing URL");

        // Step 1: Check server support for Range requests
        let headResponse;
        try {
            headResponse = await net.fetch(url, {
                method: "HEAD",
                headers: { "User-Agent": "FiveM-Launcher/1.0" }
            });
        } catch (fetchErr: any) {
            throw new Error(`Connection to update server failed (${fetchErr?.message || String(fetchErr)})`);
        }

        let totalBytes = Number(headResponse.headers.get("content-length") || headResponse.headers.get("x-archive-size") || 0);
        const supportsRange = headResponse.headers.get("accept-ranges") === "bytes";

        const { createWriteStream } = await import("fs");

        // If server supports Range and file is large enough, use chunked download
        if (supportsRange && totalBytes > 512 * 1024) {
            const CHUNK_COUNT = Math.min(8, Math.max(2, Math.ceil(totalBytes / (1024 * 1024))));
            const chunkSize = Math.ceil(totalBytes / CHUNK_COUNT);
            const tmpDir = await mkdtemp(path.join(os.tmpdir(), "dl-chunks-"));

            console.log(`[Download] Chunked mode: ${CHUNK_COUNT} chunks of ~${(chunkSize / 1024 / 1024).toFixed(1)}MB`);

            let downloadedBytes = 0;
            let lastReportTime = 0;
            const speedWindow: { time: number; bytes: number }[] = [];

let finalProgressSent = false;

            const reportProgress = () => {
                const now = Date.now();
                speedWindow.push({ time: now, bytes: downloadedBytes });
                if (speedWindow.length > 20) speedWindow.shift();

                let speed = 0;
                if (speedWindow.length >= 2) {
                    const first = speedWindow[0];
                    const last = speedWindow[speedWindow.length - 1];
                    const timeDiff = (last.time - first.time) / 1000;
                    if (timeDiff > 0) speed = (last.bytes - first.bytes) / timeDiff;
                }

                // Throttle to 250ms to prevent log spam
                // Only send 100% once
                if (downloadedBytes === totalBytes) {
                    if (finalProgressSent) return;
                    finalProgressSent = true;
                }
                if (now - lastReportTime > 250 || downloadedBytes === totalBytes) {
                    lastReportTime = now;
                    const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
                    event.sender.send("download-progress", {
                        downloadId,
                        progress,
                        modName: payload?.modName,
                        downloadedBytes,
                        totalBytes,
                        speed,
                        chunks: CHUNK_COUNT,
                        status: "downloading"
                    });
                }
            };

            // Download all chunks in parallel
            const chunkPromises = Array.from({ length: CHUNK_COUNT }, async (_, i) => {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize - 1, totalBytes - 1);
                const chunkPath = path.join(tmpDir, `chunk_${i}`);
                const chunkFile = createWriteStream(chunkPath);

                const res = await net.fetch(url, {
                    headers: {
                        "Range": `bytes=${start}-${end}`,
                        "User-Agent": "FiveM-Launcher/1.0"
                    }
                });

                if (!res.ok && res.status !== 206) {
                    throw new Error(`Chunk ${i} failed: ${res.status}`);
                }

                const reader = res.body?.getReader();
                if (!reader) throw new Error(`Failed to get reader for chunk ${i}`);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunkFile.write(value);
                    downloadedBytes += value.length;
                    reportProgress();
                }

                chunkFile.end();
                await new Promise<void>((resolve) => chunkFile.on("finish", () => resolve()));
                return chunkPath;
            });

            const chunkPaths = await Promise.all(chunkPromises);

            // Merge chunks into final file
            const finalStream = createWriteStream(destinationPath);
            for (const chunkPath of chunkPaths) {
                const data = await import("fs/promises").then(m => m.readFile(chunkPath));
                finalStream.write(data);
            }
            finalStream.end();
            await new Promise<void>((resolve) => finalStream.on("finish", () => resolve()));

            // Cleanup chunks
            await rm(tmpDir, { recursive: true, force: true });

            // Final progress
            event.sender.send("download-progress", {
                downloadId,
                progress: 100,
                modName: payload?.modName,
                downloadedBytes: totalBytes,
                totalBytes,
                speed: 0,
                chunks: CHUNK_COUNT,
                status: "merging"
            });

        } else {
            // Single-stream fallback
            console.log(`[Download] Single-stream mode: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);

            let response;
            try {
                response = await net.fetch(url, {
                    headers: { "User-Agent": "FiveM-Launcher/1.0", "Accept": "*/*" }
                });
            } catch (fetchErr: any) {
                throw new Error(`Connection to update server failed (${fetchErr?.message || String(fetchErr)})`);
            }

            if (!response.ok) throw new Error(`Download failed: ${response.status}`);

            const getContentLength = Number(response.headers.get("content-length") || response.headers.get("x-archive-size") || 0);
            if (getContentLength > totalBytes) {
                totalBytes = getContentLength;
            }

            let downloadedBytes = 0;
            let lastReportTime = 0;
            const speedWindow: { time: number; bytes: number }[] = [];
            let finalProgressSent = false;

            const reader = response.body?.getReader();
            if (!reader) throw new Error("Failed to get download reader");

            const fileStream = createWriteStream(destinationPath);

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    fileStream.write(value);
                    downloadedBytes += value.length;

                    const now = Date.now();
                    speedWindow.push({ time: now, bytes: downloadedBytes });
                    if (speedWindow.length > 20) speedWindow.shift();

                    let speed = 0;
                    if (speedWindow.length >= 2) {
                        const first = speedWindow[0];
                        const last = speedWindow[speedWindow.length - 1];
                        const timeDiff = (last.time - first.time) / 1000;
                        if (timeDiff > 0) speed = (last.bytes - first.bytes) / timeDiff;
                    }

                    if (now - lastReportTime > 250 || downloadedBytes === totalBytes) {
                        if (downloadedBytes === totalBytes && finalProgressSent) {
                            // Already sent final progress, skip
                        } else {
                            if (downloadedBytes === totalBytes) finalProgressSent = true;
                            lastReportTime = now;
                            const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : Math.min(99, downloadedBytes / 1024 / 1024 * 10);
                            event.sender.send("download-progress", {
                                downloadId,
                                progress,
                                modName: payload?.modName,
                                downloadedBytes,
                                totalBytes,
                                speed,
                                chunks: 1,
                                status: "downloading"
                            });
                        }
                    }
                }
            } finally {
                fileStream.end();
                await new Promise<void>((resolve) => fileStream.on("finish", () => resolve()));
            }
        }
        
        // Final progress is already sent in the loop when downloadedBytes === totalBytes
        // No need to send again

        if (!installDirectories?.length) throw new Error("Missing install directories");

        console.log(`[Download] Installing to directories: ${JSON.stringify(installDirectories)}`);
        const extractionRoot = await mkdtemp(path.join(os.tmpdir(), "fivem-mod-"));
        let installedFiles: string[] = [];

        try {
            const archiveStats = await stat(destinationPath);
            if (!archiveStats.isFile()) throw new Error("Downloaded archive is invalid");

            await extractArchiveWindows(destinationPath, extractionRoot);
            installedFiles = await installExtractedModDirectories(extractionRoot, installDirectories, payload?.skipDeletion);
            if (installedFiles.length === 0) {
                throw new Error("The mod archive contained no files to install. Check the mod files on the server.");
            }
        } finally {
            await rm(extractionRoot, { recursive: true, force: true });
            await rm(destinationPath, { force: true });
        }

        if (payload?.modId && installedFiles.length > 0) {
            await saveInstalledItem({
                id: payload.modId,
                name: payload.modName || fileName,
                type: payload.type || "version",
                files: installedFiles,
                fivemPath: rawTargetPath
            });
        }

        // Hide mods, plugins, citizen folders after installation
        await hideFiveMFolders(rawTargetPath)

        return { fileName, destinationPath, modName: payload?.modName || fileName, installedFiles };
        } finally {
            downloadAbortControllers.delete(downloadId);
        }
    });

    ipcMain.handle("download-rpf-files", async (event, payload: { files: { url: string; fileName: string; size: number }[]; targetPath: string; modId?: string; modName?: string; type?: "version" | "modpack"; targetSubDir?: string; downloadId?: string }) => {
        console.log(`[Electron] download-rpf-files called with targetPath: ${payload.targetPath}, targetSubDir: ${payload.targetSubDir}`);
        const { files, targetPath, modName, targetSubDir = "mods", downloadId } = payload;

        if (!targetPath) throw new Error("Missing target path");
        if (!files || files.length === 0) throw new Error("No files to download");

        const { resolveExistingPath } = await import("../utils/fs.js");
        const resolvedPath = await resolveExistingPath(targetPath);
        if (!resolvedPath) throw new Error("Invalid FiveM path");

        const modsDir = path.extname(resolvedPath) ? path.dirname(resolvedPath) : resolvedPath;
        const finalModsDir = path.basename(modsDir).toLowerCase() === "fivem.app"
            ? path.join(modsDir, targetSubDir)
            : path.join(modsDir, "FiveM.app", targetSubDir);

        await mkdir(finalModsDir, { recursive: true });

        const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
let downloadedBytes = 0;
            let lastReportTime = 0;
            const speedWindow: { time: number; bytes: number }[] = [];
            let finalProgressSent = false;

        const { createWriteStream } = await import("fs");
        const installedFiles: string[] = [];

        for (const file of files) {
            const destinationPath = path.join(finalModsDir, file.fileName);
            const fetchUrl = file.url.startsWith("http") ? file.url : `https://api.ob1.store${file.url}`;

            const response = await net.fetch(fetchUrl, {
                headers: { "User-Agent": "FiveM-Launcher/1.0", "Accept": "*/*" }
            });

            if (!response.ok) throw new Error(`Download of ${file.fileName} failed: ${response.status}`);

            const reader = response.body?.getReader();
            if (!reader) throw new Error(`Failed to initialize reader for ${file.fileName}`);

            const fileStream = createWriteStream(destinationPath);

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    fileStream.write(value);
                    downloadedBytes += value.length;

                    const now = Date.now();
                    speedWindow.push({ time: now, bytes: downloadedBytes });
                    if (speedWindow.length > 20) speedWindow.shift();

                    let speed = 0;
                    if (speedWindow.length >= 2) {
                        const first = speedWindow[0];
                        const last = speedWindow[speedWindow.length - 1];
                        const timeDiff = (last.time - first.time) / 1000;
                        if (timeDiff > 0) speed = (last.bytes - first.bytes) / timeDiff;
                    }

                    if (now - lastReportTime > 250 || downloadedBytes === totalBytes) {
                        lastReportTime = now;
                        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : Math.min(99, downloadedBytes / 1024 / 1024 * 10);
                        event.sender.send("download-progress", {
                            downloadId,
                            progress,
                            modName: modName || file.fileName,
                            downloadedBytes,
                            totalBytes,
                            speed,
                            chunks: 1,
                            status: "downloading"
                        });
                    }
                }
            } finally {
                fileStream.end();
                await new Promise<void>((resolve) => fileStream.on("finish", () => resolve()));
            }
            installedFiles.push(destinationPath);
        }

        if (payload.modId && installedFiles.length > 0) {
            await saveInstalledItem({
                id: payload.modId,
                name: modName || "Mods",
                type: payload.type || "modpack",
                files: installedFiles,
                fivemPath: targetPath
            });
        }

        // Hide folders after RPF files download
        await hideFiveMFolders(targetPath)

        return { modName: modName || "Mods", installedFiles };
    });



    ipcMain.handle("install-local-mod", async (event, payload: { sourcePath: string; targetFivemPath: string }) => {
        console.log(`[Electron] install-local-mod called with targetFivemPath: ${payload.targetFivemPath}`);
        const { sourcePath, targetFivemPath } = payload;

        if (!sourcePath || !targetFivemPath) throw new Error("Missing source or target path");

        const { resolveExistingPath } = await import("../utils/fs.js");
        const resolvedPath = await resolveExistingPath(targetFivemPath);
        if (!resolvedPath) throw new Error("Invalid FiveM path");

        const modsDir = path.extname(resolvedPath) ? path.dirname(resolvedPath) : resolvedPath;
        const finalModsDir = path.basename(modsDir).toLowerCase() === "fivem.app"
            ? path.join(modsDir, "mods")
            : path.join(modsDir, "FiveM.app", "mods");

        await mkdir(finalModsDir, { recursive: true });

        const fileName = path.basename(sourcePath);
        const destinationPath = path.join(finalModsDir, fileName);

        await copyFile(sourcePath, destinationPath);

        const modId = "local_" + Date.now();
        await saveInstalledItem({
            id: modId,
            name: fileName,
            type: "modpack",
            files: [destinationPath],
            fivemPath: targetFivemPath
        });

        // Hide folders after local mod installation
        await hideFiveMFolders(targetFivemPath)

        return {
            modId,
            fileName,
            destinationPath,
            installedFiles: [destinationPath]
        };
    })

    ipcMain.handle("write-file", async (_event, payload: { path: string; data: number[] }) => {
        const { path: filePath, data } = payload;
        if (!filePath || !data) throw new Error("Missing path or data");
        
        try {
            const buffer = Buffer.from(data);
            await writeFile(filePath, buffer);
            return { success: true };
        } catch (error) {
            console.error("Failed to write file:", error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    })

    ipcMain.handle("install-dropped-file", async (_event, payload: { fileName: string; data: number[]; targetFivemPath: string }) => {
        const { fileName, data, targetFivemPath } = payload;
        if (!fileName || !data || !targetFivemPath) throw new Error("Missing parameters");
        
        try {
            const { resolveExistingPath } = await import("../utils/fs.js");
            const resolvedPath = await resolveExistingPath(targetFivemPath);
            if (!resolvedPath) throw new Error("Invalid FiveM path");

            const modsDir = path.extname(resolvedPath) ? path.dirname(resolvedPath) : resolvedPath;
            const finalModsDir = path.basename(modsDir).toLowerCase() === "fivem.app"
                ? path.join(modsDir, "mods")
                : path.join(modsDir, "FiveM.app", "mods");

            await mkdir(finalModsDir, { recursive: true });

            // Write file directly to mods folder
            const destinationPath = path.join(finalModsDir, fileName);
            const buffer = Buffer.from(data);
            await writeFile(destinationPath, buffer);

            const modId = "drop_" + Date.now();
            await saveInstalledItem({
                id: modId,
                name: fileName,
                type: "modpack",
                files: [destinationPath],
                fivemPath: targetFivemPath
            });

            // Hide folders after dropped file installation
            await hideFiveMFolders(targetFivemPath)

            return { success: true, destinationPath };
        } catch (error) {
            console.error("Failed to install dropped file:", error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    })

    ipcMain.handle("launch-secure-fivem", async (_event, payload: {
        executablePath: string;
        targetRoot: string;
        sessionId?: string;
        authToken?: string;
        toolPath?: string;
        input?: string;
        args?: string[];
        keyBase64: string;
        files: { relativePath: string; ciphertextBase64: string; ivBase64: string; authTagBase64: string; aadBase64?: string }[];
    }) => {
        if (process.platform !== "win32") throw new Error("Secure FiveM launch is supported on Windows only");
        if (!payload?.executablePath || !payload?.targetRoot || !payload?.keyBase64 || !Array.isArray(payload.files) || payload.files.length === 0) {
            throw new Error("Invalid secure launch payload");
        }

        if (secureLaunchInProgress || secureCleanupInProgress) throw new Error("A secure FiveM launch is already being prepared or cleaned up");
        secureLaunchInProgress = true;
        if (activeSecureSession && await secureWatchdog.isRunning()) {
            secureLaunchInProgress = false;
            throw new Error("A secure FiveM session is already active");
        }
        if (activeSecureSession) {
            const stale = activeSecureSession;
            activeSecureSession = null;
            await removeJunction(stale.junctionPath);
            for (const handle of activeSecureHandles.splice(0)) await handle.close().catch(() => undefined);
            await cleanupSecureSession(stale.session);
            if (stale.sessionName && stale.authToken) {
                await net.fetch(`https://api.ob1.store/api/mods/stage-session/${encodeURIComponent(stale.sessionName)}/terminate`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${stale.authToken}` }
                }).catch(() => undefined);
            }
        }
        const sessionName = payload.sessionId && /^[a-f0-9-]{36}$/i.test(payload.sessionId) ? payload.sessionId : crypto.randomUUID();
        const junctionPath = path.join(payload.targetRoot, "mods", `temp_${sessionName}`);
        let session: Awaited<ReturnType<typeof createSecureSession>> | null = null;
        let sessionKey: Buffer | null = null;
        try {
            const createdSession = await createSecureSession(`ob1_staging_${sessionName}_`);
            session = createdSession;
            const active: ActiveSecureSession = { session: createdSession, junctionPath, sessionName: payload.sessionId || "", authToken: payload.authToken };
            activeSecureSession = active;
            const key = Buffer.from(payload.keyBase64, "base64");
            if (key.length !== 32) throw new Error("Invalid staging encryption key");
            sessionKey = key;
            for (const file of payload.files) {
            const relativePath = file.relativePath.replace(/^(mods|plugins|citizen)[\\/]/i, "");
                const decrypted = decryptAes256Gcm({
                    ciphertext: Buffer.from(file.ciphertextBase64, "base64"),
                    iv: Buffer.from(file.ivBase64, "base64"),
                    authTag: Buffer.from(file.authTagBase64, "base64")
                }, key, file.aadBase64 ? Buffer.from(file.aadBase64, "base64") : undefined);
                const filePath = await writeSecureFile(createdSession, relativePath, decrypted);
                activeSecureHandles.push(await holdExclusiveReadHandle(filePath));
                decrypted.fill(0);
            }
            await createJunction(createdSession.root, junctionPath);

            await secureWatchdog.launch({
                executablePath: payload.executablePath,
                args: payload.args,
                onExit: async () => {
                    if (activeSecureSession !== active) return;
                    secureCleanupInProgress = true;
                    try {
                        await removeJunction(junctionPath);
                        for (const handle of activeSecureHandles.splice(0)) await handle.close().catch(() => undefined);
                        await cleanupSecureSession(createdSession);
                        if (payload.sessionId && payload.authToken) {
                            await net.fetch(`https://api.ob1.store/api/mods/stage-session/${encodeURIComponent(payload.sessionId)}/terminate`, {
                                method: "POST",
                                headers: { Authorization: `Bearer ${payload.authToken}` }
                            }).catch(() => undefined);
                        }
                    } finally {
                        if (activeSecureSession === active) activeSecureSession = null;
                        secureCleanupInProgress = false;
                    }
                }
            });

            if (payload.toolPath && payload.input) {
                setTimeout(async () => {
                    let tempDir: string | null = null;
                    try {
                        tempDir = await mkdtemp(path.join(os.tmpdir(), "fivem-pure-mode-"));
                        const scriptPath = path.join(tempDir, "pure-mode.vbs");
                        const vbsString = (value: string) => `"${value.replace(/"/g, '""')}"`;
                        const toolPath = payload.toolPath!.trim().replace(/^"([\s\S]*)"$/, "$1");
                        const script = [
                            "Set shell = CreateObject(\"WScript.Shell\")",
                            "WScript.Sleep 15000",
                            `shell.Run ${vbsString(`"${toolPath}"`)}, 1, False`,
                            "WScript.Sleep 6000",
                            `shell.AppActivate "FiveM sv_pureLevel"`,
                            `shell.SendKeys ${vbsString(`${payload.input!}{ENTER}`)}`
                        ].join("\r\n");
                        await writeFile(scriptPath, script, "utf16le");
                        await runHiddenExecutable("wscript.exe", ["//nologo", scriptPath]).catch(() => undefined);
                    } catch (error) {
                        console.error("[SecureLaunch] Pure Mode automation failed:", error);
                    } finally {
                        if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
                    }
                }, 0);
            }
            return { started: true, temporaryRoot: createdSession.root };
        } catch (error) {
            await removeJunction(junctionPath);
            for (const handle of activeSecureHandles.splice(0)) await handle.close().catch(() => undefined);
            if (session) await cleanupSecureSession(session);
            if (activeSecureSession?.session === session) activeSecureSession = null;
            throw error;
        } finally {
            sessionKey?.fill(0);
            secureLaunchInProgress = false;
        }
    })

    ipcMain.handle("launch-fivem-flow", async (event, payload: { fivemPath: string; toolPath: string; input: string }) => {
        const { fivemPath, toolPath, input } = payload

        const vbsString = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const quoteCommandPath = (value: string) => `"${value.trim().replace(/^"([\s\S]*)"$/, "$1")}"`;
        const vbsScript = [
            "Set shell = CreateObject(\"WScript.Shell\")",
            `shell.Run ${vbsString(quoteCommandPath(fivemPath))}, 1, False`,
            "WScript.Sleep 15000",
            `shell.Run ${vbsString(quoteCommandPath(toolPath))}, 1, False`,
            "WScript.Sleep 6000",
            `shell.AppActivate ${vbsString("FiveM sv_pureLevel")}`,
            "WScript.Sleep 1000",
            `shell.SendKeys ${vbsString(`${input}{ENTER}`)}`
        ].join("\r\n")

        const tempDir = await mkdtemp(path.join(os.tmpdir(), "fivem-vbs-"))
        const tempFile = path.join(tempDir, "launcher.vbs")
        await writeFile(tempFile, vbsScript, "utf16le") // VBS often prefers UTF-16LE or ANSI

        try {
            // Run via CMD/WScript
            await runHiddenExecutable("cmd.exe", ["/c", "wscript.exe", "//nologo", tempFile])
        } catch (error) {
            throw new Error(`Failed to launch FiveM flow via VBS: ${error}`)
        } finally {
            await rm(tempDir, { recursive: true, force: true })
        }
        return true
    })

    ipcMain.handle("Reshade", async (event, payload: { fivemPath: string }) => {
        const { fivemPath } = payload
        const logsFolder = path.join(fivemPath, "FiveM.app", "logs")
        const iniPath = path.join(fivemPath, "FiveM.app", "CitizenFX.ini")

        try {
            // Step 1: Access logs folder
            let files: string[];
            try {
                files = await readdir(logsFolder);
            } catch (e) {
                return "ERR_LOGS_FOLDER_MISSING";
            }

            // Step 2: Find log files
            const logFiles = files.filter(f => f.endsWith(".log"))
            if (logFiles.length === 0) return "ERR_NO_LOGS_FOUND";

            // Step 3: Get latest log
            const stats = await Promise.all(
                logFiles.map(async (file) => {
                    const filePath = path.join(logsFolder, file)
                    const s = await stat(filePath)
                    return { file, mtime: s.mtime }
                })
            )
            const sortedStats = stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()).slice(0, 10);
            console.log(`Checking top ${sortedStats.length} log files...`);

            let addonsSection = "";

            for (const logInfo of sortedStats) {
                try {
                    console.log(`Checking: ${logInfo.file}`);
                    const logContent = await readFile(path.join(logsFolder, logInfo.file), "utf8");

                    // Permissive regex to find the ID regardless of timestamps or spaces
                    const regex = /\[Addons\][\s\S]*?ReShade5=ID:([a-f0-9]+) acknowledged that ReShade 5\.x has a bug that will lead to game crashes/i;
                    const match = logContent.match(regex);

                    if (match && match[1]) {
                        const reshadeId = match[1];
                        console.log(`Bingo! Found Reshade ID: ${reshadeId} in ${logInfo.file}`);

                        // Construct the clean section the user wants
                        addonsSection = `[Addons]\nReShade5=ID:${reshadeId} acknowledged that ReShade 5.x has a bug that will lead to game crashes`;
                        break;
                    }
                } catch (e) {
                    console.error(`Error reading ${logInfo.file}:`, e);
                }
            }

            if (addonsSection) {
                console.log("Applying fix to CitizenFX.ini...");
                // Step 6: Read INI
                let iniContent = ""
                try {
                    iniContent = await readFile(iniPath, "utf8")
                } catch (e) { }

                if (iniContent.includes(addonsSection)) {
                    console.log("Already patched.");
                    return "SUCCESS_ALREADY_PATCHED"
                }

                try {
                    const newContent = `${iniContent}\n\n\n${addonsSection}`
                    await writeFile(iniPath, newContent, "utf8")
                    console.log("Successfully patched!");
                    return "SUCCESS_PATCHED"
                } catch (e) {
                    console.error("Write failed:", e);
                    return "ERR_WRITE_INI_FAILED"
                }
            }

            console.log("No blocked Reshade message found in logs.");
            return "ERR_NOT_BLOCKED_IN_LOG"
        } catch (error) {
            console.error("Reshade installation flow failed:", error)
            return "ERR_UNKNOWN"
        }
    })

    ipcMain.handle("change-reshade-key", async (_event, payload: { fivemPath: string; keyCode: number }) => {
        const { fivemPath, keyCode } = payload
        if (!fivemPath || typeof keyCode !== "number") {
            return { success: false, error: "Invalid parameters" }
        }

        try {
            const { resolveExistingPath } = await import("../utils/fs.js")
            const resolvedPath = await resolveExistingPath(fivemPath)
            if (!resolvedPath) {
                return { success: false, error: "Invalid FiveM path" }
            }

            // Get the FiveM root directory (remove fivem.exe if provided)
            let fiveMRoot = resolvedPath
            if (path.extname(resolvedPath).toLowerCase() === ".exe") {
                fiveMRoot = path.dirname(resolvedPath)
            }
            // If it's FiveM.app, go up one level
            if (path.basename(fiveMRoot).toLowerCase() === "fivem.app") {
                fiveMRoot = path.dirname(fiveMRoot)
            }

            // ReShade.ini location for FiveM: <FiveM Root>/FiveM.app/plugins/ReShade.ini
            const reshadeIniPath = path.join(fiveMRoot, "FiveM.app", "plugins", "ReShade.ini")

            let iniContent = ""
            try {
                iniContent = await readFile(reshadeIniPath, "utf8")
                console.log("[change-reshade-key] Found ReShade.ini at:", reshadeIniPath)
            } catch (e: any) {
                if (e.code === "ENOENT") {
                    console.log("[change-reshade-key] ReShade.ini not found at:", reshadeIniPath)
                    return { success: false, error: "ReShade.ini not found. Install ReShade first." }
                }
                throw e
            }

            const lines = iniContent.split(/\r?\n/)
            let modified = false
            let inInputSection = false

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                if (line.toUpperCase() === "[INPUT]") {
                    inInputSection = true
                    continue
                }
                if (inInputSection && line.startsWith("[")) {
                    inInputSection = false
                }
                if (inInputSection && line.toLowerCase().startsWith("keyoverlay=")) {
                    // Preserve existing modifier keys (ctrl, shift, alt), only change main key
                    const parts = line.split("=")[1].split(",").map(p => parseInt(p.trim(), 10))
                    const ctrl = parts[1] || 0
                    const shift = parts[2] || 0
                    const alt = parts[3] || 0
                    lines[i] = `KeyOverlay=${keyCode},${ctrl},${shift},${alt}`
                    modified = true
                    break
                }
            }

            if (!modified) {
                let inputSectionIndex = -1
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim().toUpperCase() === "[INPUT]") {
                        inputSectionIndex = i
                        break
                    }
                }
                if (inputSectionIndex === -1) {
                    lines.push("", "[INPUT]", `KeyOverlay=${keyCode},0,0,0`)
                } else {
                    lines.splice(inputSectionIndex + 1, 0, `KeyOverlay=${keyCode},0,0,0`)
                }
            }

            await writeFile(reshadeIniPath, lines.join("\n"), "utf8")
            return { success: true }
        } catch (error) {
            console.error("Failed to change Reshade key:", error)
            return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
    })

    ipcMain.handle("delete-mod-folders", async (_event, payload: { fivemPath: string }) => {
        const selectedPath = payload?.fivemPath?.trim()
        if (!selectedPath) throw new Error("FiveM path not provided")

        const resolvedPath = await resolveExistingPath(selectedPath)
        if (!resolvedPath) throw new Error("The selected FiveM path does not exist")

        const selectedStats = await stat(resolvedPath)
        let appDir: string
        if (selectedStats.isFile()) {
            if (path.extname(resolvedPath).toLowerCase() !== ".exe") {
                throw new Error("The selected file is not a FiveM executable")
            }
            const executableDirectory = path.dirname(resolvedPath)
            appDir = path.basename(executableDirectory).toLowerCase() === "fivem.app"
                ? executableDirectory
                : path.join(executableDirectory, "FiveM.app")
        } else if (path.basename(resolvedPath).toLowerCase() === "fivem.app") {
            appDir = resolvedPath
        } else {
            appDir = path.join(resolvedPath, "FiveM.app")
        }

        const appStats = await stat(appDir).catch(() => null)
        if (!appStats?.isDirectory()) {
            throw new Error(`FiveM.app was not found beside the selected path: ${resolvedPath}`)
        }

        console.log(`[Settings] Removing FiveM mod folders under selected installation: ${appDir}`)
        await Promise.all(["plugins", "mods", "citizen"].map(folder =>
            rm(path.join(appDir, folder), { recursive: true, force: true })
        ))
        return true
    })

    ipcMain.handle("get-installed-mods", async (_event, payload: { fivemPath?: string }) => {
        console.log(`[Electron] get-installed-mods called with fivemPath: ${payload.fivemPath}`);
        return getInstalledItems(payload.fivemPath)
    })

    ipcMain.handle("uninstall-mod", async (_event, payload: { id: string; files?: string[]; fivemPath?: string }) => {
        console.log(`[Electron] uninstall-mod called with id: ${payload.id}, fivemPath: ${payload.fivemPath}`);
        return uninstallItem(payload.id, payload.files, payload.fivemPath)
    })

    ipcMain.handle("explore-mod-files", async (_event, payload: { fivemPath: string }) => {
        const { fivemPath } = payload
        if (!fivemPath) return { error: "FiveM path required" }

        try {
            const { resolveExistingPath } = await import("../utils/fs.js")
            const resolvedPath = await resolveExistingPath(fivemPath)
            if (!resolvedPath) return { error: "Invalid FiveM path" }

            let fiveMRoot = resolvedPath
            if (path.extname(resolvedPath).toLowerCase() === ".exe") {
                fiveMRoot = path.dirname(resolvedPath)
            }
            if (path.basename(fiveMRoot).toLowerCase() === "fivem.app") {
                fiveMRoot = path.dirname(fiveMRoot)
            }

            const fiveMAppDir = path.join(fiveMRoot, "FiveM.app")
            const folders = ["mods", "plugins", "citizen"]
            
            // Get tracker data to correlate files with mods
            const trackerItems = await getInstalledItems(fivemPath)
            
            // Build a map of file -> mod info
            const fileToMod = new Map<string, { id: string; name: string; type: string; installedAt: string }>()
            for (const item of trackerItems) {
                for (const file of item.files) {
                    // Normalize file paths
                    let normalizedFile = file
                    if (!path.isAbsolute(file)) {
                        normalizedFile = path.join(fiveMAppDir, file)
                    }
                    fileToMod.set(normalizedFile.toLowerCase(), {
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        installedAt: item.installedAt
                    })
                    // Also index by basename for loose matching
                    fileToMod.set(path.basename(file).toLowerCase(), {
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        installedAt: item.installedAt
                    })
                }
            }

            const result: Record<string, any[]> = {}
            for (const folder of folders) {
                const folderPath = path.join(fiveMAppDir, folder)
                result[folder] = []
                
                try {
                    const entries = await readdir(folderPath, { withFileTypes: true })
                    for (const entry of entries) {
                        const fullPath = path.join(folderPath, entry.name)
                        const statResult = await stat(fullPath)
                        
                        const modInfo = fileToMod.get(fullPath.toLowerCase()) || 
                                       fileToMod.get(entry.name.toLowerCase())
                        
                        result[folder].push({
                            name: entry.name,
                            path: fullPath,
                            relativePath: path.join(folder, entry.name),
                            isDirectory: entry.isDirectory(),
                            size: statResult.size,
                            modifiedAt: statResult.mtime.toISOString(),
                            modId: modInfo?.id || null,
                            modName: modInfo?.name || null,
                            modType: modInfo?.type || null,
                            installedAt: modInfo?.installedAt || null
                        })
                    }
                } catch (e: any) {
                    if (e.code !== "ENOENT") throw e
                }
            }

            return result
        } catch (error) {
            console.error("Failed to explore mod files:", error)
            return { error: error instanceof Error ? error.message : String(error) }
        }
    })

    ipcMain.handle("delete-mod-file", async (_event, payload: { fivemPath: string; filePath: string }) => {
        const { fivemPath, filePath } = payload
        if (!fivemPath || !filePath) return { success: false, error: "Missing parameters" }

        try {
            const { resolveExistingPath } = await import("../utils/fs.js")
            const resolvedPath = await resolveExistingPath(fivemPath)
            if (!resolvedPath) return { success: false, error: "Invalid FiveM path" }

            // Security: ensure filePath is within FiveM.app
            const fiveMRoot = path.dirname(resolvedPath).endsWith("FiveM.app") 
                ? path.dirname(resolvedPath) 
                : path.join(path.dirname(resolvedPath), "FiveM.app")
            const normalizedFilePath = path.normalize(filePath)
            const normalizedRoot = path.normalize(fiveMRoot)
            
            if (!normalizedFilePath.startsWith(normalizedRoot)) {
                return { success: false, error: "Access denied: file outside FiveM directory" }
            }

            // Find which tracker item owns this file
            const trackerItems = await getInstalledItems(fivemPath)
            let ownerItem = null
            let ownerIndex = -1
            
            for (let i = 0; i < trackerItems.length; i++) {
                const item = trackerItems[i]
                if (item.files.some(f => path.normalize(f).toLowerCase() === normalizedFilePath.toLowerCase() || 
                    path.basename(f).toLowerCase() === path.basename(filePath).toLowerCase())) {
                    ownerItem = item
                    ownerIndex = i
                    break
                }
            }

            // Delete the file
            await rm(filePath, { force: true, recursive: true })

            // If owned by a tracker item, remove from tracker
            if (ownerItem) {
                // Check if other files from same mod still exist
                const remainingFiles = ownerItem.files.filter(f => {
                    try {
                        return path.normalize(f).toLowerCase() !== normalizedFilePath.toLowerCase()
                    } catch { return true }
                })
                
                if (remainingFiles.length === 0) {
                    // No files left, uninstall the whole mod
                    await uninstallItem(ownerItem.id, [], fivemPath)
                } else {
                    // Update tracker with remaining files
                    const allItems = await ensureTrackerData()
                    const globalIndex = allItems.findIndex(i => i.id === ownerItem.id)
                    if (globalIndex >= 0) {
                        allItems[globalIndex] = { ...ownerItem, files: remainingFiles }
                        await writeFile(getTrackerPath(), JSON.stringify(allItems, null, 2), "utf-8")
                    }
                }
            }

            // Clean up empty parent directories
            let parentDir = path.dirname(filePath)
            while (parentDir.startsWith(normalizedRoot)) {
                try {
                    const entries = await readdir(parentDir)
                    if (entries.length === 0) {
                        await rmdir(parentDir)
                        parentDir = path.dirname(parentDir)
                    } else {
                        break
                    }
                } catch {
                    break
                }
            }

            return { success: true }
        } catch (error) {
            console.error("Failed to delete mod file:", error)
            return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
    })

    ipcMain.handle("update:get-status", () => updateService.getStatus())
    ipcMain.handle("update:check", () => updateService.checkForUpdates())
    ipcMain.handle("update:download", async () => {
        console.log("[IPC] update:download handler called");
        return updateService.downloadUpdate();
    })
    ipcMain.handle("update:install", () => updateService.installUpdate())
    ipcMain.handle("update:can-download-mods", () => updateService.canDownloadMods())
    ipcMain.handle("update:get-version", () => updateService.getVersion())
}
