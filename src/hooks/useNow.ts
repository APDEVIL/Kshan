"use client";

import { useEffect, useState } from "react";

/** Current time in ms, refreshed on an interval. Pass enabled=false to stop ticking. */
export function useNow(intervalMs = 1000, enabled = true): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!enabled) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs, enabled]);

	return now;
}
