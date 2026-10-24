"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { magnetic } from "@/lib/pointerFx";
import { cn } from "@/lib/utils";

/** Wraps a button or link so it leans toward the cursor when the mouse is close. */
export function MagneticButton({
	children,
	className,
	strength = 0.35,
}: {
	children: ReactNode;
	className?: string;
	strength?: number;
}) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		return magnetic(el, strength);
	}, [strength]);

	return (
		<span className={cn("inline-block", className)} ref={ref}>
			{children}
		</span>
	);
}
