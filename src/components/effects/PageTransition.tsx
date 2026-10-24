"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageVariants } from "@/lib/motion";

/** Enter animation for every screen. Used from template.tsx, which remounts on each navigation. */
export function PageTransition({ children }: { children: ReactNode }) {
	return (
		<motion.div
			animate="animate"
			className="min-h-full"
			initial="initial"
			variants={pageVariants}
		>
			{children}
		</motion.div>
	);
}
