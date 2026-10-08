"use client"

import React, { useState, useRef, useEffect } from "react";
import { DownloadFilters } from "@/constants/DownloadFilters";
import { ChevronDown } from "lucide-react";
import type { ModCategory } from "@/types/Mod";
import { useTranslation } from "@/hooks/useTranslation";

interface FilterSidebarProps {
    activeFilter: ModCategory;
    onFilterChange: (id: ModCategory) => void;
}

export default function FilterSidebar({ activeFilter, onFilterChange }: FilterSidebarProps) {
    const { t, isArabic } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeFilterData = DownloadFilters.find(f => f.id === activeFilter) || DownloadFilters[0];
    const ActiveIcon = activeFilterData.icon;

    // Map filter ids to translation keys
    const getLabel = (filterId: string, fallback: string) => {
        if (filterId === "all") return t["allMods" as keyof typeof t] || fallback;
        return t[filterId as keyof typeof t] || fallback;
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative shrink-0" ref={dropdownRef}>
            {/* Compact trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 bg-black/25 border rounded-full px-6 py-4 transition-all backdrop-blur-md whitespace-nowrap ${isArabic ? 'flex-row-reverse' : ''} ${
                    isOpen
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/5 text-white/80 hover:text-white hover:bg-black/40 hover:border-primary/30"
                }`}
            >
                {ActiveIcon && <ActiveIcon size={18} className="pointer-events-none shrink-0" />}
                <span className="text-[17px] font-medium">{getLabel(activeFilterData.id, activeFilterData.label)}</span>
                <ChevronDown size={16} className={`pointer-events-none transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && DownloadFilters.length > 1 && (
                <div className={`absolute top-full mt-2 z-50 min-w-[220px] rounded-2xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${isArabic ? 'right-0' : 'left-0'}`}>
                    {DownloadFilters.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        const Icon = filter.icon;

                        return (
                            <button
                                key={filter.id}
                                onClick={() => {
                                    onFilterChange(filter.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all ${isArabic ? 'flex-row-reverse text-right' : 'text-left'} ${
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                {Icon && <Icon size={18} className="pointer-events-none shrink-0" />}
                                <span className="text-sm font-semibold">{getLabel(filter.id, filter.label)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
