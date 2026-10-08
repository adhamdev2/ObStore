import React from "react";
import { Loader2, Zap, Database, Clock } from "lucide-react";

interface DownloadProgressProps {
    progress: number;
    modName: string;
    stats: {
        speed: number;
        downloadedBytes: number;
        totalBytes: number;
    };
    chunks?: number;
    status?: string;
}

export default function DownloadProgress({ progress, modName, stats, chunks, status }: DownloadProgressProps) {
    const formatBytes = (bytes: number) => {
        if (bytes <= 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const speedStr = `${formatBytes(stats.speed)}/s`;
    const progressStr = stats.totalBytes > 0 
        ? `${formatBytes(stats.downloadedBytes)} / ${formatBytes(stats.totalBytes)}`
        : `Downloaded: ${formatBytes(stats.downloadedBytes)}`;
    
    // Status label
    const statusLabel = status === "extracting" ? "Extracting..." 
        : status === "merging" ? "Merging chunks..."
        : undefined;
    
    // Estimate remaining time
    const remainingBytes = stats.totalBytes - stats.downloadedBytes;
    const remainingSeconds = stats.speed > 0 ? remainingBytes / stats.speed : 0;
    const etaStr = remainingSeconds > 0 
        ? remainingSeconds > 60 
            ? `${Math.floor(remainingSeconds / 60)}m ${Math.round(remainingSeconds % 60)}s`
            : `${Math.round(remainingSeconds)}s`
        : (stats.totalBytes > 0 ? "--" : "Calculating...");

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-2xl animate-in fade-in duration-500">
            <div className="relative w-full max-w-lg overflow-hidden rounded-[40px] border border-white/10 bg-neutral-900/40 p-10 shadow-[0_40px_150px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
                
                {/* Dynamic Background Glows */}
                <div 
                    className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/20 blur-[100px] animate-pulse" 
                    style={{ transition: 'opacity 0.5s ease', opacity: 0.4 + (progress / 200) }}
                />
                <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-primary/10 blur-[100px] animate-pulse" />

                <div className="relative flex flex-col gap-10">
                    {/* Header Section */}
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
                            <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-black/40 border border-white/10 text-primary mb-2 shadow-2xl">
                                <Loader2 className="animate-spin" size={40} strokeWidth={2.5} />
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary/60">
                                System Processing
                            </p>
                            <h2 className="text-3xl font-black tracking-tighter text-white">
                                {modName || "Initialising..." }
                            </h2>
                        </div>
                    </div>

                    {/* Progress Stats Grid */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/[0.03] border border-white/5">
                            <Zap size={18} className="text-primary/70" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Speed</span>
                            <span className="text-sm font-black text-white/90 tabular-nums">{speedStr}</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/[0.03] border border-white/5">
                            <Database size={18} className="text-primary/70" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Data</span>
                            <span className="text-sm font-black text-white/90 tabular-nums">{formatBytes(stats.downloadedBytes)}</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/[0.03] border border-white/5">
                            <Clock size={18} className="text-primary/70" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">ETA</span>
                            <span className="text-sm font-black text-white/90 tabular-nums">{etaStr}</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/[0.03] border border-white/5">
                            <svg width={18} height={18} className="text-primary/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Threads</span>
                            <span className="text-sm font-black text-white/90 tabular-nums">{chunks || 1}</span>
                        </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full space-y-5">
                        <div className="flex justify-between items-end px-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Progress</span>
                                <span className="text-xs font-medium text-white/20 tabular-nums">{progressStr}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                {statusLabel ? (
                                    <span className="text-2xl font-black text-white/40 tracking-widest uppercase animate-pulse">
                                        {statusLabel}
                                    </span>
                                ) : stats.totalBytes > 0 ? (
                                    <>
                                        <span className="text-5xl font-black text-white tracking-tighter tabular-nums leading-none">
                                            {progress}
                                        </span>
                                        <span className="text-xl font-bold text-primary leading-none">%</span>
                                    </>
                                ) : (
                                    <span className="text-2xl font-black text-white/40 tracking-widest uppercase animate-pulse">
                                        Downloading...
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="relative h-6 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 p-1.5 shadow-inner">
                            <div 
                                className={`h-full rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary-foreground shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all duration-700 ease-out relative ${stats.totalBytes === 0 ? "w-full animate-pulse opacity-50" : ""}`}
                                style={{ width: stats.totalBytes > 0 ? `${Math.max(progress, 2)}%` : "100%" }}
                            >
                                {/* Glass Shine */}
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                                
                                {/* Animated Shine Effect */}
                                <div className="absolute inset-0 w-full h-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg]" />
                                
                                {/* Light Tip */}
                                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-sm opacity-50" />
                            </div>
                        </div>
                        
                        <div className="flex justify-center items-center gap-2 text-white/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
                                Do not interrupt the installation process
                            </p>
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>
                {`
                @keyframes shimmer {
                    0% { transform: translateX(-100%) skewX(-25deg); }
                    100% { transform: translateX(250%) skewX(-25deg); }
                }
                `}
            </style>
        </div>
    );
}
