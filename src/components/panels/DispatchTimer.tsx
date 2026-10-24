"use client";

import { Check, Timer } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { formatSecondsTenths } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The headline number: seconds from the call being received to an ambulance accepting the job.
 * It runs live until dispatch, then freezes.
 */
export function DispatchTimer({
	createdAt,
	dispatchedAt,
	closedAt,
	className,
}: {
	createdAt: number;
	dispatchedAt?: number | undefined;
	closedAt?: number | undefined;
	className?: string;
}) {
	const running = dispatchedAt === undefined && closedAt === undefined;
	const now = useNow(100, running);
	const done = dispatchedAt !== undefined;
	const ms = done ? dispatchedAt - createdAt : running ? now - createdAt : null;

	return (
		<div
			className={cn(
				"flex items-center gap-2.5 rounded-2xl px-3 py-1.5",
				done ? "bg-brand/15 text-brand-deep" : "bg-muted text-foreground",
				className,
			)}
			title="Time from the call being received to an ambulance accepting the job"
		>
			{done ? (
				<Check className="size-4" strokeWidth={3} />
			) : (
				<Timer className={cn("size-4", running && "pulse-dot")} />
			)}
			<div className="leading-none">
				<p className="font-semibold text-[10px] uppercase tracking-wider opacity-70">
					Call → dispatch
				</p>
				<p className="mt-1 font-bold font-mono text-base tabular-nums">
					{formatSecondsTenths(ms)}
				</p>
			</div>
		</div>
	);
}
