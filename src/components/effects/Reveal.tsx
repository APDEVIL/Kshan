"use client";

import { type ReactNode, useRef } from "react";
import { revealStagger, useGSAP } from "@/lib/gsapSetup";

/**
 * Fades and lifts every child marked data-reveal, one after another, when it first appears.
 *   <Reveal><div data-reveal>…</div><div data-reveal>…</div></Reveal>
 */
export function Reveal({
	children,
	className,
	delay,
	stagger,
	y,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	stagger?: number;
	y?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			revealStagger(ref.current, "[data-reveal]", { delay, stagger, y });
		},
		{ scope: ref },
	);

	return (
		<div className={className} ref={ref}>
			{children}
		</div>
	);
}
