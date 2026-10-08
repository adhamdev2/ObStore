"use client";

import { Download, RotateCw, Database, ArrowDown } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface UpdateInfo {
    version: string;
    build: number;
    currentVersion: string;
    currentBuild: number;
    releaseNotes?: string;
    releaseDate?: string;
    mandatory?: boolean;
}

interface UpdateStatus {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    currentBuild: number;
    latestBuild: number;
    updateInfo?: {
        version?: string;
        releaseNotes?: string;
        releaseDate?: string;
        mandatory?: boolean;
    } | null;
    downloadProgress: number;
    downloadedBytes: number;
    totalBytes: number;
    isDownloading: boolean;
    isDownloaded: boolean;
    error: string | null;
}

const initialStatus: UpdateStatus = {
    hasUpdate: false,
    currentVersion: "",
    latestVersion: "",
    currentBuild: 0,
    latestBuild: 0,
    updateInfo: null,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    isDownloading: false,
    isDownloaded: false,
    error: null,
};

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

function getBuildNumber(version: string): number {
    const parts = version.split(".");
    return Number.parseInt(parts[parts.length - 1], 10) || 0;
}

const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function UpdateIndicator() {
    const [isElectron, setIsElectron] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(initialStatus);
    const [showIndicator, setShowIndicator] = useState(false);
    const [pulseAnimation, setPulseAnimation] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const attentionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentVersionRef = useRef("");
    const currentBuildRef = useRef(0);

    const triggerAttention = useCallback(() => {
        setPulseAnimation(true);
        if (attentionTimeout.current) clearTimeout(attentionTimeout.current);
        attentionTimeout.current = setTimeout(() => setPulseAnimation(false), 4000);
    }, []);

    const applyStatus = useCallback((status: Partial<UpdateStatus>) => {
        setUpdateStatus((previous) => ({ ...previous, ...status }));

        const latestVersion = status.latestVersion || status.updateInfo?.version || "";
        const currentVersion = status.currentVersion || "";
        const latestBuild = status.latestBuild ?? getBuildNumber(latestVersion);
        const currentBuild = status.currentBuild ?? getBuildNumber(currentVersion);
        currentVersionRef.current = currentVersion;
        currentBuildRef.current = currentBuild;

        if (!status.hasUpdate || !latestVersion || !currentVersion ||
            !isNewerVersion(latestVersion, latestBuild, currentVersion, currentBuild)) {
            setUpdateInfo(null);
            setShowIndicator(false);
            return;
        }

        setUpdateInfo({
            version: latestVersion,
            build: latestBuild,
            currentVersion,
            currentBuild,
            releaseNotes: status.updateInfo?.releaseNotes,
            releaseDate: status.updateInfo?.releaseDate,
            mandatory: status.updateInfo?.mandatory,
        });
        setShowIndicator(true);
    }, []);

    const downloadUpdate = useCallback(async () => {
        const electron = window.electron;
        if (!electron) return;
        try {
            if (updateStatus.isDownloaded) {
                await electron.installUpdate();
            } else if (!updateStatus.isDownloading) {
                await electron.downloadUpdate();
            }
        } catch (err) {
            console.error("Failed to download or install update:", err);
        }
    }, [updateStatus.isDownloaded, updateStatus.isDownloading]);

    useEffect(() => {
        const electron = window.electron;
        if (!electron) return;

        setIsElectron(true);
        let updateEventsReceived = 0;

        const unsubscribeStatus = electron.onUpdateStatus((status: UpdateStatus) => {
            updateEventsReceived++;
            applyStatus(status);
        });

        const unsubscribeAvailable = electron.onUpdateAvailable((data: UpdateInfo) => {
            updateEventsReceived++;
            currentVersionRef.current = data.currentVersion;
            currentBuildRef.current = data.currentBuild;
            if (!isNewerVersion(data.version, data.build, data.currentVersion, data.currentBuild)) {
                setUpdateInfo(null);
                setShowIndicator(false);
                return;
            }

            setUpdateInfo(data);
            setUpdateStatus((previous) => ({
                ...previous,
                hasUpdate: true,
                currentVersion: data.currentVersion,
                currentBuild: data.currentBuild,
                latestVersion: data.version,
                latestBuild: data.build,
            }));
            setShowIndicator(true);
            triggerAttention();
        });

        const unsubscribeNotAvailable = electron.onUpdateNotAvailable(() => {
            updateEventsReceived++;
            setUpdateInfo(null);
            setShowIndicator(false);
        });

        const unsubscribeDownloaded = electron.onUpdateDownloaded(() => {
            updateEventsReceived++;
            setUpdateStatus((previous) => ({
                ...previous,
                isDownloaded: true,
                isDownloading: false,
                downloadProgress: 100,
            }));
        });

        const unsubscribeForceUpdate = electron.onForceUpdate((data: { version: string; build: number; deadline: string }) => {
            updateEventsReceived++;
            const currentVersion = currentVersionRef.current;
            const currentBuild = currentBuildRef.current;
            if (!isNewerVersion(data.version, data.build, currentVersion, currentBuild)) {
                setUpdateInfo(null);
                setShowIndicator(false);
                return;
            }

            setUpdateInfo({
                version: data.version,
                build: data.build,
                currentVersion,
                currentBuild,
                mandatory: true,
                releaseDate: data.deadline,
            });
            setShowIndicator(true);
            triggerAttention();
        });

        // Subscribe before reading the current state so an update arriving during startup is not missed.
        const eventCountAtRequest = updateEventsReceived;
        electron.getUpdateStatus().then((status) => {
            if (updateEventsReceived === eventCountAtRequest) applyStatus(status);
        }).catch((err) => {
            console.error("Failed to load update status:", err);
        });
        electron.getAppVersion().then(({ version, build }) => {
            currentVersionRef.current = version;
            currentBuildRef.current = build;
        }).catch((err) => {
            console.error("Failed to load installed app version:", err);
        });

        return () => {
            unsubscribeStatus();
            unsubscribeAvailable();
            unsubscribeNotAvailable();
            unsubscribeDownloaded();
            unsubscribeForceUpdate();
            if (attentionTimeout.current) clearTimeout(attentionTimeout.current);
        };
    }, [applyStatus, triggerAttention]);

    if (!isElectron || !showIndicator || !updateInfo) return null;

    const isMandatory = updateInfo.mandatory || (updateInfo.build - updateInfo.currentBuild >= 3);
    const isDownloaded = updateStatus.isDownloaded;
    const isDownloading = updateStatus.isDownloading;
    const hasDownloadSize = updateStatus.totalBytes > 0;
    const title = isDownloading
        ? `Downloading update v${updateInfo.version}${updateStatus.downloadProgress > 0 ? ` (${updateStatus.downloadProgress}%)` : ""}`
        : isDownloaded
            ? `Restart to install update v${updateInfo.version}`
            : `Download update v${updateInfo.version}`;

    const tooltipContent = (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-auto max-w-xs p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-50 whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-primary/80 mb-2">
                <Database className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">Download Size</span>
            </div>
            <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-primary/70" />
                <span className="text-sm font-mono text-white/90 tabular-nums">{formatBytes(updateStatus.totalBytes)}</span>
            </div>
            {isDownloading && updateStatus.downloadedBytes > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/50">Downloaded</span>
                    <span className="text-sm font-mono text-white/90 tabular-nums">
                        {formatBytes(updateStatus.downloadedBytes)} / {formatBytes(updateStatus.totalBytes)}
                    </span>
                </div>
            )}
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%) skewX(-25deg); }
                    100% { transform: translateX(250%) skewX(-25deg); }
                }
            `}</style>
        </div>
    );

    return (
        <div className="flex h-full items-center px-1 relative" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {/* Progress bar line above the button */}
            {(isDownloading || isDownloaded) && updateStatus.totalBytes > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/40 border-b border-white/5 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-primary/40 via-primary to-primary-foreground shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all duration-500 ease-out relative"
                        style={{ width: `${Math.max(updateStatus.downloadProgress, isDownloaded ? 100 : 2)}%` }}
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent" />
                        <div className="absolute inset-0 w-full h-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg]" />
                        <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-sm opacity-50" />
                    </div>
                </div>
            )}
            
            <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
                <button
                    type="button"
                    onClick={downloadUpdate}
                    disabled={isDownloading}
                    className={`update-notification relative flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${
                        isMandatory
                            ? "border-red-400/70 bg-red-500/20 text-red-200 hover:bg-red-500/35"
                            : "border-amber-300/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/30"
                    } ${pulseAnimation ? "update-notification-pulse" : ""} ${isDownloading ? "cursor-wait" : "cursor-pointer"}`}
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    title={title}
                    aria-label={title}
                >
                    {isDownloaded ? (
                        <RotateCw className="h-4 w-4" />
                    ) : isDownloading ? (
                        <>
                            <Download className="h-4 w-4 animate-spin" />
                            {updateStatus.downloadProgress > 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
                                {updateStatus.downloadProgress}
                            </span>}
                        </>
                    ) : (
                        <Download className={`h-4 w-4 ${pulseAnimation ? "animate-bounce" : ""}`} />
                    )}
                    <span className="whitespace-nowrap">
                        {isDownloading
                            ? `Downloading${updateStatus.downloadProgress > 0 ? ` ${updateStatus.downloadProgress}%` : "..."}`
                            : isDownloaded
                                ? "Restart to install"
                                : "Download update"}
                    </span>
                    <span
                        className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#151515] ${
                            isMandatory ? "bg-red-400" : "bg-amber-300"
                        } update-notification-dot`}
                        aria-hidden="true"
                    />
                </button>

                {/* Hover Tooltip with Download Size */}
                {showTooltip && hasDownloadSize && !isDownloaded && tooltipContent}
                
                <style jsx>{`
                    @keyframes notification-pulse {
                        0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.75); }
                        70% { box-shadow: 0 0 0 9px rgba(251, 191, 36, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
                    }
                    @keyframes notification-dot-ping {
                        75%, 100% { transform: scale(1.8); opacity: 0; }
                    }
                    @keyframes shimmer {
                        0% { transform: translateX(-100%) skewX(-25deg); }
                        100% { transform: translateX(250%) skewX(-25deg); }
                    }
                    .update-notification-pulse { animation: notification-pulse 1.5s ease-out infinite; }
                    .update-notification-dot { animation: notification-dot-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite; }
                `}</style>
            </div>
        </div>
    );
}
