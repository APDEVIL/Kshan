// Triage palette and helpers. Kept separate from the lime brand so red/amber/green never clash with it.
// CSS variables (--triage-red etc.) are defined in globals.css.
import type { Color } from "../../convex/lib";

export type TriageColor = Color;

export const TRIAGE_ORDER: TriageColor[] = ["red", "yellow", "green"];

export interface TriageStyle {
	label: string;
	meaning: string;
	hex: string;
	dot: string;
	soft: string;
	text: string;
	border: string;
	ring: string;
}

// Class names are written out in full so Tailwind can find them.
export const TRIAGE: Record<TriageColor, TriageStyle> = {
	red: {
		label: "Red",
		meaning: "Immediate",
		hex: "#e5484d",
		dot: "bg-[var(--triage-red)]",
		soft: "bg-[var(--triage-red)]/12",
		text: "text-[var(--triage-red)]",
		border: "border-[var(--triage-red)]/40",
		ring: "ring-[var(--triage-red)]/30",
	},
	yellow: {
		label: "Yellow",
		meaning: "Urgent",
		hex: "#f0a020",
		dot: "bg-[var(--triage-yellow)]",
		soft: "bg-[var(--triage-yellow)]/14",
		text: "text-[var(--triage-yellow)]",
		border: "border-[var(--triage-yellow)]/45",
		ring: "ring-[var(--triage-yellow)]/30",
	},
	green: {
		label: "Green",
		meaning: "Non-critical",
		hex: "#2fb36d",
		dot: "bg-[var(--triage-green)]",
		soft: "bg-[var(--triage-green)]/12",
		text: "text-[var(--triage-green)]",
		border: "border-[var(--triage-green)]/40",
		ring: "ring-[var(--triage-green)]/30",
	},
};

export const TRIAGE_UNKNOWN: TriageStyle = {
	label: "Pending",
	meaning: "Not triaged yet",
	hex: "#9aa59c",
	dot: "bg-[var(--muted-foreground)]",
	soft: "bg-[var(--muted)]",
	text: "text-[var(--muted-foreground)]",
	border: "border-[var(--border)]",
	ring: "ring-[var(--border)]",
};

export function triageStyle(color?: TriageColor | null): TriageStyle {
	return color ? TRIAGE[color] : TRIAGE_UNKNOWN;
}

const RANK: Record<TriageColor, number> = { green: 0, yellow: 1, red: 2 };

export function triageRank(color?: TriageColor | null): number {
	return color ? RANK[color] : -1;
}

export function maxTriage(a: TriageColor, b: TriageColor): TriageColor {
	return RANK[a] >= RANK[b] ? a : b;
}

/** True when the new color is more severe than the old one. */
export function isEscalation(
	from: TriageColor | null | undefined,
	to: TriageColor,
): boolean {
	return triageRank(to) > triageRank(from);
}

/**
 * Turns the backend's triageSetBy ("AI", "rules", "ero:Meera", "er_head:Dr. Rao")
 * into something readable, plus whether a human made the call.
 */
export function describeTriageSource(setBy?: string | null): {
	label: string;
	human: boolean;
} {
	if (!setBy) return { label: "Not set", human: false };
	if (setBy === "AI") return { label: "AI suggestion", human: false };
	if (setBy === "rules") return { label: "Safety rules", human: false };
	const sep = setBy.indexOf(":");
	if (sep < 0) return { label: setBy, human: true };
	const role = setBy.slice(0, sep);
	const name = setBy.slice(sep + 1);
	const roleLabel =
		role === "ero"
			? "ERO"
			: role === "er_head"
				? "ER Head"
				: role === "doctor"
					? "Doctor"
					: role;
	return { label: `${roleLabel} · ${name}`, human: true };
}
