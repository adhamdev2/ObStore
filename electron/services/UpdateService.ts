import { autoUpdater, BrowserWindow, app, net } from "electron";
import { autoUpdater as electronUpdater } from "electron-updater";
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { getStableHwid } from "./Hwid.js";

type UpdateDetails = {
    version: string;
    releaseNotes?: string | null;
    releaseDate?: string | null;
    mandatory?: boolean;
};

export interface UpdateStatus {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    currentBuild: number;
    latestBuild: number;
    updateInfo: UpdateDetails | null;
    downloadProgress: number;
    downloadedBytes: number;
    totalBytes: number;
    isDownloading: boolean;
    isDownloaded: boolean;
    error: string | null;
}

export interface VersionInfo {
    version: string;
    build: number;
    releaseDate: string;
    changelog: string;
    mandatory: boolean;
    downloadUrl: string;
    signature: string;
}

function compareVersions(left: string, right: string): number | null {
    const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;
    const leftMatch = versionPattern.exec(left);
    const rightMatch = versionPattern.exec(right);
    if (!leftMatch || !rightMatch) return null;

    for (let index = 1; index <= 3; index++) {
        const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
        if (difference !== 0) return difference > 0 ? 1 : -1;
    }
    return 0;
}

function isNewerVersion(version: string, build: number, currentVersion: string, currentBuild: number): boolean {
    const comparison = compareVersions(version, currentVersion);
    return comparison === null ? build > currentBuild : comparison > 0;
}

class UpdateService {
    private mainWindow: BrowserWindow | null = null;
    private ws: WebSocket | null = null;
    private wsUrl = "wss://api.ob1.store/ws/updates";
    private apiBaseUrl = "https://api.ob1.store";
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 5000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private updateStatusPoll: NodeJS.Timeout | null = null;
    private heartbeatPoll: NodeJS.Timeout | null = null;
    private status: UpdateStatus = {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        latestVersion: app.getVersion(),
        currentBuild: this.getBuildNumber(),
        latestBuild: this.getBuildNumber(),
        updateInfo: null,
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        isDownloading: false,
        isDownloaded: false,
        error: null,
    };
    private isChecking = false;
    private expectedPackage: { version: string; fileName: string; size: number } | null = null;
    private listeners: Set<(status: UpdateStatus) => void> = new Set();

    private getBuildNumber(): number {
        const version = app.getVersion();
        const parts = version.split(".");
        return parseInt(parts[parts.length - 1]) || 0;
    }

    initialize(mainWindow: BrowserWindow, apiBaseUrl?: string): void {
        this.mainWindow = mainWindow;
        this.configureServerUrls(apiBaseUrl);
        this.setupAutoUpdater();
        this.setupWebSocket();
        void this.pollUpdateStatus();
        this.updateStatusPoll = setInterval(() => void this.pollUpdateStatus(), 60_000);
    }

    private configureServerUrls(apiBaseUrl?: string): void {
        this.apiBaseUrl = (apiBaseUrl || this.apiBaseUrl).replace(/\/+$/, "").replace(/\/api$/, "");

        const websocketUrl = new URL(this.apiBaseUrl);
        websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:";
        websocketUrl.pathname = "/ws/updates";
        websocketUrl.search = "";
        this.wsUrl = websocketUrl.toString();
    }

    private async fetchPackageInfo(version: string): Promise<{ version: string; fileName: string; size: number } | null> {
        try {
            const feedUrl = new URL(`/api/update/win32/${app.getVersion()}/RELEASES`, this.apiBaseUrl);
            const response = await net.fetch(feedUrl.toString(), { headers: { "Cache-Control": "no-store" } });
            if (!response.ok) return null;

            const entries = (await response.text())
                .split(/\r?\n/)
                .map((line) => line.trim().split(/\s+/))
                .filter((parts) => parts.length >= 3 && parts[1].endsWith(".nupkg"))
                .map((parts) => ({
                    fileName: parts[1],
                    size: Number.parseInt(parts[2], 10),
                    version: /-(\d+\.\d+\.\d+)-(?:full|delta)\.nupkg$/i.exec(parts[1])?.[1] ?? "",
                }))
                .filter((entry) => entry.version === version && Number.isFinite(entry.size) && entry.size > 0);

            // Current Forge builds publish one full package. Prefer it if a feed
            // ever contains both full and delta packages for the same version.
            const selected = entries.find((entry) => /-full\.nupkg$/i.test(entry.fileName)) ?? entries[0];
            return selected ? { version, fileName: selected.fileName, size: selected.size } : null;
        } catch (err) {
            console.warn("[UpdateService] Could not read update package size:", err);
            return null;
        }
    }

