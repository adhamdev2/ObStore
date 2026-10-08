"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export interface DownloadItem {
    downloadId: string;
    modName: string;
    progress: number;
    status: 'downloading' | 'installing' | 'finished' | 'failed' | 'queued';
    speed: number;
    downloadedBytes: number;
    totalBytes: number;
    chunks?: number;
}

interface DownloadContextType {
    downloads: Record<string, DownloadItem>;
    isDownloading: boolean;
    isPopoverOpen: boolean;
    setIsPopoverOpen: (open: boolean) => void;
    addDownload: (modId: string, modName: string, downloadFn: (downloadId: string) => Promise<any>) => Promise<void>;
    cancelDownload: (downloadId?: string) => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

const MAX_CONCURRENT_DOWNLOADS = 1; // Real queue: 1 by 1

export function DownloadProvider({ children }: { children: React.ReactNode }) {
    const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    // Queue management
    const queueRef = useRef<{ modId: string; modName: string; downloadFn: (id: string) => Promise<any> }[]>([]);
    const activeCountRef = useRef(0);

    const isDownloading = Object.values(downloads).some(d => d.status === 'downloading' || d.status === 'installing');

    const processQueue = useCallback(async () => {
        if (activeCountRef.current >= MAX_CONCURRENT_DOWNLOADS || queueRef.current.length === 0) return;

        const next = queueRef.current.shift()!;
        activeCountRef.current++;

        const downloadId = `dl_${next.modId}_${Date.now()}`;

        setDownloads(prev => {
            const newState = { ...prev };
            // Remove the "queued" placeholder for this mod
            Object.keys(newState).forEach(key => {
                if (key.startsWith(`queued_${next.modId}`)) {
                    delete newState[key];
                }
            });
            
            newState[downloadId] = {
                downloadId,
                modName: next.modName,
                progress: 0,
                status: 'downloading',
                speed: 0,
                downloadedBytes: 0,
                totalBytes: 0
            };
            return newState;
        });

        setIsPopoverOpen(true);

        try {
            await next.downloadFn(downloadId);
            setDownloads(prev => ({
                ...prev,
                [downloadId]: { ...prev[downloadId], status: 'finished', progress: 100 }
            }));
            window.dispatchEvent(new Event("force-refresh-mods"));
        } catch (err) {
            console.error("Download failed:", err);
            setDownloads(prev => ({
                ...prev,
                [downloadId]: { ...prev[downloadId], status: 'failed' }
            }));
        } finally {
            activeCountRef.current--;
            setTimeout(() => processQueue(), 0); // Ensure it runs after state updates
        }
    }, []); // No dependencies for stability

    const addDownload = useCallback(async (modId: string, modName: string, downloadFn: (id: string) => Promise<any>) => {
        // Check if already in queue or downloading
        const isDuplicate = queueRef.current.some(q => q.modId === modId) || 
                          Object.values(downloads).some(d => d.modName === modName && ['downloading', 'installing', 'queued'].includes(d.status));
        
        if (isDuplicate) {
            alert("هذا المود موجود بالفعل في قائمة التحميل.");
            return;
        }

        queueRef.current.push({ modId, modName, downloadFn });
        
        // Add to state as queued
        const tempId = `queued_${modId}_${Date.now()}`;
        setDownloads(prev => ({
            ...prev,
            [tempId]: {
                downloadId: tempId,
                modName,
                progress: 0,
                status: 'queued',
                speed: 0,
                downloadedBytes: 0,
                totalBytes: 0
            }
        }));

        processQueue();
    }, [downloads, processQueue]);

    const checkActiveDownloads = useCallback(async () => {
        const electron = (window as any).electron;
        if (!electron?.getActiveDownloads) return;

        try {
            const active = await electron.getActiveDownloads();
            if (active && Object.keys(active).length > 0) {
                setDownloads(prev => ({ ...prev, ...active }));
            }
        } catch (err) {
            console.error("Failed to check active downloads:", err);
        }
    }, []);

    const cancelDownload = useCallback(async (downloadId?: string) => {
        const electron = (window as any).electron;
        if (!electron?.cancelDownload) return;

        try {
            await electron.cancelDownload(downloadId);
            setDownloads(prev => {
                if (!downloadId) return {};
                const newDownloads = { ...prev };
                delete newDownloads[downloadId];
                return newDownloads;
            });
        } catch (err) {
            console.error("Failed to cancel download:", err);
        }
    }, []);

    useEffect(() => {
        checkActiveDownloads();

        const electron = (window as any).electron;
        if (!electron?.onDownloadProgress) return;

        // Throttle UI updates to 150ms to avoid re-rendering on every IPC progress event
    const pendingRef: { current: Record<string, any> } = { current: {} };
    let rafId: number | null = null;

    const flushPending = () => {
      rafId = null;
      const updatesToApply = { ...pendingRef.current };
      pendingRef.current = {};
      
      setDownloads(prev => {
        const next = { ...prev };
        for (const [id, update] of Object.entries(updatesToApply)) {
          next[id] = { ...next[id], ...update };
        }
        return next;
      });
    };

    const cleanup = electron.onDownloadProgress((data: any) => {
      if (data && data.downloadId) {
        if (data._clear) {
          setDownloads(prev => ({
            ...prev,
            [data.downloadId]: { ...prev[data.downloadId], status: 'finished', progress: 100 }
            }));
            window.dispatchEvent(new Event("force-refresh-mods"));
          return;
        }

        pendingRef.current[data.downloadId] = {
          ...pendingRef.current[data.downloadId],
          ...data,
          progress: Math.floor(data.progress || 0),
        };
        // Remove undefined values to avoid overwriting existing valid state with undefined
        Object.keys(pendingRef.current[data.downloadId]).forEach(key => {
          if (pendingRef.current[data.downloadId][key] === undefined) {
            delete pendingRef.current[data.downloadId][key];
          }
        });

        // Schedule a single flush (≈100ms debounce)
        if (!rafId) {
          rafId = setTimeout(flushPending, 100) as unknown as number;
        }
      }
    });

    return () => {
      if (rafId) clearTimeout(rafId as unknown as number);
      cleanup?.();
    };
    }, [checkActiveDownloads]);

    return (
        <DownloadContext.Provider value={{ 
            downloads,
            isDownloading, 
            isPopoverOpen,
            setIsPopoverOpen,
            addDownload,
            cancelDownload
        }}>
            {children}
        </DownloadContext.Provider>
    );
}

export function useDownload() {
    const context = useContext(DownloadContext);
    if (context === undefined) {
        throw new Error("useDownload must be used within a DownloadProvider");
    }
    return context;
}
