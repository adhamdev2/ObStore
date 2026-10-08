import {
    LayoutGrid,
} from "lucide-react";
import type { Mod, ModCategory } from "@/types/Mod";

export interface FilterOption {
    id: ModCategory;
    label: string;
    icon: any;
    description?: string;
    hasSubmenu?: boolean;
}

export const DownloadFilters: FilterOption[] = [
    {
        id: "all",
        label: "All Mods",
        icon: LayoutGrid,
    },
];

export const MockMods: Mod[] = [
    {
        id: "1",
        name: "Mod name",
        image: "/images/mods/placeholder.png",
        category: "all",
        isInstalled: false,
        isIncompatible: false,
    },
    {
        id: "2",
        name: "Graphics Overhaul",
        image: "/images/mods/placeholder.png",
        category: "improvements",
        isInstalled: true,
        isIncompatible: false,
    },
    {
        id: "3",
        name: "Starter Pack",
        image: "/images/mods/placeholder.png",
        category: "modpacks",
        isInstalled: false,
        isIncompatible: false,
    },
];
