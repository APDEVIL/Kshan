// One place that registers GSAP plugins. Import gsap / useGSAP from here, never directly.

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "./motion";

let ready = false;

export function setupGsap(): void {
	if (ready || typeof window === "undefined") return;
	gsap.registerPlugin(useGSAP, Flip, SplitText);
	gsap.defaults({ ease: "power3.out", duration: 0.7 });
	ready = true;
}

setupGsap();

export { Flip, gsap, SplitText, useGSAP };

/**
 * Fade-and-rise every element under `root` that carries data-reveal.
 * Use inside useGSAP({ scope }) so GSAP cleans up on unmount.
 */
export function revealStagger(
	root: ParentNode | null,
	selector = "[data-reveal]",
	opts: { delay?: number; stagger?: number; y?: number } = {},
): gsap.core.Tween | null {
	if (!root || prefersReducedMotion()) return null;
	const targets = root.querySelectorAll(selector);
	if (targets.length === 0) return null;
	return gsap.fromTo(
		targets,
		{ opacity: 0, y: opts.y ?? 24 },
		{
			opacity: 1,
			y: 0,
			stagger: opts.stagger ?? 0.07,
			delay: opts.delay ?? 0.05,
			clearProps: "transform,opacity",
		},
	);
}
