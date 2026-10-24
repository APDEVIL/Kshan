// Shared framer-motion variants and springs, so every screen moves the same way.
import type { Transition, Variants } from "framer-motion";

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_SOFT: Transition = {
	type: "spring",
	stiffness: 260,
	damping: 28,
};
export const SPRING_SNAPPY: Transition = {
	type: "spring",
	stiffness: 420,
	damping: 30,
};

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 14 },
	show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	show: { opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.94 },
	show: { opacity: 1, scale: 1, transition: SPRING_SOFT },
};

export const slideInRight: Variants = {
	hidden: { opacity: 0, x: 28 },
	show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

export const slideInLeft: Variants = {
	hidden: { opacity: 0, x: -28 },
	show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Parent that staggers its children. */
export function staggerParent(stagger = 0.06, delay = 0): Variants {
	return {
		hidden: {},
		show: { transition: { staggerChildren: stagger, delayChildren: delay } },
	};
}

/** Route-to-route page transition. */
export const pageVariants: Variants = {
	initial: { opacity: 0, y: 10, filter: "blur(4px)" },
	animate: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.45, ease: EASE_OUT },
	},
	exit: {
		opacity: 0,
		y: -8,
		filter: "blur(4px)",
		transition: { duration: 0.25, ease: EASE_OUT },
	},
};

/** Alerts, incoming offers, toasts. */
export const popIn: Variants = {
	hidden: { opacity: 0, scale: 0.9, y: 8 },
	show: { opacity: 1, scale: 1, y: 0, transition: SPRING_SNAPPY },
	exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const hoverLift = {
	whileHover: { y: -3 },
	whileTap: { scale: 0.98 },
	transition: SPRING_SNAPPY,
} as const;

export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
