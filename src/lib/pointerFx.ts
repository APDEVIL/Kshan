// Mouse-tracking effects. Every function returns a cleanup, so use them from useEffect / useGSAP.
// All of them switch themselves off for reduced-motion users.
import { gsap } from "./gsapSetup";
import { prefersReducedMotion } from "./motion";

export type Cleanup = () => void;
const noop: Cleanup = () => undefined;

/** An element that trails the cursor (cursor blob, background glow). Give it position: fixed; top: 0; left: 0. */
export function followPointer(
	el: HTMLElement,
	opts: { duration?: number; ease?: string } = {},
): Cleanup {
	if (prefersReducedMotion()) return noop;
	gsap.set(el, { xPercent: -50, yPercent: -50 });
	const duration = opts.duration ?? 0.6;
	const ease = opts.ease ?? "power3.out";
	const xTo = gsap.quickTo(el, "x", { duration, ease });
	const yTo = gsap.quickTo(el, "y", { duration, ease });
	const move = (e: PointerEvent) => {
		xTo(e.clientX);
		yTo(e.clientY);
	};
	window.addEventListener("pointermove", move, { passive: true });
	return () => window.removeEventListener("pointermove", move);
}

/** Button that leans toward the cursor when it is near. */
export function magnetic(
	el: HTMLElement,
	strength = 0.35,
	radius = 90,
): Cleanup {
	if (prefersReducedMotion()) return noop;
	const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
	const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
	const move = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		const dx = e.clientX - (r.left + r.width / 2);
		const dy = e.clientY - (r.top + r.height / 2);
		const reach = Math.max(r.width, r.height) / 2 + radius;
		if (Math.hypot(dx, dy) < reach) {
			xTo(dx * strength);
			yTo(dy * strength);
		} else {
			xTo(0);
			yTo(0);
		}
	};
	window.addEventListener("pointermove", move, { passive: true });
	return () => {
		window.removeEventListener("pointermove", move);
		gsap.set(el, { x: 0, y: 0 });
	};
}

/** Subtle 3D tilt toward the cursor. Skipped on touch screens. */
export function tilt(el: HTMLElement, max = 7): Cleanup {
	if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches)
		return noop;
	gsap.set(el, { transformPerspective: 900, transformOrigin: "center" });
	const rxTo = gsap.quickTo(el, "rotationX", {
		duration: 0.5,
		ease: "power3.out",
	});
	const ryTo = gsap.quickTo(el, "rotationY", {
		duration: 0.5,
		ease: "power3.out",
	});
	const move = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		const px = (e.clientX - r.left) / r.width - 0.5;
		const py = (e.clientY - r.top) / r.height - 0.5;
		ryTo(px * max * 2);
		rxTo(-py * max * 2);
	};
	const leave = () => {
		rxTo(0);
		ryTo(0);
	};
	el.addEventListener("pointermove", move);
	el.addEventListener("pointerleave", leave);
	return () => {
		el.removeEventListener("pointermove", move);
		el.removeEventListener("pointerleave", leave);
		gsap.set(el, { rotationX: 0, rotationY: 0 });
	};
}

/** Writes --mx / --my (pointer position inside the element) for CSS spotlight gradients. */
export function spotlight(el: HTMLElement): Cleanup {
	const move = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		el.style.setProperty("--mx", `${e.clientX - r.left}px`);
		el.style.setProperty("--my", `${e.clientY - r.top}px`);
	};
	el.addEventListener("pointermove", move);
	return () => el.removeEventListener("pointermove", move);
}

/** Writes --pointer-x / --pointer-y (viewport px) on the root, for the page-wide background glow. */
export function trackPointerVars(
	target: HTMLElement = document.documentElement,
): Cleanup {
	let raf = 0;
	let x = 0;
	let y = 0;
	const apply = () => {
		raf = 0;
		target.style.setProperty("--pointer-x", `${x}px`);
		target.style.setProperty("--pointer-y", `${y}px`);
	};
	const move = (e: PointerEvent) => {
		x = e.clientX;
		y = e.clientY;
		if (!raf) raf = requestAnimationFrame(apply);
	};
	window.addEventListener("pointermove", move, { passive: true });
	return () => {
		window.removeEventListener("pointermove", move);
		if (raf) cancelAnimationFrame(raf);
	};
}
