export type ModCategory = "all" | "plugin";

export interface Mod {
    id: string;
    name: string;
    image: string;
    category: ModCategory | string;
    isInstalled?: boolean;
    isIncompatible?: boolean;
    downloadUrl?: string; // Optional legacy
    description?: string;
    version?: string;
    available?: boolean;
    archiveFile?: string | null;
    size?: number;
    fileSize?: number;
    config?: any;
    modVersion?: string;
}
