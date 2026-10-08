"use client"

import React, { useState, useMemo } from "react";
import SearchBar from "./SearchBar";
import FilterSidebar from "./FilterSidebar";
import ModCard from "./ModCard";
import DownloadProgress from "./DownloadProgress";
import type { Mod, ModCategory } from "@/types/Mod";
import { useAuth } from "@/lib/auth";
import { useDownload } from "@/lib/DownloadContext";
import { apiFetch, buildApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FolderCog, X, Info, XCircle, History, Lock } from "lucide-react";
import ActivationBox from "../mods/ActivationBox";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";

interface DownloadPageContentProps {
    mods: Mod[];
    onRefresh: () => void;
}

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

export default function DownloadPageContent({ mods, onRefresh }: DownloadPageContentProps) {
    const { user, checkAuth } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<ModCategory>("all");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [showPathPopup, setShowPathPopup] = useState(false);
    const [showConfirmPathPopup, setShowConfirmPathPopup] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [downloadedModName, setDownloadedModName] = useState("");
    const [downloadTargetPath, setDownloadTargetPath] = useState("");
    const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);
    const { isPopoverOpen, setIsPopoverOpen, addDownload } = useDownload();
    const [errorType, setErrorType] = useState<"client" | "server" | null>(null);
    const { t, isArabic } = useTranslation();
    const { canDownloadMods, updateStatus, isChecking: isUpdateChecking } = useUpdateCheck();

    const hasRequiredPaths = Boolean(user?.settings?.fivemDir?.trim());

    // Filtering and Sorting Logic
    const filteredMods = useMemo(() => {
        let result = mods.filter((mod) => {
            const matchesSearch = mod.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = activeFilter === "all" || mod.category === activeFilter;
            return matchesSearch && matchesFilter;
        });

        return result.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return sortOrder === "asc" ? comparison : -comparison;
        });
    }, [mods, searchQuery, activeFilter, sortOrder]);

    const showUpdateRequiredPopup = (mandatory: boolean) => {
        const message = mandatory
            ? "يجب تحديث التطبيق إلى أحدث إصدار قبل تحميل المودات. هذا تحديث إجباري."
            : "يتوفر تحديث جديد للتطبيق. يوصى بتحديث التطبيق قبل تحميل المودات.";
        
        alert(message);
    };

    const runDownload = async (id: string) => {
        const electron = window.electron;

        if (!electron?.downloadModArchive) {
            alert("Download to game directory is only available in the desktop app.");
            return;
        }

        // Check if app is on latest version before allowing download
        if (!canDownloadMods && updateStatus?.hasUpdate) {
            showUpdateRequiredPopup((updateStatus.latestBuild - updateStatus.currentBuild) >= 3);
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

        await addDownload(mod.id, mod.name, async (downloadId: string) => {
            try {
                const category = mod.category.toLowerCase();
                const itemType = category === "plugin" ? "plugins" : category === "version" || category === "versions" ? "versions" : "mods";
                const downloadType = itemType === "versions" ? "version" : "modpack";
                const download = await apiFetch<DownloadSessionResponse>(`/mods/${encodeURIComponent(mod.id)}/downloads?type=${itemType}`, { method: "POST" });
                const result = await electron.downloadModArchive({
                    url: buildApiUrl(download.downloadUrl),
                    targetPath: currentPath,
                    modId: mod.id,
                    modName: mod.name,
                    type: downloadType,
                    installDirectories: pathsResponse.paths.fivemModsDIRS,
                    skipDeletion: true,
                    downloadId
                });

                try {
                    await apiFetch<any>("/user/downloads", {
                        method: "POST",
                        body: JSON.stringify({
                            id: mod.id,
                            name: mod.name,
                            version: mod.id,
                            type: downloadType,
                            modType: itemType,
                            files: result.installedFiles
                        })
                    });
                } catch (err) {
                    console.error("Failed to record mod download:", err);
                }

                onRefresh();
                window.dispatchEvent(new Event("force-refresh-mods"));
                return result;
            } catch (error) {
                console.error("Download inner error:", error);
                throw error;
            }
        });
    };

    const handleUninstall = async (id: string, name: string) => {
        const electron = window.electron;
        if (!electron?.uninstallMod) return;

        if (!window.confirm(`هل أنت متأكد أنك تريد حذف ${name}؟ سيتم إزالة ملفات المود من مجلد اللعبة.`)) {
            return;
        }

        const modInBackend = user?.downloads?.find(d => d.id === id);

        let pathsResponse: PathsResponse;
        try {
            pathsResponse = await apiFetch<PathsResponse>("/paths");
        } catch {
            alert("FiveM directory not set. Please set it in Settings.");
            return;
        }
        const currentPath = pathsResponse.paths.fivemPath;

        console.log(`[Download Page - Uninstall] Using fivemPath from API: ${currentPath}`);

        try {
            await electron.uninstallMod({ id, files: modInBackend?.files, fivemPath: currentPath }).catch((err: any) => console.error("Local uninstall failed, ignoring:", err));

            // Remove from backend history
            await apiFetch(`/user/downloads/${id}`, { method: "DELETE" }).catch(err => console.error("Failed to delete download from backend:", err));

            onRefresh();

            // Notify other components (Navbar)
            window.dispatchEvent(new Event("force-refresh-mods"));
        } catch (error) {
            setErrorMessage("Failed to uninstall ModPack.");
            setShowErrorPopup(true);
        }
    };

    const handleDownload = async (id: string, isInstalled: boolean, name: string) => {
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
    };

    const toggleSort = () => {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    };


    return (
        <>
            <div className="w-full flex-1 flex flex-col items-center justify-start pt-[220px] px-8 md:px-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-full max-w-[1440px] flex flex-col gap-6">

                    {/* Activation Section */}
                    {(!user?.versions || user.versions.length === 0) && (
                        <div className="flex justify-center mb-10">
                            <ActivationBox onSuccess={async () => {
                                await checkAuth();
                                onRefresh();
                            }} />
                        </div>
                    )}

                    {/* Top Header: Filter + Search and Sort */}
                    <div className="flex items-center gap-4 w-full">
                        <FilterSidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                        <div className="flex-1">
                            <SearchBar onSearch={setSearchQuery} onSort={toggleSort} sortOrder={sortOrder} />
                        </div>
                    </div>

                    {/* Mod Cards Grid */}
                    <div className="mt-4">
                        <div className="max-h-[70vh] overflow-y-auto no-scrollbar pr-2 pb-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in transition-all duration-700">
                                    {filteredMods.length > 0 ? (
                                        filteredMods.map((mod) => (
                                            <ModCard key={mod.id} mod={mod} onDownload={handleDownload} />
                                        ))
                                    ) : mods.length > 0 ? (
                                        <div className="col-span-full h-[450px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-[40px] backdrop-blur-xl relative overflow-hidden group">
                                            <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-1000">
                                                <h3 className="text-3xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40 mb-3">
                                                    {t.noResults}
                                                </h3>
                                                <p className="text-white/30 text-lg font-medium max-w-[400px] text-center leading-relaxed">
                                                    {t.noResultsDesc}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="col-span-full h-[450px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-[40px] backdrop-blur-xl relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                            <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-1000">
                                                <div className="relative mb-8 group">
                                                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                                    <div className="relative p-10 rounded-full bg-white/5 border border-white/10 shadow-2xl">
                                                        <Lock className="w-16 h-16 text-primary animate-pulse" />
                                                    </div>
                                                </div>

                                                <h3 className="text-3xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40 mb-3">
                                                    {t.restrictedAccess}
                                                </h3>
                                                <p className="text-white/30 text-lg font-medium max-w-[400px] text-center leading-relaxed">
                                                    {t.noAccessDesc}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>
                </div>
            </div>

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
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-primary/70">
                                        Setup Required
                                    </p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">
                                        Add your FiveM directory first
                                    </h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">
                                        You need to set your <span className="text-white/90">FiveM directory</span> before downloading mods.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-sm text-white/70">
                                <div className="flex items-center gap-3">
                                    <FolderCog size={18} className={user?.settings?.fivemDir?.trim() ? "text-emerald-400" : "text-white/30"} />
                                    <span>FiveM directory {user?.settings?.fivemDir?.trim() ? "is set" : "is missing"}</span>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
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
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-primary/70">
                                        Confirm Path
                                    </p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">
                                        Confirm your FiveM directory
                                    </h2>
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
                                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
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

                                        if (downloadId) {
                                            await runDownload(downloadId);
                                        }
                                    }}
                                >
                                    Yes
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-emerald-300/70">
                                        Download Complete
                                    </p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">
                                        {downloadedModName || "Mod"} has been added
                                    </h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">
                                        The compressed file was saved inside your game directory.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-sm text-white/70">
                                <div className="flex items-start gap-3">
                                    <FolderCog size={18} className="mt-0.5 text-emerald-400" />
                                    <div className="space-y-1">
                                        <p className="font-semibold text-white/90">Saved to</p>
                                        <p className="break-all font-mono text-xs text-white/55">
                                            {downloadTargetPath}
                                        </p>
                                    </div>
                                </div>
                            </div>


                            <div className="flex justify-end">
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
                                    <p className="text-[12px] font-black uppercase tracking-[0.35em] text-red-300/70">
                                        Action Failed
                                    </p>
                                    <h2 className="text-3xl font-black tracking-tight text-white">
                                        An error occurred
                                    </h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/60">
                                        {errorMessage}
                                    </p>
                                    
                                    {errorType && (
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            errorType === "server" 
                                                ? "bg-orange-500/10 border-orange-500/20 text-orange-400" 
                                                : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                        }`}>
                                            <div className={`w-1 h-1 rounded-full animate-pulse ${
                                                errorType === "server" ? "bg-orange-400" : "bg-blue-400"
                                            }`} />
                                            {errorType === "server" ? "Server Side Error" : "Client Side Error"}
                                        </div>
                                    )}
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

        </>
    );
}
