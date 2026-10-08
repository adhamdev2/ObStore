"use client"

import React from "react";
import { Search, ListFilter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface SearchBarProps {
    onSearch: (value: string) => void;
    onSort: () => void;
    sortOrder: "asc" | "desc";
}

export default function SearchBar({ onSearch, onSort, sortOrder }: SearchBarProps) {
    const { t, isArabic } = useTranslation();
    
    return (
        <div className={`flex items-center gap-4 w-full ${isArabic ? 'flex-row-reverse' : ''}`}>
            <div className="relative flex-1 group">
                <Search className={`absolute top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors ${isArabic ? 'right-6' : 'left-6'}`} size={20} />
                <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    onChange={(e) => onSearch(e.target.value)}
                    className={`w-full bg-black/25 border border-white/5 rounded-full py-4 text-[17px] text-white focus:outline-none focus:border-primary/50 focus:bg-black/40 transition-all backdrop-blur-md ${isArabic ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8 text-left'}`}
                />
            </div>

            <button
                onClick={onSort}
                className={`flex items-center gap-2 bg-black/25 border border-white/5 rounded-full px-8 py-4 text-white/80 hover:text-white hover:bg-black/40 hover:border-primary/30 transition-all backdrop-blur-md ${isArabic ? 'flex-row-reverse' : ''}`}
            >
                <span className="text-[17px] font-medium">{t.sort} {sortOrder === 'asc' ? '(A-Z)' : '(Z-A)'}</span>
                <ListFilter size={18} className={`pointer-events-none transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
}
