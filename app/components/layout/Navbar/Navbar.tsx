"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import NavbarBrand from "./NavbarBrand";
import DesktopNav from "./DesktopNav";
import NavbarActions from "./NavbarActions";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/hooks/useTranslation";

interface PathsResponse {
  paths: {
    fivemPath: string;
  };
}

export default function Navbar({ pathname: propPathname }: { pathname?: string }) {
  const { user } = useAuth();
  const { isArabic } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleL2 = async () => {
    try {
      const res = await apiFetch<PathsResponse>("/paths");
      if (!window.electron?.launchFiveMFlow) {
        alert("L2 launch is only available in the desktop app.");
        return;
      }
      await window.electron.launchFiveMFlow({
        fivemPath: `${res.paths.fivemPath}\\FiveM.exe`,
        toolPath: `${res.paths.fivemPath}\\FiveM.app\\citizen\\platform-0000\\gr.exe`,
        input: "2"
      });
    } catch (err) {
      console.error("L2 launch failed:", err);
      alert(`FiveM launch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const pathnameFromNext = usePathname();
  const pathname = propPathname || pathnameFromNext || "/";

  // Thin placeholder — keeps layout stable without blocking page render
  if (!mounted) return <div className="w-full fixed z-[10000] h-[56px] mt-[56px]" />;

  const isDesktop = typeof window !== "undefined" && !!window.electron;
  if (!isDesktop) return null;

  return (
    <div className={`w-full fixed z-[10000] px-4 md:px-0 transition-all duration-300 ${isDesktop ? 'mt-[56px]' : 'mt-4'}`}>
      <nav
        dir={isArabic ? "rtl" : "ltr"}
        className={`flex justify-between relative flex-row items-center w-full max-w-[1240px] mx-auto px-6 py-3 transition-all border border-white/10 rounded-[28px] ${
          scrolled ? "bg-black/60 backdrop-blur-2xl" : "bg-black/20 backdrop-blur-md"
        }`}
      >
        <div className="flex items-center gap-6">
          <NavbarBrand />
          
          {user && (
            <Button
              onClick={handleL2}
              variant="ghost"
              className="hidden lg:flex items-center gap-2 px-4 h-10 bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition-all group rounded-full"
            >
              <Flame size={16} className="group-hover:text-orange-500 transition-colors" />
              <span className="font-black text-[10px] uppercase tracking-wider">Pure Mode (L2)</span>
            </Button>
          )}
        </div>

        <DesktopNav pathname={pathname} />
        <NavbarActions />
      </nav>
    </div>
  );
}
