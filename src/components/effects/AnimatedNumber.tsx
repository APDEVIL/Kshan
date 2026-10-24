"use client";

import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsapSetup";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** A number that counts up or down to its new value instead of jumping. */
export function AnimatedNumber({
	value,
	decimals = 0,
	prefix = "",
	suffix = "",
	duration = 0.8,
	className,
}: {
	value: number;
	decimals?: number;
	prefix?: string;
	suffix?: string;
	duration?: number;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const shown = useRef({ v: value });
	const format = useMemo(
		() =>
			new Intl.NumberFormat("en-IN", {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			}),
		[decimals],
	);
	// React renders this text once. After that GSAP owns the text, so React never overwrites it mid-animation.
	const [initialText] = useState(
		() => `${prefix}${format.format(value)}${suffix}`,
	);

	useGSAP(
		() => {
			const el = ref.current;
			if (!el) return;
			const write = () => {
				el.textContent = `${prefix}${format.format(shown.current.v)}${suffix}`;
			};
			if (prefersReducedMotion()) {
				shown.current.v = value;
				write();
				return;
			}
			gsap.to(shown.current, {
				v: value,
				duration,
				ease: "power2.out",
				onUpdate: write,
			});
		},
		{ dependencies: [value, prefix, suffix, duration, format], scope: ref },
	);

	return (
		<span className={cn("tabular-nums", className)} ref={ref}>
			{initialText}
		</span>
	);
}
