"use client";

import { useEffect } from "react";

export default function ThemeManager() {
  useEffect(() => {
    // Only apply the purple theme if it's the desktop app
    if (typeof window !== "undefined" && !!window.electron) {
      document.body.classList.add("app-theme");
    } else {
      document.body.classList.remove("app-theme");
    }
  }, []);

  return null;
}
