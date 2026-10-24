"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PHASES, phaseIndex } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "../../../convex/lib";

/** Six-step mission progress: call, dispatch, en route, care, transit, handover. */
export function StatusStepper({
	status,
	className,
}: {
	status: SessionStatus;
	className?: string;
}) {
	const closed = status === "closed";
	const current = phaseIndex(status);

	return (
		<ol
			aria-label="Mission progress"
			className={cn("flex items-start", className)}
		>
			{PHASES.map((phase, i) => {
				const done = closed || i < current;
				const active = !closed && i === current;
				return (
					<li
						className="relative flex flex-1 flex-col items-center gap-1.5"
						key={phase.key}
					>
						{i > 0 ? (
							<span
								aria-hidden
								className={cn(
									"absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2 rounded-full transition-colors duration-500",
									done || active ? "bg-brand" : "bg-current/15",
								)}
							/>
						) : null}
						<motion.span
							animate={{ scale: active ? 1.18 : 1 }}
							className={cn(
								"relative z-10 grid size-6 place-items-center rounded-full border-2 font-bold text-[10px] transition-colors duration-300",
								done && "border-brand bg-brand text-brand-foreground",
								active && "border-brand bg-transparent text-brand",
								!done &&
									!active &&
									"border-current/20 bg-transparent text-current/40",
							)}
							transition={{ type: "spring", stiffness: 380, damping: 22 }}
						>
							{done ? <Check className="size-3.5" strokeWidth={3.5} /> : i + 1}
						</motion.span>
						<span
							className={cn(
								"font-semibold text-[10px] leading-none tracking-wide",
								active ? "text-brand" : done ? "opacity-80" : "opacity-45",
							)}
						>
							{phase.label}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
