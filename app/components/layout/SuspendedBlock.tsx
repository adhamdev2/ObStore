"use client";

import { useAuth } from "../../lib/auth";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export default function SuspendedBlock() {
    const { user, isLoading } = useAuth();
    const { t } = useTranslation();

    if (isLoading || !user || !user.suspended) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md">
            <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900 border border-red-500/30 text-center shadow-2xl shadow-red-900/20">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 mb-6">
                    <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-4">
                    الحساب معلق
                </h1>
                
                <p className="text-zinc-400 mb-8 text-lg">
                    عذراً، تم تعليق حسابك من قبل الإدارة. يرجى فتح تذكرة (Ticket) في خادم الديسكورد الخاص بنا للحصول على مزيد من المعلومات أو لحل المشكلة.
                </p>
                
                <button 
                    onClick={() => window.open("https://discord.gg/ob1", "_blank")}
                    className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold transition-colors"
                >
                    <MessageSquare className="w-5 h-5" />
                    فتح تذكرة في الديسكورد
                </button>
            </div>
        </div>
    );
}
