"use client";

import { BatteryFull, Signal, Wifi } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function StatusClock() {
	const [time, setTime] = useState("");
	useEffect(() => {
		const tick = () =>
			setTime(
				new Date().toLocaleTimeString("en-IN", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				}),
			);
		tick();
		const id = window.setInterval(tick, 30_000);
		return () => window.clearInterval(id);
	}, []);
	return (
		<span className="font-mono font-semibold text-xs tabular-nums">
			{time || "--:--"}
		</span>
	);
}

/** A phone bezel for the driver and helper screens, so they look like what the crew would hold. */
export function PhoneFrame({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative mx-auto w-[23rem] max-w-full rounded-[3rem] border-[#101a14] border-[10px] bg-[#101a14] shadow-[0_30px_60px_-25px_rgb(0_0_0/0.55)]",
				className,
			)}
			style={{ height: "min(47rem, calc(100dvh - 10.5rem))" }}
		>
			<div
				aria-hidden
				className="absolute top-2 left-1/2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black"
			/>
			<div className="flex h-full flex-col overflow-hidden rounded-[2.2rem] bg-background">
				<div className="flex shrink-0 items-center justify-between px-6 pt-3 pb-2 text-foreground/80">
					<StatusClock />
					<span aria-hidden className="flex items-center gap-1.5">
						<Signal className="size-3.5" />
						<Wifi className="size-3.5" />
						<BatteryFull className="size-4" />
					</span>
				</div>
				<div className="k-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
					{children}
				</div>
			</div>
		</div>
	);
}
