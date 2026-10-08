import React from "react";
import { Download, Trash2 } from "lucide-react";
import type { Mod } from "@/types/Mod";
import { buildAssetUrl } from "@/lib/api";

interface ModGridCardProps {
    mod: Mod;
    className?: string;
    onAction?: (id: string, isInstalled: boolean, name: string) => void;
}

const ModGridCard = React.memo(({ mod, className = "", onAction }: ModGridCardProps) => {
    const displayName = mod.name.startsWith("OB ") ? mod.name.replace("OB ", "") : mod.name;
    const isOB = mod.name.startsWith("OB ");

    return (
        <div
            className={`group relative overflow-hidden rounded-[24px] border border-white/5 bg-black/20 backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:shadow-2xl hover:shadow-white/5 ${className}`}
        >
            <div className="absolute inset-0">
                <img
                    src={mod.image ? buildAssetUrl(mod.image) : ""}
                    alt={mod.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 brightness-[0.6] group-hover:brightness-[0.4]"
                    onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/800x600/1a1a1a/666?text=" + mod.name;
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative z-10 flex flex-col items-center gap-2">
                    {mod.version && (
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 tracking-widest uppercase mb-2 group-hover:bg-white/10 transition-colors">
                            Version {mod.version}
                        </span>
                    )}
                    <h3 className="text-4xl md:text-5xl font-black text-white/40 uppercase tracking-tighter drop-shadow-2xl">
                        {isOB && "OB "}<span className="text-white/60">{displayName}</span>
                    </h3>
                </div>

                <div className="mt-8 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction?.(mod.id, !!mod.isInstalled, mod.name);
                        }}
                        className={`flex items-center gap-2 rounded-full px-8 py-3 font-bold transition-all hover:scale-105 active:scale-95 ${mod.isInstalled
                                ? "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                    >
                        {mod.isInstalled ? (
                            <>
                                <Trash2 size={18} className="pointer-events-none" />
                                <span>UNINSTALL</span>
                            </>
                        ) : (
                            <>
                                <Download size={18} className="pointer-events-none" />
                                <span>DOWNLOAD</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="pointer-events-none absolute -inset-1 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
        </div>
    );
});

export default ModGridCard;