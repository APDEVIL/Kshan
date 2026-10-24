"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		className={cn(
			"inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1",
			className,
		)}
		ref={ref}
		{...props}
	/>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-[var(--color-text-dim)] text-sm transition-all",
			"data-[state=active]:bg-[var(--color-surface-raised)] data-[state=active]:text-[var(--color-text)] data-[state=active]:shadow-[0_0_0_1px_var(--color-border-bright)]",
			"hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]",
			className,
		)}
		ref={ref}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		className={cn("mt-4 focus-visible:outline-none", className)}
		ref={ref}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
