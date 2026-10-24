import type { ReactNode } from "react";
import { type StatusTone, TONE_CLASS } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusPill({
	tone = "neutral",
	pulse = false,
	className,
	children,
}: {
	tone?: StatusTone;
	pulse?: boolean;
	className?: string;
	children: ReactNode;
}) {
	const t = TONE_CLASS[tone];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-xs",
				t.soft,
				t.text,
				className,
			)}
		>
			<span
				className={cn("size-1.5 rounded-full", t.dot, pulse && "pulse-dot")}
			/>
			{children}
		</span>
	);
}
