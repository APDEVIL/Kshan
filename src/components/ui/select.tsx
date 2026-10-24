"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
	<SelectPrimitive.Trigger
		className={cn(
			"flex h-10 w-full items-center justify-between rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] text-sm",
			"focus:outline-none focus:ring-2 focus:ring-[var(--color-cyan)] disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		ref={ref}
		{...props}
	>
		{children}
		<SelectPrimitive.Icon asChild>
			<ChevronDown className="h-4 w-4 text-[var(--color-text-dim)]" />
		</SelectPrimitive.Icon>
	</SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
	<SelectPrimitive.Portal>
		<SelectPrimitive.Content
			className={cn(
				"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface-raised)] shadow-xl",
				position === "popper" && "translate-y-1",
				className,
			)}
			position={position}
			ref={ref}
			{...props}
		>
			<SelectPrimitive.Viewport className="p-1">
				{children}
			</SelectPrimitive.Viewport>
		</SelectPrimitive.Content>
	</SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
	React.ElementRef<typeof SelectPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
	<SelectPrimitive.Item
		className={cn(
			"relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pr-2 pl-8 text-[var(--color-text)] text-sm outline-none",
			"data-[highlighted]:bg-[var(--color-surface)] data-[highlighted]:text-[var(--color-cyan)]",
			className,
		)}
		ref={ref}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<SelectPrimitive.ItemIndicator>
				<Check className="h-4 w-4" />
			</SelectPrimitive.ItemIndicator>
		</span>
		<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
	</SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
};
