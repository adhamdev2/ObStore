"use client"

import React from "react";
import { Download, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import type { Mod } from "@/types/Mod";
import { buildAssetUrl } from "@/lib/api";

interface ModCardProps {
    mod: Mod;
    onDownload?: (id: string, isInstalled: boolean, name: string) => void;
}

export default function ModCard({ mod, onDownload }: ModCardProps) {
    return (
        <div className="group relative bg-black/25 border border-white/5 rounded-[32px] p-6 transition-all hover:bg-black/40 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer backdrop-blur-md overflow-hidden">
            <div className="aspect-16/10 bg-white/5 rounded-2xl overflow-hidden mb-6 relative group-hover:bg-white/10 transition-colors">
                {mod.image ? (
                    <img
                        src={mod.image ? buildAssetUrl(mod.image) : ""}
                        alt={mod.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-75 group-hover:brightness-100"
                        onError={(e) => {
                            e.currentTarget.src = "https://placehold.co/400x250/1a1a1a/666?text=Mod+Image";
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-16 h-1 bg-white/10 rounded-full" />
                    </div>
                )}

                {/* Status Badges over Image */}
                <div className="absolute top-4 right-4 flex gap-2">
                    {mod.isInstalled && (
                        <div className="bg-green-500/20 text-green-400 p-2 rounded-xl backdrop-blur-xl border border-green-500/20">
                            <CheckCircle2 size={20} />
                        </div>
                    )}
                    {mod.isIncompatible && (
                        <div className="bg-red-500/20 text-red-400 p-2 rounded-xl backdrop-blur-xl border border-red-500/20">
                            <AlertCircle size={20} />
                        </div>
                    )}
                </div>
            </div>

            {/* Mod Footer Info */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <h3 className="text-[19px] font-bold text-white/90 group-hover:text-primary transition-colors truncate">
                            {mod.name}
                        </h3>
                        {mod.version && (
                            <span className="text-xs text-white/40 font-medium">
                                {mod.modVersion}
                            </span>
                        )}
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload?.(mod.id, !!mod.isInstalled, mod.name);
                        }}
                        className={`p-3 rounded-2xl border transition-all group-active:scale-90 shadow-lg shrink-0 ${
                            mod.isInstalled 
                                ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:border-red-500/40" 
                                : "bg-white/5 border-white/10 hover:bg-primary hover:border-primary hover:text-black text-white"
                        }`}
                    >
                        {mod.isInstalled ? (
                            <Trash2 size={22} className="pointer-events-none transition-transform group-hover:scale-110" />
                        ) : (
                            <Download size={22} className="pointer-events-none transition-transform group-hover:-translate-y-0.5" />
                        )}
                    </button>
                </div>
                
                {mod.description && (
                    <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                        {mod.description}
                    </p>
                )}
            </div>

            {/* Hover Background Glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
