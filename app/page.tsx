"use client";

import { useState, useEffect } from "react";
import HeroSection from "./components/sections/HeroSection";
import FeaturesGrid from "./components/Features/FeaturesGrid";
import Footer from "./components/layout/Footer/footer";
import Hero from "./components/Hero/Hero";
import Navbar from "./components/layout/Navbar/Navbar";


export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsDesktop(typeof window !== "undefined" && !!window.electron);
  }, []);

  if (!isMounted) {
    // Return a generic dark loading screen to prevent blank white flashes during hydration
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black/95">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const apiBase = "https://api.ob1.store";
      await fetch(`${apiBase}/api/home-download/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    } catch (err) {
      console.warn("Failed to track home download:", err);
    }

    window.location.href = "https://api.ob1.store/api/update/data/app.exe";

    setTimeout(() => {
      setIsDownloading(false);
    }, 3000);
  };

  if (!isDesktop) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
   
        
        <div className="relative z-10">
          {/* Page Content */}
          <div className="w-full min-h-screen">
            <Hero
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />
          </div>
          <FeaturesGrid />
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="relative z-10 w-full min-h-screen">
        <HeroSection 
          // TODO: Once you create the purple version of the banner, change this to: "images/hero/hero_banner_purple.png"
          image="images/hero/hero_banner.png" 
        />
      </div>
    </div>
  );
}
