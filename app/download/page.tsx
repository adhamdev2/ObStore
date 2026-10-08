"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Mod } from "@/types/Mod";
import DownloadPageContent from "@/components/sections/download/DownloadPageContent";
import AuthGuard from "@/components/ui/AuthGuard";
import CodeGuard from "@/components/ui/CodeGuard";

import { useAuth } from "@/lib/auth";

export default function DownloadPage() {
    const { user } = useAuth();
    const [mods, setMods] = useState<Mod[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMods = useCallback(async () => {
        try {
            setIsLoading(true);
            
            const electron = (window as any).electron;
            let installedIds: string[] = [];
            let fivemPath = user?.settings?.fivemDir?.trim() || "";
            
            // Fallback to /paths API if not in user settings
            if (!fivemPath) {
                try {
                    const pathsResponse = await apiFetch<{ paths: { fivemPath: string } }>("/paths");
                    fivemPath = pathsResponse.paths.fivemPath;
                } catch {}
            }
            
            console.log(`[Download Page - Fetch] Using fivemPath: ${fivemPath}`);
            
            if (electron?.getInstalledMods && fivemPath) {
                const items = await electron.getInstalledMods({ fivemPath });
                installedIds = items.map((i: any) => i.id);
            }

            const backendMods = await apiFetch<any[]>("/mods?type=ModPack");

            if (backendMods) {
                const downloadedIds = user?.downloads?.map((d: any) => d.id) || [];
                const mappedMods: Mod[] = backendMods.map(plugin => ({
                    ...plugin,
                    category: (plugin.category || "ModPack").toLowerCase(),
                    isInstalled: installedIds.includes(plugin.id) || downloadedIds.includes(plugin.id),
                    isIncompatible: false,
                    config: plugin.config
                }));
                setMods(mappedMods);
            }
        } catch (error) {
            console.error("Failed to fetch mods for download:", error);
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

    return (
        <AuthGuard>
            <main className="min-h-screen">
                {isLoading ? (
                    <div className="min-h-screen flex items-center justify-center text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary opacity-20"></div>
                    </div>
                ) : (
                    <DownloadPageContent mods={mods} onRefresh={fetchMods} />
                )}
            </main>
        </AuthGuard>
    );
}
