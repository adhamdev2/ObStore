"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { apiFetch, buildApiUrl } from "./api";

interface User {
    id: string;
    username: string;
    avatar: string;
    hasRequiredRole: boolean;
    isPremium?: boolean;
    code?: string;
    roleName?: string;
    versions?: string[];
    settings?: {
        theme: string;
        language: string;
        notifications: boolean;
        fivemDir: string;
    };
    downloads?: any[];
    suspended?: boolean;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    login: () => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
    updateUserSettings: (newSettings: Partial<NonNullable<User["settings"]>>) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    error: null,
    login: () => { },
    logout: () => { },
    checkAuth: async () => { },
    updateUserSettings: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const updateUserSettings = (newSettings: Partial<NonNullable<User["settings"]>>) => {
        if (!user) return;
        setUser({
            ...user,
            settings: {
                ...user.settings,
                ...newSettings,
            } as User["settings"]
        });
    };

    useEffect(() => {
        checkAuth();

        const handleRefreshMods = () => {
            checkAuth();
        };
        window.addEventListener("force-refresh-mods", handleRefreshMods);

        // Listen for IPC Auth tokens from Electron Main Process securely
        if (typeof window !== "undefined" && window.electron?.onAuthSuccess) {
            console.log("[Auth] Registering IPC onAuthSuccess listener...");
            const cleanup = window.electron?.onAuthSuccess((token) => {
                if (!token) {
                    console.warn("[Auth] ⚠️ Received empty token via IPC.");
                    return;
                }
                console.log("[Auth] 🔑 Token received securely via IPC, updating LocalStorage.");
                window.localStorage.setItem("auth_session", token);
                checkAuth(); // verify token and fetch user globally
            });
            return () => {
                window.removeEventListener("force-refresh-mods", handleRefreshMods);
                cleanup();
            };
        } else if (typeof window !== "undefined") {
            console.warn("[Auth] 🛑 IPC onAuthSuccess listener NOT found. Electron bridge might be broken.");
            return () => {
                window.removeEventListener("force-refresh-mods", handleRefreshMods);
            };
        }
    }, []);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const checkAuth = async () => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const data = await apiFetch<User>(`/auth/me?t=${Date.now()}`);

                setUser(data);
                setError(null);
                setIsLoading(false);
                return; // Success
            } catch (err: any) {
                if (err.status === 401) {
                    console.log("User not logged in (401)");
                    setUser(null);
                    setError(null);
                    setIsLoading(false);
                    return;
                }

                attempts++;
                console.log(`Auth attempt ${attempts} failed`, err);
                if (attempts < maxAttempts) {
                    await delay(800);
                } else {
                    setError("500 server internal");
                    setUser(null);
                }
            }
        }
        setIsLoading(false);
    };

    const login = () => {
        window.location.href = buildApiUrl("/auth/discord/login");
    };

    const logout = async () => {
        try {
            await apiFetch("/auth/logout", { method: "POST" });
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            // Fix: Actually clear the session from LocalStorage
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem('auth_session');
            }
            setUser(null);
            // Optional: force reload to clean UI state
            window.location.href = "/";
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, error, login, logout, checkAuth, updateUserSettings }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
