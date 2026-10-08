"use client";

import React from "react";
import { FiLogOut, FiStar, FiShield, FiCpu } from "react-icons/fi";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";

interface UserHeaderProps {
    isArabic?: boolean;
}

export default function UserHeader({ isArabic }: UserHeaderProps) {
    const { user, logout } = useAuth();
    const { t } = useTranslation();
    
    if (!user) return null;

    const avatarUrl = user.avatar 
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;

    // Get color styles based on roleName
    const getRoleStyles = (role: string) => {
        if (role?.includes("[OB]")) return "from-purple-500 via-fuchsia-500 to-pink-500 shadow-purple-500/30";
        if (role?.includes("ViP")) return "from-amber-400 via-yellow-500 to-amber-600 shadow-amber-500/20";
        if (role?.includes("Premium")) return "from-blue-400 via-indigo-500 to-purple-600 shadow-indigo-500/20";
        return "from-slate-400 to-slate-600 shadow-slate-500/20";
    };

    return (
        <div dir={isArabic ? "rtl" : "ltr"} className="relative overflow-hidden flex items-center justify-between p-6 px-10 bg-black/40 border border-white/5 shadow-2xl rounded-3xl backdrop-blur-md">
            {/* Background Glow Overlay */}
            <div className={`absolute top-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10 ${isArabic ? 'left-0' : 'right-0'}`} />
            
            <div className="flex items-center gap-8 group">
                {/* Avatar with dynamic glow */}
                <div className="relative">
                    <div className={`absolute -inset-1.5 bg-gradient-to-tr ${getRoleStyles(user.roleName || "")} opacity-30 blur-md rounded-full group-hover:opacity-60 transition-opacity duration-500`} />
                    <div className="relative w-[90px] h-[90px] rounded-full border-2 border-white/10 p-1 bg-black/60 shadow-2xl overflow-hidden">
                        <img
                            src={avatarUrl}
                            alt={user.username}
                            className="w-full h-full rounded-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <h3 className="text-[28px] font-black text-white tracking-tight drop-shadow-lg">
                            {user.username}
                        </h3>
                        
                        {/* Dynamic Role Badge */}
                        {(user.roleName || user.isPremium) && (
                            <div className={`flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r ${getRoleStyles(user.roleName || "")} rounded-full border border-white/20 shadow-lg animate-pulse-slow`}>
                                <FiStar className="text-white fill-white" size={12} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                                    {user.roleName || t.premium}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-6">
                        {/* codeVersion / Tech Rank Display */}
                        {user.versions && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <FiCpu className="text-primary" size={14} />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <FiShield className="text-white/20" size={14} />
                            <p className="text-[11px] text-white/30 font-mono uppercase tracking-[1px]">
                                ID: {user.id}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={logout}
                className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-300 active:scale-95 shadow-xl overflow-hidden`}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span className="text-sm font-bold uppercase tracking-[2px] text-white/60 group-hover:text-red-400 transition-colors">{t.logout}</span>
                <FiLogOut size={22} className={`text-white/40 group-hover:text-red-400 transition-all ${isArabic ? 'group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            </button>
        </div>
    );
}
