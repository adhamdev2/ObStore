"use client";

import { Minus, Square, X } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import UpdateIndicator from "./UpdateIndicator";

export default function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electron) {
      setIsElectron(true);
    }
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-12 flex items-center justify-between z-50 bg-black/40 backdrop-blur-md border-b border-white/5 shadow-sm"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left side: Logo or Title */}
      <div className="flex items-center gap-2 pl-4">
        <Image
          src={logo}
          alt="logo"
          width={28}
          height={28}
          className="object-contain"
        />
        <span className="text-sm font-bold text-white/90 tracking-wide">
          OB Store
        </span>
      </div>

      {/* Right side: Window Controls with Update Indicator */}
      <div 
        className="flex h-full items-center gap-1 relative z-[100]"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <UpdateIndicator />
        <button
          onClick={() => window.electron?.minimizeWindow()}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="h-full px-4 text-white/60 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
          title="Minimize"
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <button
          onClick={() => window.electron?.maximizeWindow()}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="h-full px-4 text-white/60 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
          title="Maximize"
        >
          <Square size={14} strokeWidth={2} />
        </button>
        <button
          onClick={() => window.electron?.closeWindow()}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="h-full px-4 text-white/60 hover:bg-red-500/90 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
          title="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
