"use client";

import { useNow } from "@/hooks/useNow";
import { clamp } from "@/lib/format";

export interface Countdown {
	active: boolean;
	remainingMs: number;
	seconds: number;
	/** 1 at the start, 0 when the time is up. */
	progress: number;
}

/** Counts down to a deadline (epoch ms). `totalMs` is the full window, used for the progress ring. */
export function useCountdown(
	deadline: number | undefined,
	totalMs: number,
	tickMs = 200,
): Countdown {
	const now = useNow(tickMs, deadline !== undefined);
	if (deadline === undefined)
		return { active: false, remainingMs: 0, seconds: 0, progress: 0 };
	const remainingMs = Math.max(0, deadline - now);
	return {
		active: remainingMs > 0,
		remainingMs,
		seconds: Math.ceil(remainingMs / 1000),
		progress: clamp(remainingMs / totalMs, 0, 1),
	};
}
