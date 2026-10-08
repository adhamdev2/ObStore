"use client"

import React from "react";
const languages = [
    { id: "en", name: "English", flag: "🇬🇧" },
    { id: "ar", name: "العربية", flag: "🇸🇦" },
];

export default function LanguageSelector({ defaultLang, onSelect }: { defaultLang?: string, onSelect?: (id: string) => void }) {
    const [selected, setSelected] = React.useState(defaultLang || "en");

    React.useEffect(() => {
        setSelected(defaultLang === "ar" ? "ar" : "en");
    }, [defaultLang]);

    const handleSelect = (id: string) => {
        setSelected(id);
        if (onSelect) onSelect(id);
    };

    return (
        <div className="flex justify-between gap-4 md:gap-6 w-full ">
            {languages.map((lang) => (
                <button
                    key={lang.id}
                    type="button"
                    aria-pressed={selected === lang.id}
                    onClick={() => handleSelect(lang.id)}
                    className={`flex-1 flex items-center justify-between p-6 px-10 text-left cursor-pointer rounded-2xl transition-all duration-300 ${selected === lang.id
                        ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                        : "bg-black/25 border border-white/5 hover:bg-black/40 hover:border-white/15"
                        }`}

                >
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">{lang.flag}</span>
                        <span className={`text-[17px] font-semibold transition-colors ${selected === lang.id ? "text-primary" : "text-white/80"
                            }`}>
                            {lang.name}
                        </span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border p-1 flex items-center justify-center transition-all ${selected === lang.id ? "border-primary" : "border-white/20"
                        }`}>
                        {selected === lang.id && <div className="w-full h-full bg-primary rounded-full animate-in fade-in zoom-in" />}
                    </div>
                </button>
            ))}
        </div>
    );
}
