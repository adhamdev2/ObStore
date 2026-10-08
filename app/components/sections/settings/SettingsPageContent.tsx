"use client";

import React, { useEffect, useState } from "react";
import UserHeader from "./UserHeader";
import LanguageSelector from "./LanguageSelector";
import SettingItem from "./SettingItem";
import { SettingsData } from "@/constants/Settings";
import { useAuth } from "@/lib/auth";
import { FiUser, FiShield, FiHash } from "react-icons/fi";
import { Package, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";
import ActivationBox from "../mods/ActivationBox";
import { useTranslation } from "@/hooks/useTranslation";
import AppInfoSection from "./AppInfoSection";

interface UserSettings {
    theme: string;
    language: string;
    notifications: boolean;
    fivemDir: string;
}

export default function SettingsPageContent() {
    const { user, checkAuth, updateUserSettings } = useAuth();
    const { t, isArabic } = useTranslation();
    
    const [settings, setSettings] = useState<UserSettings>({
        theme: "dark",
        language: "en",
        notifications: true,
        fivemDir: ""
    });

    useEffect(() => {
        if (user?.settings) {
            setSettings((current) => ({ ...current, ...user.settings }));
        }
    }, [user?.settings]);

    if (!user) return null;

    const updateSettings = async (newSettings: Partial<UserSettings>) => {
        try {
            const updated = { ...settings, ...newSettings };
            setSettings(updated);
            updateUserSettings(updated);
            await apiFetch("/user/settings", {
                method: "PUT",
                body: JSON.stringify(updated)
            });
            await checkAuth();
        } catch (error) {
            console.error("Failed to update settings:", error);
        }
    };

    return (
        <div 
            dir={isArabic ? "rtl" : "ltr"}
            className="w-full flex-1 flex flex-col items-center justify-start pt-[220px] px-8 md:px-20 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700"
        >
            <div className="w-full mt-[2%] max-w-[1300px] bg-primary/10 backdrop-blur-lg border border-white/5 p-8 md:p-12 flex flex-col gap-14 backdrop-blur-2xl rounded-[40px] shadow-2xl relative overflow-hidden">
                {/* Decorative element */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mt-64" />
                
                {/* Profile Section */}
                <UserHeader isArabic={isArabic} />

                {/* Account Details Section */}
                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex flex-col gap-1">
                        <h4 className="text-[14px] font-bold text-primary tracking-[4px] uppercase px-1">
                            {t.accountInfo}
                        </h4>
                        <div className="w-24 h-1 bg-primary/30 rounded-full mx-1" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-black/30 backdrop-blur-md border border-white/5 p-8 rounded-3xl flex flex-col gap-4 group hover:border-primary/30 transition-all duration-500 hover:translate-y-[-4px]">
                            <div className="flex items-center gap-4 text-primary/80">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <FiUser size={22} />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-[2px] text-white/40">{t.username}</span>
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">{user.username}</span>
                        </div>

                        <div className="bg-black/30 backdrop-blur-md border border-white/5 p-8 rounded-3xl flex flex-col gap-4 group hover:border-primary/30 transition-all duration-500 hover:translate-y-[-4px]">
                            <div className="flex items-center gap-4 text-primary/80">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <FiHash size={22} />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-[2px] text-white/40">{t.discordId}</span>
                            </div>
                            <span className="text-xl font-mono text-white/60 truncate">{user.id}</span>
                        </div>

                        <div className="bg-black/30 backdrop-blur-md border border-white/5 p-8 rounded-3xl flex flex-col gap-4 group hover:border-primary/30 transition-all duration-500 hover:translate-y-[-4px]">
                            <div className="flex items-center gap-4 text-primary/80">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <FiShield size={22} />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-[2px] text-white/40">{t.status}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${user.hasRequiredRole ? "bg-primary" : "bg-white/40"}`} />
                                <span className={`text-xl font-bold ${user.hasRequiredRole ? "text-primary" : "text-white/70"}`}>
                                    {user.hasRequiredRole ? t.vipClient : t.standard}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activation Section - Always Visible */}
                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex flex-col gap-1">
                        <h4 className="text-[14px] font-bold text-primary tracking-[4px] uppercase px-1">
                            {t.productActivation}
                        </h4>
                        <div className="w-20 h-1 bg-primary/30 rounded-full mx-1" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="w-full">
                            <ActivationBox onSuccess={() => checkAuth()} />
                        </div>
                        
                        <div className="w-full bg-black/30 backdrop-blur-md border border-white/5 rounded-[28px] p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-3 text-primary/80">
                                <div className="p-2.5 bg-primary/10 rounded-xl">
                                    <Package size={20} />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-wider text-white">{t.activeProducts}</h3>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {user.versions && user.versions.length > 0 ? (
                                    user.versions.map((version) => (
                                        <div key={version} className="flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl hover:border-primary/30 transition-all duration-300 group">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                                            <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors uppercase tracking-tight">{version}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full py-6 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                                        <Activity className="text-white/10 mb-2" size={24} />
                                        <p className="text-xs font-medium text-white/20 italic tracking-wide">{t.noProducts}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Language Section */}
                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex flex-col gap-1">
                        <h4 className="text-[14px] font-bold text-primary tracking-[4px] uppercase px-1">
                            {t.regionalSettings}
                        </h4>
                        <div className="w-16 h-1 bg-primary/30 rounded-full mx-1" />
                    </div>
                    <LanguageSelector 
                        defaultLang={settings.language} 
                        onSelect={(lang) => updateSettings({ language: lang })}
                    />
                </div>

                {/* App Info Section */}
                <AppInfoSection />

                {/* Application Section */}
                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex flex-col gap-1">
                        <h4 className="text-[14px] font-bold text-primary tracking-[4px] uppercase px-1">
                            {t.appPrefs}
                        </h4>
                        <div className="w-32 h-1 bg-primary/30 rounded-full mx-1" />
                    </div>

                    <div className="flex flex-col gap-4">
                        {SettingsData.map((item) => {
                            // Override hardcoded value with DB value if exists
                            let currentValue = item.value;
                            if (item.id === "fivem-directory") currentValue = settings.fivemDir;

                            return (
                                <SettingItem 
                                    key={item.id} 
                                    item={{...item, value: currentValue}} 
                                    fivemDir={settings.fivemDir}
                                    onUpdate={(val: string | number) => {
                                        if (item.id === "fivem-directory") updateSettings({ fivemDir: val as string });
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

