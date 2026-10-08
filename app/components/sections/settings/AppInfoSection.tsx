"use client";

import React, { useEffect, useState } from "react";
import { Package, Download, AlertCircle, CheckCircle, Loader2, Database, ArrowDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface AppVersionInfo {
    version: string;
    build: number;
    latestVersion?: string;
    latestBuild?: number;
    hasUpdate?: boolean;
    isChecking?: boolean;
    error?: "versionLoadError" | "updateError";
    downloadProgress?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    isDownloading?: boolean;
    isDownloaded?: boolean;
}

const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function AppInfoSection() {
    const { t, isArabic } = useTranslation();
    const [appInfo, setAppInfo] = useState<AppVersionInfo>({
        version: "1.2.3",
        build: 3,
        isChecking: true,
    });
    
    useEffect(() => {
        const fetchAppInfo = async () => {
            if (typeof window !== "undefined" && window.electron?.getAppVersion) {
                try {
                    const versionInfo = await window.electron.getAppVersion();
                    setAppInfo(prev => ({ ...prev, ...versionInfo, isChecking: false }));
                    
                    // Also get update status
                    const status = await window.electron.getUpdateStatus();
                    setAppInfo(prev => ({ 
                        ...prev, 
                        latestVersion: status.latestVersion, 
                        latestBuild: status.latestBuild,
                        hasUpdate: status.hasUpdate,
                        downloadProgress: status.downloadProgress,
                        downloadedBytes: status.downloadedBytes,
                        totalBytes: status.totalBytes,
                        isDownloading: status.isDownloading,
                        isDownloaded: status.isDownloaded
                    }));
                    
                    // Subscribe to real-time updates
                    const unsubscribe = window.electron.onUpdateStatus((status: any) => {
                        setAppInfo(prev => ({ 
                            ...prev, 
                            latestVersion: status.latestVersion, 
                            latestBuild: status.latestBuild,
                            hasUpdate: status.hasUpdate,
                            downloadProgress: status.downloadProgress,
                            downloadedBytes: status.downloadedBytes,
                            totalBytes: status.totalBytes,
                            isDownloading: status.isDownloading,
                            isDownloaded: status.isDownloaded
                        }));
                    });
                    
                    return () => unsubscribe();
                } catch (err) {
                    console.error("Failed to fetch app version:", err);
                    setAppInfo(prev => ({ ...prev, isChecking: false, error: "versionLoadError" }));
                }
            } else {
                // Fallback for web
                setAppInfo(prev => ({ ...prev, isChecking: false }));
            }
        };
        
        fetchAppInfo();
    }, []);

    const handleCheckUpdates = async () => {
        setAppInfo(prev => ({ ...prev, isChecking: true }));
        try {
            if (typeof window !== "undefined" && window.electron?.checkForUpdates) {
                await window.electron.checkForUpdates();
            }
            if (typeof window !== "undefined" && window.electron?.getUpdateStatus) {
                const status = await window.electron.getUpdateStatus();
                setAppInfo(prev => ({ 
                    ...prev, 
                    latestVersion: status.latestVersion, 
                    latestBuild: status.latestBuild,
                    hasUpdate: status.hasUpdate,
                    downloadProgress: status.downloadProgress,
                    downloadedBytes: status.downloadedBytes,
                    totalBytes: status.totalBytes,
                    isDownloading: status.isDownloading,
                    isDownloaded: status.isDownloaded,
                    isChecking: false
                }));
            } else {
                setAppInfo(prev => ({ ...prev, isChecking: false }));
            }
        } catch (err) {
            setAppInfo(prev => ({ ...prev, isChecking: false, error: "updateError" }));
        }
    };

    const handleDownloadUpdate = async () => {
        if (typeof window !== "undefined" && window.electron?.downloadUpdate) {
            await window.electron.downloadUpdate();
        }
    };

    const handleInstallUpdate = async () => {
        if (typeof window !== "undefined" && window.electron?.installUpdate) {
            await window.electron.installUpdate();
        }
    };

    const isUpdateAvailable = appInfo.hasUpdate && appInfo.latestBuild && appInfo.latestBuild > appInfo.build;
    const isMandatoryUpdate = isUpdateAvailable && (appInfo.latestBuild! - appInfo.build >= 3);
    const showDownloadSize = appInfo.totalBytes && appInfo.totalBytes > 0;

    return (
        <div className="flex flex-col gap-8 relative z-10">
            <div className="flex flex-col gap-1">
                <h4 className="text-[14px] font-bold text-primary tracking-[4px] uppercase px-1">{t.appInfo}</h4>
                <div className="w-40 h-1 bg-primary/30 rounded-full mx-1" />
            </div>

            {/* Current Version Card */}
            <div className="bg-black/30 backdrop-blur-md border border-white/5 p-8 rounded-3xl flex flex-col gap-6 group hover:border-primary/30 transition-all duration-500 hover:translate-y-[-4px]">
                <div className="flex items-center gap-4 text-primary/80">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <Package size={22} />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-[2px] text-white/40">{t.currentVersion}</span>
                </div>
                
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                                <span className="text-2xl font-bold text-white font-mono tracking-tight">
                                    v{appInfo.version}
                                </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                                <span className="text-xl font-bold text-white/80 font-mono">
                                    {t.buildNumber} #{appInfo.build}
                                </span>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleCheckUpdates}
                            disabled={appInfo.isChecking}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {appInfo.isChecking ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm font-medium">{t.checking}</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    <span className="text-sm font-medium">{t.checkUpdates}</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Update Status */}
                    {appInfo.error && (
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{t[appInfo.error]}</span>
                        </div>
                    )}

                    {isUpdateAvailable && (
                        <div className={`flex flex-col items-start gap-4 p-4 rounded-xl flex-wrap ${
                            isMandatoryUpdate 
                                ? "bg-red-500/10 border border-red-500/30" 
                                : "bg-green-500/10 border border-green-500/30"
                        }`}>
                            <div className="w-full flex items-center gap-4 flex-wrap">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${isMandatoryUpdate ? "bg-red-500" : "bg-green-500"}`} />
                                <div className="flex-1 min-w-[200px]">
                                    <div className="flex items-center gap-2">
                                        {isMandatoryUpdate ? (
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                        )}
                                        <span className="font-bold text-white">
                                            {isMandatoryUpdate ? t.mandatoryUpdate : t.updateAvailable}
                                        </span>
                                    </div>
                                    <div className="text-sm text-white/60 mt-1">
                                        {t.latestVersion}: <span className="font-mono text-white">v{appInfo.latestVersion}</span> ({t.buildNumber} #{appInfo.latestBuild})
                                    </div>
                                    <div className="text-sm text-white/60">
                                        {t.currentVersion}: <span className="font-mono text-white">v{appInfo.version}</span> ({t.buildNumber} #{appInfo.build})
                                    </div>
                                </div>
                                {(appInfo.latestBuild === appInfo.build + 1 || isMandatoryUpdate) && !appInfo.isChecking && !appInfo.isDownloading && !appInfo.isDownloaded && (
                                    <button
                                        onClick={handleDownloadUpdate}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all group relative"
                                        title={appInfo.totalBytes ? `${t.downloadUpdate} (${formatBytes(appInfo.totalBytes)})` : t.downloadUpdate}
                                    >
                                        <Download className="w-4 h-4 group-hover:animate-bounce" />
                                        <span className="text-sm font-medium">{t.downloadUpdate}</span>
                                        {appInfo.totalBytes && (
                                            <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full group-hover:bg-white/20 transition-colors">
                                                {formatBytes(appInfo.totalBytes)}
                                            </span>
                                        )}
                                        {/* Hover tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 border border-white/10 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                            {t.downloadUpdate}
                                            {appInfo.totalBytes && <span> • {formatBytes(appInfo.totalBytes)}</span>}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-black/90" />
                                        </div>
                                    </button>
                                )}
                                {appInfo.isDownloaded && !appInfo.isChecking && (
                                    <button
                                        onClick={handleInstallUpdate}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all group relative"
                                        title={appInfo.totalBytes ? `${t.installUpdate} (${formatBytes(appInfo.totalBytes)})` : t.installUpdate}
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium">{t.installUpdate}</span>
                                        {appInfo.totalBytes && (
                                            <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full group-hover:bg-white/20 transition-colors">
                                                {formatBytes(appInfo.totalBytes)}
                                            </span>
                                        )}
                                        {/* Hover tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 border border-white/10 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                            {t.installUpdate}
                                            {appInfo.totalBytes && <span> • {formatBytes(appInfo.totalBytes)}</span>}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-black/90" />
                                        </div>
                                    </button>
                                )}
                            </div>
                            
                            {/* Download Size Info */}
                            {showDownloadSize && (
                                <div className="w-full flex items-center gap-4 p-3 bg-black/30 border border-white/5 rounded-xl">
                                    <div className="flex items-center gap-2 text-primary/80">
                                        <Database className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-white/60">{t.downloadSize || "Download Size"}</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ArrowDown className="w-4 h-4 text-primary/70" />
                                            <span className="text-sm font-mono text-white/90 tabular-nums">
                                                {formatBytes(appInfo.totalBytes!)}
                                            </span>
                                        </div>
                                        {appInfo.isDownloading && appInfo.downloadedBytes && appInfo.totalBytes && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-mono text-white/70 tabular-nums">
                                                    {formatBytes(appInfo.downloadedBytes)} / {formatBytes(appInfo.totalBytes)}
                                                </span>
                                                <span className="text-sm font-bold text-primary tabular-nums">
                                                    {appInfo.downloadProgress}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Progress Bar during download */}
                            {appInfo.isDownloading && appInfo.totalBytes && appInfo.totalBytes > 0 && (
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between items-end px-1">
                                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{t.downloading || "Downloading"}</span>
                                        <span className="text-xl font-black text-primary tabular-nums">{appInfo.downloadProgress ?? 0}%</span>
                                    </div>
                                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary-foreground shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all duration-500 ease-out relative"
                                            style={{ width: `${Math.max(appInfo.downloadProgress ?? 0, 2)}%` }}
                                        >
                                            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                                            <div className="absolute inset-0 w-full h-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg]" />
                                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-sm opacity-50" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isUpdateAvailable && !appInfo.isChecking && !appInfo.error && (
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{t.upToDate}</span>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
