"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FolderOpen, File, Trash2, ChevronRight, ChevronDown, Search, AlertTriangle, Loader2, X, Upload, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ModFileInfo {
    name: string;
    path: string;
    relativePath: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: string;
    modId: string | null;
    modName: string | null;
    modType: string | null;
    installedAt: string | null;
}

interface ModFileExplorerProps {
    fivemPath: string;
    onClose: () => void;
}

const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateStr: string) => {
    try {
        return new Date(dateStr).toLocaleString();
    } catch {
        return dateStr;
    }
};

const getModTypeColor = (type: string | null) => {
    switch (type) {
        case "version": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
        case "modpack": return "text-purple-400 bg-purple-400/10 border-purple-400/20";
        default: return "text-white/40 bg-white/5 border-white/10";
    }
};

export default function ModFileExplorer({ fivemPath, onClose }: ModFileExplorerProps) {
    const { t, isArabic } = useTranslation();
    const [data, setData] = useState<ModFileInfo[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFile, setSelectedFile] = useState<ModFileInfo | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const closeModal = useCallback(() => {
        onClose();
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        if (!window.electron?.installDroppedFile) {
            alert("Desktop app required");
            return;
        }

        setUploading(true);
        try {
            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const data = Array.from(new Uint8Array(arrayBuffer));
                
                // Send file data directly to Electron to handle temp + install
                await window.electron.installDroppedFile({
                    fileName: file.name,
                    data,
                    targetFivemPath: fivemPath
                });
            }
            loadFiles();
        } catch (err) {
            console.error("Drop upload failed:", err);
            alert(`${isArabic ? "فشل رفع الملف:" : "Upload failed:"} ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [fivemPath]);

    const loadFiles = async () => {
        if (!window.electron?.exploreModFiles) {
            setError("Desktop app required");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await window.electron.exploreModFiles({ fivemPath });
            if (result.error) {
                setError(result.error);
            } else {
                setData(result.mods || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load files");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (file: ModFileInfo) => {
        if (!confirm(`${isArabic ? "هل أنت متأكد من حذف" : "Are you sure you want to delete"} "${file.name}"?`)) return;
        
        setDeleting(file.path);
        try {
            if (!window.electron?.deleteModFile) throw new Error("Desktop app required");
            const result = await window.electron.deleteModFile({ fivemPath, filePath: file.path });
            if (result.success) {
                loadFiles();
            } else {
                alert(`${isArabic ? "فشل الحذف:" : "Delete failed:"} ${result.error}`);
            }
        } catch (err) {
            alert(`${isArabic ? "فشل الحذف:" : "Delete failed:"} ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setDeleting(null);
        }
    };

    const filterFiles = (files: ModFileInfo[]) => {
        if (!searchQuery) return files;
        const query = searchQuery.toLowerCase();
        return files.filter(f => 
            f.name.toLowerCase().includes(query) ||
            f.modName?.toLowerCase().includes(query) ||
            f.relativePath.toLowerCase().includes(query)
        );
    };

    if (!data && !loading) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleBackdropClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="dialog"
            aria-modal="true"
            aria-label={isArabic ? "مستكشف ملفات المودات" : "Mod File Explorer"}
        >
            <div 
                ref={modalRef}
                className="relative w-full max-w-4xl max-h-[85vh] bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/30 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-lg">{isArabic ? "مستكشف ملفات المودات" : "Mod File Explorer"}</h2>
                            <p className="text-xs text-white/40 truncate max-w-xs" dir="ltr">{fivemPath}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder={isArabic ? "بحث في الملفات..." : "Search files..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 text-sm"
                            />
                        </div>
                        <button
                            onClick={closeModal}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            aria-label={isArabic ? "إغلاق" : "Close"}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Drop Zone Indicator */}
                <div 
                    className={`px-4 py-3 border-b border-white/5 transition-all duration-300 ${dragActive ? 'bg-primary/10 border-b-primary/30' : 'bg-white/3'}`}
                >
                    <div className="flex items-center justify-center gap-2 text-center">
                        <Upload className={`w-5 h-5 ${dragActive ? 'text-primary animate-bounce' : 'text-white/30'}`} />
                        <span className="text-sm text-white/60">
                            {dragActive 
                                ? (isArabic ? "أفلت الملفات هنا" : "Drop files here") 
                                : (isArabic ? "اسحب وأفلت ملفات للمودات هنا" : "Drag & drop files to mods folder")}
                        </span>
                        <Plus className={`w-4 h-4 ${dragActive ? 'text-primary' : 'text-white/30'}`} />
                    </div>
                </div>

                {/* Content */}
                <div 
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {data && (
                        <>
                            <div className="border-l-2 border-white/5 pl-4 ml-2">
                                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
                                     onClick={() => setExpanded(!expanded)}>
                                    <span className="text-2xl">📦</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">{isArabic ? "المودات" : "Mods"}</p>
                                        <p className="text-xs text-white/40">
                                            {filterFiles(data).length} / {data.length} {isArabic ? "ملفات" : "items"}
                                        </p>
                                    </div>
                                    <ChevronDown className={`text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                                </div>
                                
                                {expanded && (
                                    <div className="mt-2 space-y-1">
                                        {loading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                            </div>
                                        ) : filterFiles(data).length === 0 ? (
                                            <div className="text-center py-8 text-white/30">
                                                {searchQuery 
                                                    ? `${isArabic ? "لا توجد نتائج لـ" : "No results for"} "${searchQuery}"`
                                                    : `${isArabic ? "المجلد فارغ" : "Folder is empty"}`}
                                            </div>
                                        ) : (
                                            filterFiles(data).map((file, index) => (
                                                <div
                                                    key={`${file.path}`}
                                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                                                        selectedFile?.path === file.path 
                                                            ? "bg-primary/10 border border-primary/30" 
                                                            : "bg-white/3 hover:bg-white/5 border border-transparent"
                                                    }`}
                                                    onClick={() => setSelectedFile(selectedFile?.path === file.path ? null : file)}
                                                >
                                                    {file.isDirectory ? (
                                                        <FolderOpen className="w-5 h-5 text-amber-400" />
                                                    ) : (
                                                        <File className="w-5 h-5 text-blue-400" />
                                                    )}
                                                    
                                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                        <p className="font-medium text-white truncate">{file.name}</p>
                                                        <div className="flex items-center gap-3 text-xs text-white/40">
                                                            <span>{formatBytes(file.size)}</span>
                                                            <span>{formatDate(file.modifiedAt)}</span>
                                                            {file.modName && (
                                                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${getModTypeColor(file.modType)}`}>
                                                                    {file.modName} ({file.modType})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {!file.isDirectory && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                                                            disabled={deleting === file.path}
                                                            className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                                            title={isArabic ? "حذف الملف" : "Delete file"}
                                                        >
                                                            {deleting === file.path ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="ml-3 text-white/60">{isArabic ? "جاري تحميل الملفات..." : "Loading files..."}</span>
                        </div>
                    )}
                </div>

                {/* Selected file details */}
                {selectedFile && (
                    <div className="p-4 border-t border-white/10 bg-black/30 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {selectedFile.isDirectory ? (
                                    <FolderOpen className="w-8 h-8 text-amber-400 flex-shrink-0" />
                                ) : (
                                    <File className="w-8 h-8 text-blue-400 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="font-semibold text-white truncate">{selectedFile.name}</p>
                                    <p className="text-xs text-white/40 truncate" dir="ltr">{selectedFile.relativePath}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-white/50 flex-shrink-0">
                                <span>{formatBytes(selectedFile.size)}</span>
                                <span>{formatDate(selectedFile.modifiedAt)}</span>
                                {selectedFile.modName && (
                                    <span className={`px-2 py-1 rounded border text-[10px] font-medium ${getModTypeColor(selectedFile.modType)}`}>
                                        {selectedFile.modName}
                                    </span>
                                )}
                                {selectedFile.installedAt && (
                                    <span className="px-2 py-1 rounded border border-white/10 bg-white/5">
                                        {isArabic ? "تم التثبيت:" : "Installed:"} {formatDate(selectedFile.installedAt)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}