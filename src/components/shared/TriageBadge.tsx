import { type TriageColor, triageStyle } from "@/lib/triage";
import { cn } from "@/lib/utils";

const SIZE = {
	sm: "px-2 py-0.5 text-[11px] gap-1",
	md: "px-3 py-1 text-xs gap-1.5",
	lg: "px-4 py-2 text-base gap-2",
} as const;

/** Red / yellow / green triage chip. Pass nothing for the "not triaged yet" state. */
export function TriageBadge({
	color,
	size = "md",
	showMeaning = false,
	className,
}: {
	color?: TriageColor | null;
	size?: keyof typeof SIZE;
	showMeaning?: boolean;
	className?: string;
}) {
	const st = triageStyle(color);
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border font-bold tracking-wide",
				st.soft,
				st.text,
				st.border,
				SIZE[size],
				className,
			)}
		>
			<span
				className={cn(
					"rounded-full",
					size === "lg" ? "size-3" : "size-2",
					st.dot,
					color === "red" && "pulse-dot",
				)}
			/>
			{st.label}
			{showMeaning ? (
				<span className="font-medium opacity-75">· {st.meaning}</span>
			) : null}
		</span>
	);
}
