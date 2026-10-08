import { Home, Download, LayoutGrid } from "lucide-react";
import { TbSettings2 } from "react-icons/tb";
import { GrTarget } from "react-icons/gr";
import { MdSpaceDashboard } from "react-icons/md";

const NavbarItems = [
    {
        labelKey: "home",
        href: "/",
        icon: Home
    },
    {
        labelKey: "downloads",
        href: "/download",
        icon: MdSpaceDashboard
    },
    {
        labelKey: "mods",
        href: "/mods",
        icon: GrTarget
    },


    {
        labelKey: "settings",
        href: "/settings",
        icon: TbSettings2
    }
] as const;

export default NavbarItems;
