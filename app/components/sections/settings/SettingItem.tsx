"use client"

import React from "react";
import type { SettingItemType } from "@/constants/Settings";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/hooks/useTranslation";
import { apiFetch } from "@/lib/api";



export default function SettingItem({ 
    item,
    onUpdate,
    fivemDir
}: { 
    item: SettingItemType;
    onUpdate?: (val: string | number) => void;
    fivemDir?: string;
}) {
    const { t } = useTranslation();
    const [sliderValue, setSliderValue] = React.useState([Number(item.value) || 70]);
    const Icon = item.icon;

    const handleAction = async () => {
        if (item.type === "path") {
            if (!window.electron) {
                alert(t.desktopOnly);
                return;
            }

            let path: string | null = null;
            if (item.id === "fivem-directory") {
                const result = await window.electron.selectFiveMExe();
                if (result && "error" in result) {
                    alert(result.error);
                    return;
                }
                path = result?.path ?? null;
            } else {
                path = await window.electron.selectFolder() ?? null;
            }

            if (path && onUpdate) {
                onUpdate(path);
            }
        } else if (item.id === "desktop-shortcut") {
            alert(t.creatingShortcut);

        } else if (item.id === "delete-mods") {
            if (!fivemDir) {
                alert(t.setFiveMDirectoryFirst || "Please set the FiveM directory first.");
                return;
            }
            if (!window.electron?.deleteModFolders) {
                alert(t.desktopOnly || "This feature is only available in the desktop app.");
                return;
            }
            
            if (!window.confirm(t.confirmDeleteAllMods || "Are you sure you want to delete all plugins, mods, and citizen folders? This cannot be undone.")) {
                return;
            }

            try {
                // Delete from local disk
                await window.electron.deleteModFolders({ fivemPath: fivemDir }).catch(e => console.error("Local delete failed, ignoring:", e));
                
                // Clear backend downloads list completely
                await apiFetch('/user/downloads', { method: 'DELETE' }).catch(e => console.error("Failed to clear backend downloads:", e));

                // Force refresh UI globally
                window.dispatchEvent(new Event("force-refresh-mods"));

                alert(t.deleteAllModsSuccess || "All mods deleted successfully.");
            } catch (error) {
                console.error("Failed to delete mods:", error);
                alert(`${t.deleteAllModsFailed || "Failed to delete mods"}: ${error instanceof Error ? error.message : String(error)}`);
            }

} else if (item.id === "change-reshade-key") {
            if (!fivemDir) {
                alert(t.setFiveMDirectoryFirst);
                return;
            }

            if (!window.electron?.changeReshadeKey) {
                alert(t.desktopOnly);
                return;
            }

            // Create a modal to capture key press
            const keyCode = await new Promise<number | null>((resolve) => {
                const modal = document.createElement("div");
                modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm";
                modal.innerHTML = `
                    <div class="relative w-full max-w-md p-8 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl text-center">
                        <div class="mb-6">
                            <div class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                                <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <p class="text-lg font-semibold text-white">${t.reshadeKeyPrompt}</p>
                            <p class="text-sm text-white/50 mt-2">Press any key (A-Z, 0-9, F1-F12, Space, Enter, etc.)</p>
                        </div>
                        <div class="text-center text-2xl font-mono text-primary font-bold min-h-[40px]" id="key-display">...</div>
                    </div>
                `;
                document.body.appendChild(modal);

                const display = modal.querySelector("#key-display") as HTMLElement;
                
                const handleKeyDown = (e: KeyboardEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const code = e.keyCode || e.which || e.code;
                    // Convert code to keyCode if needed
                    let keyCode = e.keyCode;
                    if (!keyCode && e.code) {
                        // Map some common codes
                        const codeMap: Record<string, number> = {
                            "Backspace": 8, "Tab": 9, "Enter": 13, "ShiftLeft": 16, "ShiftRight": 16,
                            "ControlLeft": 17, "ControlRight": 17, "AltLeft": 18, "AltRight": 18,
                            "Escape": 27, "Space": 32, "PageUp": 33, "PageDown": 34,
                            "End": 35, "Home": 36, "ArrowLeft": 37, "ArrowUp": 38,
                            "ArrowRight": 39, "ArrowDown": 40, "Insert": 45, "Delete": 46,
                            "F1": 112, "F2": 113, "F3": 114, "F4": 115, "F5": 116,
                            "F6": 117, "F7": 118, "F8": 119, "F9": 120, "F10": 121,
                            "F11": 122, "F12": 123
                        };
                        keyCode = codeMap[e.code] || 0;
                    }
                    if (keyCode > 0) {
                        display.textContent = `Key Code: ${keyCode} (${e.key})`;
                        setTimeout(() => {
                            document.removeEventListener("keydown", handleKeyDown);
                            document.body.removeChild(modal);
                            resolve(keyCode);
                        }, 300);
                    }
                };

                document.addEventListener("keydown", handleKeyDown);

                // Cleanup on click outside
                modal.addEventListener("click", (e) => {
                    if (e.target === modal) {
                        document.removeEventListener("keydown", handleKeyDown);
                        document.body.removeChild(modal);
                        resolve(null);
                    }
                });
            });

            if (!keyCode) return;

            try {
                const result = await window.electron.changeReshadeKey({ fivemPath: fivemDir, keyCode });
                if (result.success) {
                    alert(t.reshadeKeySuccess);
                } else {
                    alert(`${t.reshadeKeyFailed}: ${result.error || t.reshadeNotInstalled}`);
                }
            } catch (error) {
                console.error("Failed to change Reshade key:", error);
                alert(`${t.reshadeKeyFailed}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };

const getTranslatedLabel = (id: string, defaultLabel: string) => {
        if (id === "fivem-directory") return t.changeFivemDir;
        if (id === "delete-mods") return t.deleteAllMods;
        if (id === "change-reshade-key") return t.changeReshadeKey;
        return defaultLabel;
    };

    return (
        <div
            onClick={handleAction}
            className={`group flex items-center justify-between p-5 px-10 bg-black/25 border border-white/5 hover:bg-black/40 transition-all cursor-pointer shadow-lg rounded-2xl`}
        >
            {/* Left side: Icon and Label */}
            <div className={`flex items-center gap-6`}>
                {Icon && (
                    <div className="text-primary/95 text-xl group-hover:scale-110 transition-transform">
                        <Icon />
                    </div>
                )}
                <span className="text-[17px] font-medium text-white/90 group-hover:text-white transition-colors">
                    {getTranslatedLabel(item.id, item.label)}
                </span>
            </div>

            {/* Right side: Values/Actions */}
            <div className={`flex items-center gap-8`}>
                {item.type === "slider" && (
                    <div className={`flex items-center gap-6 min-w-[420px]`} onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] uppercase tracking-wider text-white/20 font-bold">{item.min}</span>
                        <Slider
                            defaultValue={sliderValue}
                            max={item.max || 100}
                            min={item.min || 50}
                            step={1}
                            onValueChange={(val) => {
                                setSliderValue(val);
                                if (onUpdate) onUpdate(val[0]);
                            }}
                        />
                        <span className="text-[11px] uppercase tracking-wider text-white/20 font-bold">{item.max}</span>
                    </div>
                )}

                {item.type === "path" && (
                    <span className="pointer-events-none text-[13px] text-primary/60 font-mono truncate max-w-[450px] bg-primary/5 px-4 py-2 rounded-lg border border-primary/10" dir="ltr">
                        {item.value || t.notSelected}
                    </span>
                )}
            </div>
        </div>
    );
}

