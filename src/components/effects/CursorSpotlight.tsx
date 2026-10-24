"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsapSetup";
import { prefersReducedMotion } from "@/lib/motion";
import { followPointer, trackPointerVars, type Cleanup } from "@/lib/pointerFx";

/**
 * A soft red-and-blue siren light that trails the mouse (the cursor itself is an ambulance, set in
 * globals.css), and the source of the page-wide background glow (--pointer-x / --pointer-y).
 * Does nothing on touch screens or when the user prefers reduced motion.
 */
export function CursorSpotlight() {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return;
    const glowEl = glow.current;
    if (!glowEl) return;

    const cleanups: Cleanup[] = [trackPointerVars(), followPointer(glowEl, { duration: 0.45 })];

    // stay hidden until the first mouse move, so nothing flashes in the top-left corner
    gsap.set(glowEl, { opacity: 0 });
    const reveal = () => {
      gsap.to(glowEl, { opacity: 1, duration: 0.3 });
    };
    window.addEventListener("pointermove", reveal, { once: true });

    const over = (e: PointerEvent) => {
      const target = e.target;
      const hot =
        target instanceof Element &&
        target.closest("a, button, input, select, textarea, [role='button'], [data-cursor]") !== null;
      gsap.to(glowEl, { scale: hot ? 1.7 : 1, duration: 0.25, ease: "power2.out" });
    };
    window.addEventListener("pointerover", over, { passive: true });

    return () => {
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("pointerover", over);
    };
  }, []);

  return <div ref={glow} aria-hidden className="k-siren-glow pointer-events-none fixed top-0 left-0 z-[9998] size-10 opacity-0" />;
}