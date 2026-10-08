"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace(data.status === "pending_2fa" ? "/verify" : "/login");
        } else {
          setEmail(data.email);
          setChecking(false);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">الحالة</p>
            <p className="text-2xl font-bold text-green-400 mt-1">نشط</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">آخر دخول</p>
            <p className="text-2xl font-bold text-foreground mt-1">الآن</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">الأدمن</p>
            <p className="text-2xl font-bold text-foreground mt-1 text-sm">{email}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            مرحباً بك في لوحة التحكم
          </h2>
          <p className="text-muted-foreground">
            تم تسجيل الدخول بنجاح. يمكنك البدء في إدارة النظام.
          </p>
        </div>
      </main>
    </div>
  );
}
