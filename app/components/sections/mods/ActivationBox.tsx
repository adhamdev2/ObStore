"use client";

import React, { useState } from "react";
import { Loader2, Key, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface ActivationBoxProps {
    onSuccess?: (version: string) => void;
}

export default function ActivationBox({ onSuccess }: ActivationBoxProps) {
    const { t, isArabic } = useTranslation();
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
    const [activationStatus, setActivationStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const handleActivateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activationCode.trim()) return;

        setIsActivating(true);
        setActivationStatus(null);

        try {
            const response = await apiFetch<any>("/code/verify", {
                method: "POST",
                body: JSON.stringify({ code: activationCode.trim() })
            });

            if (response.success) {
                setActivationStatus({ type: "success", message: `${t.activationSuccess} ${response.version}!` });
                setActivationCode("");
                if (onSuccess) onSuccess(response.version);
            } else {
                setActivationStatus({ type: "error", message: response.error || t.invalidActivationCode });
            }
        } catch (err: any) {
            setActivationStatus({ type: "error", message: err.message || t.activationFailed });
        } finally {
            setIsActivating(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 lg:p-8">
                    <div className={`flex flex-col md:flex-row items-center gap-8 ${isArabic ? 'md:flex-row-reverse text-right' : ''}`}>
                        <div className="flex-1 space-y-2">
                            <div className={`flex items-center gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                    <Key size={20} />
                                </div>
                                <h2 className="text-2xl font-black text-white tracking-tight">{t.redeemProduct}</h2>
                            </div>
                            <p className="text-white/40 text-sm leading-relaxed max-w-md">
                                {t.redeemDesc}
                            </p>
                        </div>
                        <div className="w-full md:w-auto min-w-[320px]">
                            <form onSubmit={handleActivateCode} className="relative group/input">
                                <input
                                    type="text"
                                    value={activationCode}
                                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                                    placeholder={t.enterCode}
                                    className={`w-full bg-white/5 border border-white/10 rounded-2xl py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono tracking-wider text-lg ${isArabic ? 'text-right pr-6 pl-[140px]' : 'pl-6 pr-[140px]'}`}
                                    maxLength={128}
                                    disabled={isActivating}
                                />
                                <Button 
                                    type="submit" 
                                    disabled={!activationCode.trim() || isActivating}
                                    className={`absolute top-2 bottom-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 transition-all ${isArabic ? 'left-2 right-auto' : 'right-2 left-auto'}`}
                                >
                                    {isActivating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        t.redeem
                                    )}
                                </Button>
                            </form>
                            
                            {activationStatus && (
                                <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold animate-in fade-in zoom-in-95 duration-300 ${
                                    activationStatus.type === "success" 
                                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                                }`}>
                                    {activationStatus.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                    {activationStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

