import { type StatusTone, TONE_CLASS } from "@/lib/status";
import { cn } from "@/lib/utils";

/** A small dot with a soft ripple, for "this is live" indicators. */
export function LiveDot({
	tone = "ok",
	className,
}: {
	tone?: StatusTone;
	className?: string;
}) {
	const dot = TONE_CLASS[tone].dot;
	return (
		<span
			aria-hidden
			className={cn("relative inline-flex size-2.5", className)}
		>
			<span className={cn("k-ping absolute inset-0 rounded-full", dot)} />
			<span className={cn("relative size-2.5 rounded-full", dot)} />
		</span>
	);
}