    private async refreshPackageInfo(version: string): Promise<void> {
        const packageInfo = await this.fetchPackageInfo(version);
        if (!packageInfo || this.status.latestVersion !== version || !this.status.hasUpdate) return;

        this.expectedPackage = packageInfo;
        this.updateStatus({ totalBytes: packageInfo.size });
        this.broadcastStatus();
    }

    private setupAutoUpdater(): void {
        // electron-updater (NSIS provider) will append /latest.yml to this URL.
        // The server must serve GET /api/update/win32/latest.yml
        const feedURL = `${this.apiBaseUrl}/api/update/win32`;
        console.log("[UpdateService] Initial feed URL:", feedURL);

        // Generate app-update.yml on the fly to prevent ENOENT error
        try {
            const updateConfigPath = path.join(app.getPath("userData"), "app-update.yml");
            fs.writeFileSync(updateConfigPath, `provider: generic\nurl: ${feedURL}\nupdaterCacheDirName: ob_launcher_updates\n`);
            (electronUpdater as any).updateConfigPath = updateConfigPath;
            console.log("[UpdateService] Generated app-update.yml at:", updateConfigPath);
        } catch (e) {
            console.warn("[UpdateService] Failed to write app-update.yml:", e);
        }

        electronUpdater.setFeedURL({
            provider: "generic",
            url: feedURL
        });
        electronUpdater.autoDownload = false; // We manually control download

        electronUpdater.on("checking-for-update", () => {
            this.updateStatus({ error: null });
            this.broadcastStatus();
        });

        electronUpdater.on("update-available", () => {
            this.handleUpdateAvailable();
        });

        electronUpdater.on("update-not-available", () => {
            this.handleUpdateNotAvailable();
        });

        electronUpdater.on("error", (err: Error) => {
            this.isChecking = false;
            this.updateStatus({ error: err.message, isDownloading: false });
            this.broadcastStatus();
            console.error("[UpdateService] Auto-updater error:", err);
        });

        electronUpdater.on("download-progress", (progress: any) => {
            console.log("[UpdateService] download-progress:", progress);
            this.updateStatus({
                downloadProgress: Math.round(progress.percent),
                downloadedBytes: progress.transferred,
                totalBytes: progress.total,
                isDownloading: true,
            });
            this.broadcastStatus();
        });

        electronUpdater.on("update-downloaded", (event: any) => {
            this.handleUpdateDownloaded({ 
                releaseNotes: event.releaseNotes, 
                releaseName: event.releaseName 
            });
        });
    }

    private handleUpdateAvailable(): void {
        this.isChecking = false;
        const latestVersion = this.status.latestVersion;
        const latestBuild = this.status.latestBuild;
        const currentBuild = this.getBuildNumber();

        this.updateStatus({
            hasUpdate: true,
            latestVersion,
            latestBuild,
            isDownloading: false,
            isDownloaded: false,
            error: null,
        });

        this.notifyFrontend("update-available", {
            version: latestVersion,
            build: latestBuild,
            currentVersion: this.status.currentVersion,
            currentBuild,
            releaseNotes: this.status.updateInfo?.releaseNotes,
            releaseDate: this.status.updateInfo?.releaseDate,
            mandatory: this.isMandatoryUpdate(currentBuild, latestBuild),
        });

        this.broadcastStatus();
    }

    private handleUpdateNotAvailable(): void {
        this.isChecking = false;

        if (this.status.hasUpdate) {
            this.updateStatus({
                isDownloading: false,
                isDownloaded: false,
                downloadProgress: 0,
                downloadedBytes: 0,
            });
            this.broadcastStatus();
            return;
        }

        const currentVersion = app.getVersion();
        const currentBuild = this.getBuildNumber();
        this.updateStatus({
            hasUpdate: false,
            latestVersion: currentVersion,
            latestBuild: currentBuild,
            updateInfo: null,
            downloadProgress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            isDownloaded: false,
            isDownloading: false,
        });

        this.notifyFrontend("update-not-available", { version: currentVersion });
        this.broadcastStatus();
    }

    private handleUpdateDownloaded(info: { releaseNotes?: string; releaseName?: string }): void {
        this.isChecking = false;
        const totalBytes = this.status.totalBytes;
        this.updateStatus({
            isDownloading: false,
            downloadProgress: 100,
            downloadedBytes: totalBytes || this.status.downloadedBytes,
            isDownloaded: true,
            hasUpdate: true,
        });

        this.notifyFrontend("update-downloaded", {
            version: this.status.latestVersion,
            releaseNotes: info.releaseNotes,
        });

        this.broadcastStatus();

        console.log("[UpdateService] Update downloaded. Auto-installing in 1 second...");
        setTimeout(() => {
            this.installUpdate();
        }, 1000);
    }

