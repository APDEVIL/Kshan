"use client";

import { type HTMLAttributes, useEffect, useRef } from "react";
import { type Cleanup, spotlight, tilt as tiltEffect } from "@/lib/pointerFx";
import { cn } from "@/lib/utils";

type Tone = "default" | "dark" | "brand";

const TONE_CLASS: Record<Tone, string> = {
	default: "bento",
	dark: "bento bento-dark",
	brand: "bento bento-brand",
};

export interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
	tone?: Tone;
	/** Lean toward the cursor in 3D. */
	tilt?: boolean;
	tiltMax?: number;
}

/**
 * The bento card used everywhere. A soft light follows the cursor inside it,
 * and with `tilt` it also leans toward the mouse.
 */
export function GlowCard({
	tone = "default",
	tilt = false,
	tiltMax = 6,
	className,
	children,
	...rest
}: GlowCardProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const cleanups: Cleanup[] = [spotlight(el)];
		if (tilt) cleanups.push(tiltEffect(el, tiltMax));
		return () => {
			for (const cleanup of cleanups) cleanup();
		};
	}, [tilt, tiltMax]);

	return (
		<div className={cn(TONE_CLASS[tone], className)} ref={ref} {...rest}>
			{children}
		</div>
	);
}
