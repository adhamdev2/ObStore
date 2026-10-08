"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface CodeGuardProps {
    children: React.ReactNode;
}

export default function CodeGuard({ children }: CodeGuardProps) {
    const { user, isLoading, checkAuth } = useAuth();
    
    const [code, setCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successVersion, setSuccessVersion] = useState<string | null>(null);

    // Don't show anything while loading
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[image:var(--app-bg)] bg-cover bg-center bg-no-repeat relative">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    // If user has a code/version and we haven't just verified one (which hides the form), just show the content
    if ((user?.code || (user?.versions && user.versions.length > 0)) && !successVersion) {
        return <>{children}</>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const data = await apiFetch<{ success: boolean; version?: string }>("/code/verify", {
                method: "POST",
                body: JSON.stringify({ code: code.trim() })
            });

            if (data.success && data.version) {
                setSuccessVersion(data.version);
                // Refresh auth state in the background so it's ready when they continue
                await checkAuth();
            } else {
                setError("Invalid code. Please try again.");
            }
        } catch (err: any) {
            setError(err.error || "Failed to verify code. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[image:var(--app-bg)] bg-cover bg-center bg-no-repeat relative overflow-hidden">
            {/* Background elements for premium aesthetic */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

            <div className="w-full max-w-md p-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden group">
                {/* Subtle gradient border effect internally */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {!successVersion ? (
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Access Required</h2>
                        <p className="text-gray-400 mb-8 max-w-[280px]">
                            Please enter your registration code to unlock these premium features.
                        </p>

                        <form onSubmit={handleSubmit} className="w-full space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Enter your code..."
                                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                                    disabled={isSubmitting}
                                />
                                {error && (
                                    <p className="absolute -bottom-6 left-1 text-sm text-red-400 animate-pulse">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !code.trim()}
                                className="w-full py-4 mt-4 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-semibold rounded-xl text-lg shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Verifying...</span>
                                    </div>
                                ) : (
                                    "Unlock Access"
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center mb-6 shadow-xl shadow-green-500/20">
                            <svg className="w-10 h-10 text-white animate-in zoom-in duration-500 delay-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">Access Granted</h2>
                        <div className="py-2 px-6 bg-white/5 border border-white/10 rounded-full mt-4 mb-8">
                            <span className="text-gray-400">Version Detected: </span>
                            <span className="text-primary font-bold ml-2 uppercase">{successVersion}</span>
                        </div>
                        
                        <button
                            onClick={() => setSuccessVersion(null)} // Dismiss and let children render
                            className="w-full py-4 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl border border-white/10 transition-all duration-300"
                        >
                            Continue to Section
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
