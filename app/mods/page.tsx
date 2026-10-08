"use client";

import { useEffect, useState, useCallback } from "react";
import ModGrid from "@/components/sections/mods/ModGrid";
import { apiFetch, buildApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import DownloadProgress from "@/components/sections/download/DownloadProgress";
import { Loader2, AlertCircle, Box, AlertTriangle, CheckCircle2, FolderCog, X, Lock, XCircle, Sparkles, FolderTree } from "lucide-react";
import type { Mod } from "@/types/Mod";
import ActivationBox from "@/components/sections/mods/ActivationBox";
import { useDownload } from "@/lib/DownloadContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import ModFileExplorer from "@/components/sections/mods/ModFileExplorer";

interface PathsResponse {
    paths: {
        fivemApp: string;
        fivemModsDIRS: string[];
        fivemPath: string;
    };
}

interface DownloadSessionResponse {
    downloadId: string;
    downloadUrl: string;
    fileName: string;
    modName: string;
    type: string;
    size: number;
}

export default function Mods() {
    const { user, checkAuth } = useAuth();
    const [mods, setMods] = useState<Mod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Download & UI states
    const [showPathPopup, setShowPathPopup] = useState(false);
    const [showConfirmPathPopup, setShowConfirmPathPopup] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [downloadedModName, setDownloadedModName] = useState("");
    const [downloadTargetPath, setDownloadTargetPath] = useState("");
    const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);
    const { isPopoverOpen, setIsPopoverOpen, addDownload } = useDownload();
    const { t, isArabic } = useTranslation();
    const { canDownloadMods, updateStatus, isChecking: isUpdateChecking } = useUpdateCheck();
    const [showFileExplorer, setShowFileExplorer] = useState(false);

    const hasRequiredPaths = Boolean(user?.settings?.fivemDir?.trim());

    const fetchMods = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

                        const electron = (window as any).electron;
            let installedIds: string[] = [];
            let fivemPath = user?.settings?.fivemDir?.trim() || "";

            if (!fivemPath) {
                try {
                    const pathsResponse = await apiFetch<{ paths: { fivemPath: string } }>("/paths");
                    fivemPath = pathsResponse.paths.fivemPath;
                } catch {}
            }

            if (electron?.getInstalledMods && fivemPath) {
                const items = await electron.getInstalledMods({ fivemPath });
                installedIds = items.map((i: any) => i.id);
            }

            const backendMods = await apiFetch<any[]>(`/mods/all?type=version`);

            if (backendMods) {
                const userVersions = user?.versions || [];
                const filtered = backendMods.filter(mod => {
                    if (!mod.version) return false;
                    const modVersions = Array.isArray(mod.version) ? mod.version : [mod.version];
                    return modVersions.some((v: any) => userVersions.includes(v));
                });

                const downloadedIds = user?.downloads?.map((d: any) => d.id) || [];
                const mappedMods: Mod[] = filtered.map(mod => ({
                    ...mod,
                    category: (mod.category || "version").toLowerCase(),
                    isInstalled: installedIds.includes(mod.id) || downloadedIds.includes(mod.id),
                    isIncompatible: false
                }));
                setMods(mappedMods);
            } else {
                setMods([]);
            }
        } catch (err: any) {
            console.error("Failed to fetch mods:", err);
            setError(err.message || "Failed to load mods. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMods();

        const handleRefresh = () => {
            fetchMods();
        };

        window.addEventListener("force-refresh-mods", handleRefresh);
        return () => window.removeEventListener("force-refresh-mods", handleRefresh);
    }, [fetchMods]);

    const showUpdateRequiredPopup = (mandatory: boolean) => {
        const message = mandatory
            ? "يجب تحديث التطبيق إلى أحدث إصدار قبل تحميل المودات. هذا تحديث إجباري."
            : "يتوفر تحديث جديد للتطبيق. يوصى بتحديث التطبيق قبل تحميل المودات.";
        
        alert(message);
    };

    const runDownload = async (id: string) => {
        const electron = (window as any).electron;

        if (!electron?.downloadModArchive) {
            alert("Download to game directory is only available in the desktop app.");
            return;
        }

        // Check if app is on latest version before allowing download
        if (!canDownloadMods && updateStatus?.hasUpdate) {
            showUpdateRequiredPopup(updateStatus.latestBuild - updateStatus.currentBuild >= 3);
            return;
        }

        const mod = mods.find(m => m.id === id);
        if (!mod) return;

        let pathsResponse: PathsResponse;
        try {
            pathsResponse = await apiFetch<PathsResponse>("/paths");
        } catch {
            alert("FiveM directory not set. Please set it in Settings.");
            return;
        }
        const currentPath = pathsResponse.paths?.fivemPath;
        if (!currentPath || !(await electron.pathExists(currentPath))) {
            alert("The selected FiveM directory does not exist. Please update it in Settings.");
            return;
        }

        // Handled by queue now

        await addDownload(mod.id, mod.name, async (downloadId: string) => {
            try {
                const download = await apiFetch<DownloadSessionResponse>(`/mods/${encodeURIComponent(mod.id)}/downloads?type=versions`, { method: "POST" });
                const result = await electron.downloadModArchive({
                    url: buildApiUrl(download.downloadUrl),
                    targetPath: currentPath,
                    modId: mod.id,
                    modName: mod.name,
                    type: "version",
                    installDirectories: pathsResponse.paths.fivemModsDIRS,
                    skipDeletion: true,
                    downloadId
                });

                // Record download in backend quickly
                try {
                    await apiFetch("/user/downloads", {
                        method: "POST",
                        body: JSON.stringify({
                            id: mod.id,
                            name: mod.name,
                            version: mod.id,
                            type: "version",
                            modType: "versions",
                            files: result.installedFiles
                        })
                    });
                } catch (err) {
                    console.error("Failed to record version download:", err);
                }

                setDownloadedModName(mod.name);
                setDownloadTargetPath(currentPath);
                setShowSuccessPopup(true);
                
                await fetchMods();

                window.dispatchEvent(new Event("force-refresh-mods"));
                return result;
            } catch (error) {
                console.error("Version download error:", error);
                throw error;
            }
        });
    };

    const handleUninstall = async (id: string, name: string) => {
        const electron = (window as any).electron;
        if (!electron?.uninstallMod) return;

        if (!window.confirm(`هل أنت متأكد أنك تريد حذف ${name}؟ سيتم مسح ملفات citizen, plugins, mods.`)) {
            return;
        }

        const modInBackend = user?.downloads?.find(d => d.id === id);

        try {
            if (user?.settings?.fivemDir && electron?.deleteModFolders) {
                await electron.deleteModFolders({ fivemPath: user.settings.fivemDir }).catch((e: any) => console.warn("deleteModFolders failed", e));
            }
            if (electron?.uninstallMod) {
                await electron.uninstallMod({ id, files: modInBackend?.files, fivemPath: user?.settings?.fivemDir }).catch((e: any) => console.warn("uninstallMod failed", e));
            }

            // Remove from backend history
            await apiFetch(`/user/downloads/${id}`, { method: "DELETE" }).catch(err => console.error("Failed to delete download from backend:", err));

            await fetchMods();

            // Notify other components (Navbar)
            window.dispatchEvent(new Event("force-refresh-mods"));
        } catch (error) {
            setErrorMessage("Failed to uninstall version.");
            setShowErrorPopup(true);
        }
    };

    const handleAction = useCallback(async (id: string, isInstalled: boolean, name: string) => {
        if (isInstalled) {
            await handleUninstall(id, name);
            return;
        }

        if (!hasRequiredPaths) {
            setShowPathPopup(true);
            return;
        }

        setPendingDownloadId(id);
        setShowConfirmPathPopup(true);
    }, [hasRequiredPaths, fetchMods]);

    return (
        <div className="flex flex-col items-center min-h-screen pt-[220px] pb-12">
            <div className="w-[90%] md:w-[80%] flex flex-col items-center relative">
                
                {/* File Explorer Button - Centered at top */}
                {user?.settings?.fivemDir && (
                    <div className="w-full flex justify-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <button
                            onClick={() => setShowFileExplorer(true)}
                            className="flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/40 text-primary hover:from-primary/30 hover:via-primary/20 hover:to-primary/30 hover:border-primary/60 hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] rounded-2xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl group"
                            title={isArabic ? "مستكشف الملفات" : "File Explorer"}
                        >
                            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                                <FolderTree className="w-7 h-7 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-black text-white tracking-tight">{isArabic ? "مستكشف ملفات المودات" : "Mod File Explorer"}</p>
                                <p className="text-xs text-primary/70 font-medium uppercase tracking-wider">{isArabic ? "تصفح واحذف الملفات" : "Browse & manage files"}</p>
                            </div>
                            <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center ml-2 group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>
                        </button>
                    </div>
                )}

                {/* Activation Section */}
                {(!user?.versions || user.versions.length === 0) && (
                    <ActivationBox onSuccess={async () => {
                        await checkAuth();
                        fetchMods();
                    }} />
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-12 h-12 text-white animate-spin opacity-20" />
                        <p className="mt-4 text-white/30 font-medium">{t.fetchingVersions}</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500/50 mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">{t.errorLoadingVersions}</h2>
                        <p className="text-white/40 max-w-md">{error}</p>
                        <button
                            onClick={() => fetchMods()}
                            className="mt-6 px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
                        >
                            {t.tryAgain}
                        </button>
                    </div>
                ) : mods.length > 0 ? (
                    <div className="w-full max-h-[70vh] overflow-y-auto no-scrollbar pr-2 pb-10">
                        <ModGrid mods={mods} onAction={handleAction} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-1000">
                        <div className="relative mb-8 group">
                            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="relative p-10 rounded-full bg-white/5 border border-white/10 shadow-2xl">
                                <Lock className="w-16 h-16 text-primary animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
                            {t.restrictedAccess}
                        </h3>
                        <p className="text-white/30 text-lg font-medium max-w-sm leading-relaxed mb-8">
                            {t.noAccessDesc}
                        </p>
                    </div>
                )}
            </div>

            {/* Path setup required popup */}
            {showPathPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
                    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                        <button
                            type="button"
                            onClick={() => setShowPathPopup(false)}
                            className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                        >
                            <X size={18} />
                        </button>

                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                                    <AlertTriangle size={26} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-primary/70">Setup Required</p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">Add your FiveM directory first</h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">
                                        You need to set your <span className="text-white/90">FiveM directory</span> before downloading mods.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-6 text-white hover:bg-white/10"
                                    onClick={() => setShowPathPopup(false)}
                                >
                                    Not now
                                </Button>
                                <Button
                                    type="button"
                                    className="h-12 rounded-2xl px-6 text-sm font-black"
                                    onClick={() => {
                                        setShowPathPopup(false);
                                        window.location.href = "/settings";
                                    }}
                                >
                                    Setup now
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Path Popup */}
            {showConfirmPathPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
                    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                        <button
                            type="button"
                            onClick={() => {
                                setShowConfirmPathPopup(false);
                                setPendingDownloadId(null);
                            }}
                            className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                        >
                            <X size={18} />
                        </button>

                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                                    <FolderCog size={26} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-primary/70">Confirm Path</p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">Confirm your FiveM directory</h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">
                                        Please confirm that this is your correct FiveM directory before continuing.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-sm text-white/70">
                                <div className="flex items-start gap-3">
                                    <FolderCog size={18} className="mt-0.5 text-primary" />
                                    <p className="break-all font-mono text-xs text-white/70">
                                        {user?.settings?.fivemDir || "No path selected"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-6 text-white hover:bg-white/10"
                                    onClick={() => {
                                        setShowConfirmPathPopup(false);
                                        setPendingDownloadId(null);
                                        window.location.href = "/settings";
                                    }}
                                >
                                    No
                                </Button>
                                <Button
                                    type="button"
                                    className="h-12 rounded-2xl px-6 text-sm font-black"
                                    onClick={async () => {
                                        const downloadId = pendingDownloadId;
                                        setShowConfirmPathPopup(false);
                                        setPendingDownloadId(null);
                                        if (downloadId) await runDownload(downloadId);
                                    }}
                                >
                                    Yes
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Popup */}
            {showSuccessPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
                    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                        <div className="absolute -top-20 left-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
                        <button
                            type="button"
                            onClick={() => setShowSuccessPopup(false)}
                            className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                        >
                            <X size={18} />
                        </button>

                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                                    <CheckCircle2 size={26} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-emerald-300/70">Complete</p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">{downloadedModName} has been installed</h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">The version has been successfully replaced in your game directory.</p>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-sm text-white/70">
                                <div className="flex items-start gap-3">
                                    <FolderCog size={18} className="mt-0.5 text-emerald-400" />
                                    <div className="space-y-1">
                                        <p className="font-semibold text-white/90">Installed to</p>
                                        <p className="break-all font-mono text-xs text-white/55">{downloadTargetPath}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        const electron = (window as any).electron;
                                        if (electron?.Reshade && user?.settings?.fivemDir) {
                                            try {
                                                await electron.Reshade({ fivemPath: user.settings.fivemDir });
                                                alert("Reshade has been configured locally.");
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }
                                    }}
                                    className="h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-6 font-bold"
                                >
                                    <Sparkles size={16} className="mr-2" /> Unblock Reshade
                                </Button>
                                <Button
                                    type="button"
                                    className="h-12 rounded-2xl px-8 text-sm font-black"
                                    onClick={() => setShowSuccessPopup(false)}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Popup */}
            {showErrorPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
                    <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-red-500/10 blur-3xl" />
                        <button
                            type="button"
                            onClick={() => setShowErrorPopup(false)}
                            className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-red-400"
                        >
                            <X size={18} />
                        </button>

                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-red-300">
                                    <XCircle size={26} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-red-300/70">Action Failed</p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">An error occurred</h2>
                                    <div className="max-w-lg text-sm leading-relaxed text-white/60 whitespace-pre-line">{errorMessage}</div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="button"
                                    className="h-12 rounded-2xl bg-red-500 hover:bg-red-600 px-8 text-sm font-black text-white"
                                    onClick={() => setShowErrorPopup(false)}
                                >
                                    Dismiss
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        
        {/* File Explorer Modal */}
        {showFileExplorer && user?.settings?.fivemDir && (
            <ModFileExplorer 
                fivemPath={user.settings.fivemDir} 
                onClose={() => setShowFileExplorer(false)} 
            />
        )}

        </div>
    );
}
