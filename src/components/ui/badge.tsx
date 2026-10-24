import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium font-mono text-xs tracking-wide",
	{
		variants: {
			variant: {
				default:
					"border-[var(--color-border-bright)] bg-[var(--color-surface-raised)] text-[var(--color-text)]",
				cyan: "border-[var(--color-cyan)]/40 bg-[var(--color-cyan-dim)] text-[var(--color-cyan)]",
				red: "border-[var(--color-red)]/50 bg-[var(--color-red-dim)] text-[var(--color-red)]",
				amber:
					"border-[var(--color-amber)]/50 bg-[var(--color-amber-dim)] text-[var(--color-amber)]",
				green:
					"border-[var(--color-green)]/50 bg-[var(--color-green-dim)] text-[var(--color-green)]",
				outline:
					"border-[var(--color-border-bright)] text-[var(--color-text-dim)]",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
