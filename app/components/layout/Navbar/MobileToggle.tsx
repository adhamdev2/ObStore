"use client"

import { X, Menu } from "lucide-react";

export default function MobileToggle({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex xl:hidden flex-col items-end transition-all z-[1000]">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2">
        {isOpen ? (
          <X size={38} color="#FFFFFF" />
        ) : (
         <Menu size={38} color="#FFFFFF" />
        )}
      </button>
    </div>
  );
}