    private extractBuildNumber(version: string): number {
        const parts = version.split(".");
        return parseInt(parts[parts.length - 1]) || 0;
    }

    private isMandatoryUpdate(currentBuild: number, latestBuild: number): boolean {
        return latestBuild - currentBuild >= 3;
    }

    private setupWebSocket(): void {
        if (this.ws) {
            this.ws.close();
        }

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.on("open", () => {
                console.log("[UpdateService] WebSocket connected");
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.authenticate();
            });

            this.ws.on("message", (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWsMessage(message);
                } catch (err) {
                    console.error("[UpdateService] Failed to parse WS message:", err);
                }
            });

            this.ws.on("close", () => {
                console.log("[UpdateService] WebSocket disconnected");
                this.stopHeartbeat();
                this.scheduleReconnect();
            });

            this.ws.on("error", (err: Error) => {
                console.error("[UpdateService] WebSocket error:", err);
            });
        } catch (err) {
            console.error("[UpdateService] Failed to create WebSocket:", err);
            this.scheduleReconnect();
        }
    }

    private authenticate(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const hwid = getStableHwid();
            const version = app.getVersion();
            this.ws.send(JSON.stringify({
                type: "auth",
                payload: { hwid, version, build: this.getBuildNumber() },
            }));
        }
    }

    private async pollHeartbeat(): Promise<void> {
        try {
            if (this.ws?.readyState === WebSocket.OPEN) return;
            const hwid = getStableHwid();
            await net.fetch(new URL('/api/update/heartbeat', this.apiBaseUrl).toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hwid })
            });
        } catch (err) {}
    }

    private async pollUpdateStatus(): Promise<void> {
        const statusUrl = new URL("/api/update/update/status", this.apiBaseUrl);
        statusUrl.searchParams.set("version", app.getVersion());
        statusUrl.searchParams.set("build", String(this.getBuildNumber()));

        try {
            const response = await net.fetch(statusUrl.toString());
            if (!response.ok) {
                throw new Error(`Update status request failed (${response.status})`);
            }

            const payload = await response.json() as {
                hasUpdate?: boolean;
                latestVersion?: string;
                latestBuild?: number;
                releaseDate?: string;
                changelog?: string;
                mandatory?: boolean;
            };
            const latestVersion = typeof payload.latestVersion === "string" ? payload.latestVersion : app.getVersion();
            const latestBuild = typeof payload.latestBuild === "number"
                ? payload.latestBuild
                : this.extractBuildNumber(latestVersion);
            const hasNewerVersion = Boolean(payload.hasUpdate) &&
                isNewerVersion(latestVersion, latestBuild, app.getVersion(), this.getBuildNumber());

            if (hasNewerVersion) {
                const updateChanged = !this.status.hasUpdate ||
                    this.status.latestVersion !== latestVersion ||
                    this.status.latestBuild !== latestBuild;
                if (updateChanged) {
                    this.handleWsUpdateStatus({
                        hasUpdate: true,
                        version: latestVersion,
                        build: latestBuild,
                        releaseDate: payload.releaseDate,
                        changelog: payload.changelog,
                        mandatory: payload.mandatory,
                    });
                }
            } else if (this.status.hasUpdate) {
                this.handleWsUpdateStatus({
                    hasUpdate: false,
                    version: latestVersion,
                    build: latestBuild,
                });
            }
        } catch (err) {
            console.warn("[UpdateService] API update status check failed:", err);
        }
    }

    private handleWsMessage(message: { type: string; payload: any }): void {
        switch (message.type) {
            case "update_status":
                this.handleWsUpdateStatus(message.payload);
                break;
            case "update_available":
                this.handleWsUpdateAvailable(message.payload);
                break;
            case "force_update":
                this.handleForceUpdate(message.payload);
                break;
            case "version_info":
                this.handleVersionInfo(message.payload);
                break;
            case "pong":
                break;
            default:
                console.log("[UpdateService] Unknown WS message type:", message.type);
        }
    }

    private handleWsUpdateStatus(payload: {
        hasUpdate?: boolean;
        version?: string;
        build?: number;
        releaseDate?: string;
        changelog?: string;
        mandatory?: boolean;
    }): void {
        const currentVersion = app.getVersion();
        const currentBuild = this.getBuildNumber();
        const latestVersion = typeof payload?.version === "string" ? payload.version : currentVersion;
        const latestBuild = typeof payload?.build === "number"
            ? payload.build
            : this.extractBuildNumber(latestVersion);

        if (!payload?.hasUpdate || !isNewerVersion(latestVersion, latestBuild, currentVersion, currentBuild)) {
            this.updateStatus({
                hasUpdate: false,
                latestVersion,
                latestBuild,
                updateInfo: null,
                isDownloaded: false,
                isDownloading: false,
                downloadProgress: 0,
                downloadedBytes: 0,
                totalBytes: 0,
            });
            this.expectedPackage = null;
            this.notifyFrontend("update-not-available", { version: latestVersion });
            this.broadcastStatus();
            return;
        }

        this.handleWsUpdateAvailable({
            ...payload,
            version: latestVersion,
            build: latestBuild,
        } as VersionInfo);
    }

    private handleWsUpdateAvailable(payload: VersionInfo): void {
        const currentBuild = this.getBuildNumber();
        const latestBuild = payload.build;
        const currentVersion = app.getVersion();

        if (!isNewerVersion(payload.version, latestBuild, currentVersion, currentBuild)) {
            return;
        }

        this.updateStatus({
            hasUpdate: true,
            latestVersion: payload.version,
            latestBuild,
            updateInfo: {
                version: payload.version,
                releaseNotes: payload.changelog,
                releaseDate: payload.releaseDate,
                mandatory: payload.mandatory,
            },
            isDownloading: false,
            downloadProgress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            isDownloaded: false,
        });
        this.expectedPackage = null;

        this.notifyFrontend("update-available", {
            version: payload.version,
            build: latestBuild,
            currentVersion: this.status.currentVersion,
            currentBuild,
            releaseNotes: payload.changelog,
            releaseDate: payload.releaseDate,
            mandatory: payload.mandatory,
        });

        this.broadcastStatus();
        void this.refreshPackageInfo(payload.version);
    }

    private handleForceUpdate(payload: { version: string; build: number; deadline: string }): void {
        if (!isNewerVersion(payload.version, payload.build, app.getVersion(), this.getBuildNumber())) {
            this.handleWsUpdateStatus({
                hasUpdate: false,
                version: payload.version,
                build: payload.build,
            });
            return;
        }

        this.updateStatus({
            hasUpdate: true,
            latestVersion: payload.version,
            latestBuild: payload.build,
            downloadProgress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            isDownloading: false,
            isDownloaded: false,
            updateInfo: {
                version: payload.version,
                releaseNotes: "Force update required",
                releaseDate: payload.deadline,
                mandatory: true,
            },
        });

        this.notifyFrontend("force-update", payload);
        this.broadcastStatus();
        void this.refreshPackageInfo(payload.version);
    }

    private handleVersionInfo(payload: VersionInfo): void {
        this.updateStatus({
            latestVersion: payload.version,
            latestBuild: payload.build,
        });
        this.broadcastStatus();
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: "ping" }));
            }
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("[UpdateService] Max reconnect attempts reached");
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

        setTimeout(() => {
            console.log(`[UpdateService] Reconnecting... (attempt ${this.reconnectAttempts})`);
            this.setupWebSocket();
        }, delay);
    }

    async checkForUpdates(): Promise<void> {
        // Check the release API only. Electron's Squirrel checkForUpdates() also
        // starts downloading as soon as it finds a release.
        await this.pollUpdateStatus();
    }

    async downloadUpdate(): Promise<void> {
        if (!app.isPackaged) {
            console.warn("[UpdateService] Download requested in development mode - simulating download for testing");
        }
        if (!this.status.hasUpdate || this.status.isDownloading || this.isChecking) {
            if (!this.status.hasUpdate) {
                console.log("[UpdateService] No update available to download");
            }
            return;
        }

        try {
            this.isChecking = true;
            const packageInfo = this.expectedPackage?.version === this.status.latestVersion
                ? this.expectedPackage
                : await this.fetchPackageInfo(this.status.latestVersion);
            if (packageInfo) this.expectedPackage = packageInfo;

            const totalBytes = packageInfo?.size ?? this.status.totalBytes;
            if (!totalBytes || totalBytes <= 0) {
                console.warn("[UpdateService] No package size available, progress may be inaccurate");
            }
            this.updateStatus({
                isDownloading: true,
                downloadProgress: 0,
                downloadedBytes: 0,
                totalBytes: totalBytes || 0,
                error: null,
            });
            this.broadcastStatus();

            // ALWAYS set feed URL - electron-updater appends /latest.yml automatically
            const feedURL = `${this.apiBaseUrl}/api/update/win32`;
            console.log("[UpdateService] Setting feed URL:", feedURL);
            electronUpdater.setFeedURL({
                provider: "generic",
                url: feedURL
            });

            // Verify latest.yml is accessible before attempting download
            console.log("[UpdateService] Verifying latest.yml accessibility...");
            try {
                const latestYmlUrl = new URL(`/api/update/win32/latest.yml`, this.apiBaseUrl);
                const feedResponse = await net.fetch(latestYmlUrl.toString(), { headers: { "Cache-Control": "no-store" } });
                console.log("[UpdateService] latest.yml status:", feedResponse.status);
                if (!feedResponse.ok) {
                    throw new Error(`latest.yml not accessible: ${feedResponse.status} ${feedResponse.statusText}`);
                }
                const feedText = await feedResponse.text();
                console.log("[UpdateService] latest.yml content:", feedText.substring(0, 300));
            } catch (feedErr) {
                console.error("[UpdateService] Feed verification failed:", feedErr);
                throw new Error(`Cannot access update feed: ${feedErr instanceof Error ? feedErr.message : String(feedErr)}`);
            }

            // electron-updater requires checkForUpdates() before downloadUpdate()
            // otherwise it throws "Please check update first" because internal update info is null
            console.log("[UpdateService] Calling electronUpdater.checkForUpdates() before download...");
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error("checkForUpdates timeout (30s)"));
                }, 30000);

                const onAvailable = () => {
                    clearTimeout(timeout);
                    cleanup();
                    console.log("[UpdateService] electron-updater: update-available");
                    resolve();
                };
                const onNotAvailable = () => {
                    clearTimeout(timeout);
                    cleanup();
                    console.log("[UpdateService] electron-updater: update-not-available");
                    reject(new Error("No update available from electron-updater"));
                };
                const onError = (err: Error) => {
                    clearTimeout(timeout);
                    cleanup();
                    console.error("[UpdateService] electron-updater: error:", err);
                    reject(err);
                };
                const cleanup = () => {
                    electronUpdater.removeListener("update-available", onAvailable);
                    electronUpdater.removeListener("update-not-available", onNotAvailable);
                    electronUpdater.removeListener("error", onError);
                };
                electronUpdater.on("update-available", onAvailable);
                electronUpdater.on("update-not-available", onNotAvailable);
                electronUpdater.on("error", onError);
                electronUpdater.checkForUpdates();
            });

            // Now download - electron-updater has the update info populated
            console.log("[UpdateService] Calling electronUpdater.downloadUpdate()...");
            await electronUpdater.downloadUpdate();
            console.log("[UpdateService] downloadUpdate() completed");
        } catch (err) {
            this.isChecking = false;
            console.error("[UpdateService] Download failed:", err);
            this.updateStatus({
                isDownloading: false,
                error: err instanceof Error ? err.message : "Download failed",
            });
            this.broadcastStatus();
            throw err;
        }
    }

    async installUpdate(): Promise<void> {
        if (!this.status.isDownloaded) return;
        if (!app.isPackaged) {
            console.warn("[UpdateService] Install requested in development mode - simulating restart");
            return;
        }
        electronUpdater.quitAndInstall();
    }

    private updateStatus(partial: Partial<UpdateStatus>): void {
        this.status = { ...this.status, ...partial };
    }

    private broadcastStatus(): void {
        this.listeners.forEach((listener) => listener(this.status));
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("update-status", this.status);
        }
    }

    private notifyFrontend(event: string, data: any): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(`update-${event}`, data);
        }
    }

    subscribe(listener: (status: UpdateStatus) => void): () => void {
        this.listeners.add(listener);
        listener(this.status);
        return () => this.listeners.delete(listener);
    }

    getStatus(): UpdateStatus {
        return { ...this.status };
    }

    isUpdateAvailable(): boolean {
        return this.status.hasUpdate;
    }

    isLatestVersion(): boolean {
        return !this.status.hasUpdate;
    }

    canDownloadMods(): boolean {
        return this.isLatestVersion() || !this.status.hasUpdate;
    }

    destroy(): void {
        this.stopHeartbeat();
        if (this.heartbeatPoll) {
            clearInterval(this.heartbeatPoll);
            this.heartbeatPoll = null;
        }
        if (this.updateStatusPoll) {
            clearInterval(this.updateStatusPoll);
            this.updateStatusPoll = null;
        }
        if (this.ws) {
            this.ws.close();
        }
        this.listeners.clear();
    }

    getVersion(): { version: string; build: number } {
        return {
            version: app.getVersion(),
            build: this.getBuildNumber(),
        };
    }
}

export const updateService = new UpdateService();




