"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
	React.ElementRef<typeof ScrollAreaPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
	<ScrollAreaPrimitive.Root
		className={cn("relative overflow-hidden", className)}
		ref={ref}
		{...props}
	>
		<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
			{children}
		</ScrollAreaPrimitive.Viewport>
		<ScrollAreaPrimitive.Scrollbar
			className="flex w-2.5 touch-none select-none p-0.5 transition-colors"
			orientation="vertical"
		>
			<ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--color-border-bright)]" />
		</ScrollAreaPrimitive.Scrollbar>
		<ScrollAreaPrimitive.Corner />
	</ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

export { ScrollArea };
