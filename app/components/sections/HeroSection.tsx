import React from "react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
    title?: string;
    description?: string;
    image?: string;
    buttonText?: string;
    buttonLink?: string;
}

import { useTranslation } from "@/hooks/useTranslation";

export default function HeroSection({
    title,
    description,
    image = "images/hero/hero_banner.png",
    buttonText,
    buttonLink = "https://discord.gg/ob1",
}: HeroSectionProps) {
    const { t } = useTranslation();
    
    // Default values if not provided
    const displayTitle = title || (t as any).heroTitle || "Get the OB v6 Experience";
    const displayDesc = description || (t as any).heroDescFull || "Take your gaming to the next level with OB v6. Discover a world of ultra-realistic textures, vibrant colors, and unparalleled lighting effects. Visit our website now to explore the full feature list and transform your game today.";
    const displayBtn = buttonText || (t as any).visitDiscord || "Visit our Discord";
    return (
        <div className="w-full flex flex-col items-center justify-center pt-[220px] pb-[80px]">
            <div className="container max-w-[1240px] px-6">
                {/* Banner Image Container */}
                <div className="relative w-full aspect-21/10 md:aspect-21/9 rounded-[32px] overflow-hidden group shadow-2xl">
                    <img
                        src={image}
                        alt="Hero Banner"
                        className="w-full h-full object-cover transition-transform duration-700 brightness-50 group-hover:scale-105"
                    />

                    {/* Bottom Gradient Fade */}
                    <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent opacity-90" />

                    {/* Subtle Outer Shadow/Glow at the bottom of the border */}
                    <div className="absolute -bottom-[2px] left-0 right-0 h-[80px] bg-linear-to-t from-background/80 to-transparent blur-xl" />
                </div>

                {/* Content Section */}
                <div className="flex flex-col items-center text-center mt-12 max-w-[850px] mx-auto">
                    <h2 className="text-[32px] md:text-[42px] font-bold text-white mb-5 tracking-tight">
                        {displayTitle}
                    </h2>
                    <p className="text-[15px] md:text-[17px] text-[#A1A1A1]/90 leading-[1.6] mb-10 px-4 max-w-[700px]">
                        {displayDesc}
                    </p>

                    <a href={buttonLink} target="_blank" rel="noopener noreferrer">
                        <Button
                            className="py-[28px] px-[44px] bg-primary hover:bg-primary/90 text-primary-foreground border border-white/5 rounded-xl text-[16px] font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                        >
                            {displayBtn}
                        </Button>
                    </a>
                </div>
            </div>
        </div>
    );
}
