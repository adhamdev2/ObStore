"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
    className,
    defaultValue,
    value,
    onValueChange,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            defaultValue={defaultValue}
            value={value}
            onValueChange={onValueChange}
            className={cn(
                "relative flex w-full touch-none items-center select-none",
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="bg-white/10 relative h-1.5 w-full grow overflow-hidden rounded-full shadow-inner"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="bg-primary absolute h-full shadow-[0_0_15px_rgba(var(--primary),0.6)] animate-pulse-slow"
                />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                data-slot="slider-thumb"
                className="border-primary/20 bg-primary ring-offset-background hover:scale-125 focus-visible:ring-ring block h-4 w-4 rounded-full border shadow-2xl transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            />
        </SliderPrimitive.Root>
    )
}

export { Slider }
