"use client";

import { useEffect } from "react";

/**
 * AntiResize component
 * Monitors and maintains zoom levels to prevent UI scaling issues on resize.
 * Source - https://stackoverflow.com/a/70754000
 */
export default function AntiResize() {
  useEffect(() => {
    // Check if we are in an Electron environment and if webFrame is exposed
    const electron = (window as any).electron;
    
    // Fallback detection using devicePixelRatio if webFrame is not exposed
    let prevZoom = window.devicePixelRatio;

    const handleResize = () => {
      // If webFrame is exposed via preload, use it (best accuracy)
      if (electron?.getZoomLevel && electron?.setZoomLevel) {
        const currentZoom = electron.getZoomLevel();
        if (currentZoom !== 0) {
          electron.setZoomLevel(0);
        }
      } else {
        // Pure frontend detection (limited)
        const currentPixelRatio = window.devicePixelRatio;
        if (currentPixelRatio !== prevZoom) {
          // We can't "reset" the zoom in pure web, but we can log or handle layout
          console.warn("[AntiResize] Zoom change detected, but webFrame is not exposed.");
        }
        prevZoom = currentPixelRatio;
      }
    };

    window.addEventListener("resize", handleResize);
    
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return null;
}
