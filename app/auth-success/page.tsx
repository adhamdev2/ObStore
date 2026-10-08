"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthSuccessHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const token = searchParams.get("token");

        if (token) {
            console.log(`[Auth Handler] 🎯 Token received! (Starts with: ${token.substring(0, 15)}...)`);
            
            // 🚨 ROOT SOLUTION (FINAL STEP): Securely store the JWT in LocalStorage
            window.localStorage.setItem("auth_session", token);
            console.log("[Auth Handler] ✅ Token saved to LocalStorage. Origin: ", window.location.host);
            
            // Force a FULL page reload to ensure the AuthProvider and all components
            // are re-mounted and can read the fresh token from localStorage.
            setTimeout(() => {
                console.log("[Auth Handler] 🚀 Forcing full page reload to Home...");
                window.location.href = "/";
            }, 500); // 500ms for safety
        } else {
            console.error("[Auth Handler] ❌ No token found in redirect URL");
            window.location.href = "/";
        }
    }, [searchParams, router]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <h1 className="text-xl font-bold">Authenticating...</h1>
            <p className="text-gray-400 mt-2">Finalizing your secure login</p>
        </div>
    );
}

export default function AuthSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-black text-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        }>
            <AuthSuccessHandler />
        </Suspense>
    );
}
