"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function LanguageManager() {
    const { user } = useAuth();
    
    useEffect(() => {
        const isArabic = user?.settings?.language === "ar";
        
        // Update document direction
        document.documentElement.dir = isArabic ? "rtl" : "ltr";
        
        // Toggle font classes on body
        if (isArabic) {
            document.body.classList.add("font-cairo");
            document.body.classList.remove("font-inter");
        } else {
            document.body.classList.add("font-inter");
            document.body.classList.remove("font-cairo");
        }
    }, [user?.settings?.language]);

    return null;
}
