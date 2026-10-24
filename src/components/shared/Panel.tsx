import type { ReactNode } from "react";
import { GlowCard } from "@/components/effects/GlowCard";
import { cn } from "@/lib/utils";

/** Titled bento card used by every dashboard. */
export function Panel({
	title,
	action,
	children,
	className,
	tone,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	tone?: "default" | "dark" | "brand";
}) {
	return (
		<GlowCard
			className={cn("flex min-h-0 flex-col rounded-[1.75rem] p-5", className)}
			data-reveal
			tone={tone ?? "default"}
		>
			<div className="mb-3 flex items-center justify-between gap-3">
				<h2 className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
					{title}
				</h2>
				{action}
			</div>
			{children}
		</GlowCard>
	);
}

export function EmptyNote({ children }: { children: ReactNode }) {
	return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** Plain action button in brand or neutral style. Uses no shadcn internals so it never breaks on a style change. */
export function ActionButton({
	children,
	onClick,
	variant = "brand",
	disabled,
	className,
	type = "button",
}: {
	children: ReactNode;
	onClick?: () => void;
	variant?: "brand" | "outline" | "danger";
	disabled?: boolean;
	className?: string;
	type?: "button" | "submit";
}) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 font-semibold text-sm transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
				variant === "brand" &&
					"bg-brand text-brand-foreground shadow-[0_8px_20px_-10px_var(--brand)] hover:brightness-105",
				variant === "outline" &&
					"border border-border bg-card text-foreground hover:border-brand",
				variant === "danger" &&
					"bg-[var(--danger)]/12 text-[var(--danger)] hover:bg-[var(--danger)]/20",
				className,
			)}
			disabled={disabled}
			onClick={onClick}
			type={type}
		>
			{children}
		</button>
	);
}
