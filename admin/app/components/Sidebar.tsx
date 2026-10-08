"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UserCog,
  MonitorSmartphone,
  LogOut,
  Shield,
} from "lucide-react";

const navItems = [
  {
    name: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "المتحكمين",
    href: "/dashboard/users",
    icon: UserCog,
  },
  {
    name: "المستخدمين",
    href: "/dashboard/app-users",
    icon: MonitorSmartphone,
  },
];

interface SidebarProps {
  email: string;
}

export default function Sidebar({ email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/dashboard/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-[260px] bg-card border-r border-border flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-foreground leading-tight">Admin</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Management Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          القائمة
        </p>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors duration-150 ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span>{item.name}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="px-3 pb-4 mt-auto">
        <div className="px-3 py-3 rounded-lg bg-muted border border-border">
          <p className="text-[13px] text-foreground truncate">{email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 mt-2 text-[12px] text-destructive hover:opacity-80 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </aside>
  );
}
