"use client";

import AuthGuard from "@/components/ui/AuthGuard";
import SettingsPageContent from "@/components/sections/settings/SettingsPageContent";

export default function SettingsPage() {
    return (
        <AuthGuard>
            <main className="min-h-screen bg-[image:var(--app-bg)] bg-cover bg-center bg-no-repeat">
                <SettingsPageContent />
            </main>
        </AuthGuard>
    );
}
