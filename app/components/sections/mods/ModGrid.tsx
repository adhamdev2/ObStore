import React from "react";
import type { Mod } from "@/types/Mod";
import ModGridCard from "./ModGridCard";

interface ModGridProps {
    mods: Mod[];
    onAction?: (id: string, isInstalled: boolean, name: string) => void;
}

const ModGrid = React.memo(({ mods, onAction }: ModGridProps) => {
    return (
        <div className="w-full gap-4 grid grid-cols-1 md:grid-cols-4 auto-rows-min">
            {mods.map((mod, index) => {
                let gridClass = "w-full min-h-[350px]";
                
                const layoutIndex = index % 5;
                if (layoutIndex === 0) gridClass += " md:col-start-1 md:col-end-3 md:h-[350px]";
                if (layoutIndex === 1) gridClass += " md:col-start-3 md:col-end-4 md:h-[350px]";
                if (layoutIndex === 2) gridClass += " md:col-start-4 md:col-end-5 md:row-span-2 md:h-full";
                if (layoutIndex === 3) gridClass += " md:col-start-1 md:col-end-2 md:h-[350px]";
                if (layoutIndex === 4) gridClass += " md:col-start-2 md:col-end-4 md:h-[350px]";

                return (
                    <ModGridCard
                        key={mod.id || index}
                        mod={mod}
                        className={gridClass}
                        onAction={onAction}
                    />
                );
            })}
        </div>
    );
});

export default ModGrid;