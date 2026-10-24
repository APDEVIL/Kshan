"use client";

import { Activity } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Kshan logo. Uses /public/logo.png when it exists and falls back to a drawn mark until then.
 */
export function Wordmark({
	className,
	showNative = true,
}: {
	className?: string;
	showNative?: boolean;
}) {
	const [logoOk, setLogoOk] = useState(true);

	return (
		<div className={cn("flex items-center gap-2.5", className)}>
			{logoOk ? (
				// biome-ignore lint/performance/noImgElement: a tiny static logo, next/image adds nothing here
				<img
					alt=""
					className="size-9 rounded-xl object-contain"
					height={36}
					onError={() => setLogoOk(false)}
					src={BRAND.logoSrc}
					width={36}
				/>
			) : (
				<span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-[0_6px_16px_-6px_var(--brand)]">
					<Activity className="size-5" strokeWidth={2.8} />
				</span>
			)}
			<span className="flex items-baseline gap-1.5 leading-none">
				<span className="font-extrabold text-xl tracking-tight">
					{BRAND.name}
				</span>
				{showNative ? (
					<span className="font-semibold text-brand-deep text-sm">
						{BRAND.native}
					</span>
				) : null}
			</span>
		</div>
	);
}
