"use client";

import { useEffect, useState, useCallback } from "react";

export function useUpdateCheck() {
    const [canDownloadMods, setCanDownloadMods] = useState(true);
    const [isChecking, setIsChecking] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<{
        hasUpdate: boolean;
        currentVersion: string;
        latestVersion: string;
        currentBuild: number;
        latestBuild: number;
    } | null>(null);

    const checkCanDownloadMods = useCallback(async () => {
        if (typeof window === "undefined" || !window.electron) {
            setCanDownloadMods(true);
            return;
        }

        setIsChecking(true);
        try {
            const canDownload = await window.electron.canDownloadMods();
            setCanDownloadMods(canDownload);

            const status = await window.electron.getUpdateStatus();
            setUpdateStatus({
                hasUpdate: status.hasUpdate,
                currentVersion: status.currentVersion,
                latestVersion: status.latestVersion,
                currentBuild: status.currentBuild,
                latestBuild: status.latestBuild,
            });
        } catch (err) {
            console.error("Failed to check update status:", err);
            setCanDownloadMods(true);
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        checkCanDownloadMods();
        const interval = setInterval(checkCanDownloadMods, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkCanDownloadMods]);

    return {
        canDownloadMods,
        isChecking,
        updateStatus,
        checkCanDownloadMods,
    };
}