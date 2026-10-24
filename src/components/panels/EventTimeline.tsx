"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatClock } from "@/lib/format";
import { SPRING_SOFT } from "@/lib/motion";
import { type StatusTone, TONE_CLASS } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
	_id: string;
	actor: string;
	message: string;
	createdAt: number;
}

function toneForActor(actor: string): StatusTone {
	if (/ai agent|intake|triage/i.test(actor)) return "info";
	if (/safety/i.test(actor)) return "warn";
	if (/dispatch|routing|traffic/i.test(actor)) return "ok";
	return "neutral";
}

/** Newest-first feed of what happened in the session. New lines slide in. Inherits the surrounding text colour. */
export function EventTimeline({
	events,
	emptyText = "Nothing yet. Events appear here as they happen.",
	className,
}: {
	events: TimelineEvent[] | undefined;
	emptyText?: string;
	className?: string;
}) {
	if (events === undefined) {
		return <p className={cn("text-sm opacity-60", className)}>Loading…</p>;
	}
	if (events.length === 0) {
		return <p className={cn("text-sm opacity-60", className)}>{emptyText}</p>;
	}

	return (
		<ul className={cn("flex flex-col gap-3", className)}>
			<AnimatePresence initial={false}>
				{events.map((e) => {
					const tone = TONE_CLASS[toneForActor(e.actor)];
					return (
						<motion.li
							animate={{ opacity: 1, y: 0, scale: 1 }}
							className="flex gap-3"
							initial={{ opacity: 0, y: -10, scale: 0.97 }}
							key={e._id}
							layout
							transition={SPRING_SOFT}
						>
							<span className="mt-1.5 flex flex-col items-center">
								<span className={cn("size-2 rounded-full", tone.dot)} />
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-baseline justify-between gap-2">
									<span className="truncate font-bold text-[11px] uppercase tracking-wide opacity-70">
										{e.actor}
									</span>
									<span className="shrink-0 font-mono text-[10px] tabular-nums opacity-50">
										{formatClock(e.createdAt)}
									</span>
								</div>
								<p className="mt-0.5 break-words text-[13px] leading-snug">
									{e.message}
								</p>
							</div>
						</motion.li>
					);
				})}
			</AnimatePresence>
		</ul>
	);
}
