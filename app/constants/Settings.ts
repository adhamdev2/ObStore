import {
    MdOutlineSettingsOverscan,
    MdExtension,
    MdPlace,
    MdSettingsBackupRestore,
    MdHistory,
    MdKeyboard
} from "react-icons/md";
import {
    FiMonitor,
    FiFolder,
    FiTrash2
} from "react-icons/fi";

export interface SettingItemType {
    id: string;
    label: string;
    icon: any;
    type: "slider" | "button" | "action" | "path";
    value?: string | number;
    min?: number;
    max?: number;
    description?: string;
}

export const SettingsData: SettingItemType[] = [
    // {
    //     id: "interface-scaling",
    //     label: "interface scaling",
    //     icon: MdOutlineSettingsOverscan,
    //     type: "slider",
    //     value: 70,
    //     min: 50,
    //     max: 100,
    // },
    // {
    //     id: "desktop-shortcut",
    //     label: "Create a shortcut on the desktop",
    //     icon: FiMonitor,
    //     type: "button",
    // },
    {
        id: "fivem-directory",
        label: "change FiveM directory",
        icon: FiFolder,
        type: "path",
        value: "C:\\Users\\cukur\\AppData\\Local\\FiveM",
    },
    // {
    //     id: "install-mods",
    //     label: "Install Mods on Fivem",
    //     icon: MdExtension,
    //     type: "button",
    // },
    // {
    //     id: "landmark",
    //     label: "Display Ob mods hill landmark in-game",
    //     icon: MdPlace,
    //     type: "button",
    // },
    // {
    //     id: "past-mods",
    //     label: "Explore mods installed in the past",
    //     icon: MdHistory,
    //     type: "button",
    // },
    {
        id: "delete-mods",
        label: "Delete all installed mods",
        icon: FiTrash2,
        type: "button",
    },
    {
        id: "change-reshade-key",
        label: "Change Reshade overlay key",
        icon: MdKeyboard,
        type: "button",
    },
    // {
    //     id: "restore-files",
    //     label: "Restore Game Files",
    //     icon: MdSettingsBackupRestore,
    //     type: "button",
    // },
];
