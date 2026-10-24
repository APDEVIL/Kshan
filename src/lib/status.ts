// Labels, tones and the 6-phase progress bar for sessions, ambulances, offers and hospital requests.
// Status strings must match convex/lib.ts and convex/schema.ts.
import type { SessionStatus } from "../../convex/lib";

export type StatusTone = "neutral" | "info" | "warn" | "ok" | "danger";

/** Dot / soft background / text classes per tone. Variables are defined in globals.css. */
export const TONE_CLASS: Record<
	StatusTone,
	{ dot: string; soft: string; text: string }
> = {
	neutral: {
		dot: "bg-[var(--muted-foreground)]",
		soft: "bg-[var(--muted)]",
		text: "text-[var(--muted-foreground)]",
	},
	info: {
		dot: "bg-[var(--info)]",
		soft: "bg-[var(--info)]/12",
		text: "text-[var(--info)]",
	},
	warn: {
		dot: "bg-[var(--warn)]",
		soft: "bg-[var(--warn)]/14",
		text: "text-[var(--warn)]",
	},
	ok: {
		dot: "bg-[var(--brand)]",
		soft: "bg-[var(--brand)]/14",
		text: "text-[var(--brand-deep)]",
	},
	danger: {
		dot: "bg-[var(--danger)]",
		soft: "bg-[var(--danger)]/12",
		text: "text-[var(--danger)]",
	},
};

export type PhaseKey =
	| "call"
	| "dispatch"
	| "enroute"
	| "care"
	| "transit"
	| "handover";

export const PHASES: { key: PhaseKey; label: string }[] = [
	{ key: "call", label: "Call" },
	{ key: "dispatch", label: "Dispatch" },
	{ key: "enroute", label: "En route" },
	{ key: "care", label: "Care" },
	{ key: "transit", label: "Transit" },
	{ key: "handover", label: "Handover" },
];

export const SESSION_STATUS: Record<
	SessionStatus,
	{ label: string; tone: StatusTone; phase: PhaseKey }
> = {
	created: { label: "Call received", tone: "info", phase: "call" },
	first_aid_in_progress: {
		label: "First aid guidance",
		tone: "info",
		phase: "call",
	},
	awaiting_dispatch_approval: {
		label: "Dispatch pending",
		tone: "warn",
		phase: "dispatch",
	},
	ambulance_dispatched: {
		label: "Ambulance dispatched",
		tone: "info",
		phase: "dispatch",
	},
	ambulance_en_route_to_patient: {
		label: "En route to patient",
		tone: "info",
		phase: "enroute",
	},
	patient_picked_up: { label: "Patient on board", tone: "ok", phase: "care" },
	awaiting_hospital_accept: {
		label: "Waiting for hospital",
		tone: "warn",
		phase: "care",
	},
	en_route_to_hospital: {
		label: "En route to hospital",
		tone: "info",
		phase: "transit",
	},
	arrived_at_hospital: { label: "At hospital", tone: "ok", phase: "handover" },
	closed: { label: "Closed", tone: "neutral", phase: "handover" },
};

export function sessionStatusMeta(status: SessionStatus) {
	return SESSION_STATUS[status];
}

export function phaseIndex(status: SessionStatus): number {
	const phase = SESSION_STATUS[status].phase;
	return PHASES.findIndex((p) => p.key === phase);
}

export function isClosed(status: SessionStatus): boolean {
	return status === "closed";
}

/** 0 to 100, for a thin progress bar. */
export function progressPercent(status: SessionStatus): number {
	if (status === "closed") return 100;
	return Math.round(((phaseIndex(status) + 0.5) / PHASES.length) * 100);
}

/* ---------------- ambulances ---------------- */

export type AmbulanceStatus =
	| "idle"
	| "offered"
	| "dispatched"
	| "en_route_to_patient"
	| "with_patient"
	| "en_route_to_hospital"
	| "at_hospital"
	| "sanitizing";

export const AMBULANCE_STATUS: Record<
	AmbulanceStatus,
	{ label: string; tone: StatusTone }
> = {
	idle: { label: "Available", tone: "ok" },
	offered: { label: "Job offered", tone: "warn" },
	dispatched: { label: "Dispatched", tone: "info" },
	en_route_to_patient: { label: "To patient", tone: "info" },
	with_patient: { label: "With patient", tone: "ok" },
	en_route_to_hospital: { label: "To hospital", tone: "info" },
	at_hospital: { label: "At hospital", tone: "ok" },
	sanitizing: { label: "Sanitizing", tone: "warn" },
};

/* ---------------- offers and hospital requests ---------------- */

export const OFFER_STATUS: Record<string, { label: string; tone: StatusTone }> =
	{
		pending: { label: "Waiting", tone: "warn" },
		accepted: { label: "Accepted", tone: "ok" },
		declined: { label: "Declined", tone: "danger" },
		expired: { label: "No response", tone: "danger" },
		cancelled: { label: "Cancelled", tone: "neutral" },
	};

export const REQUEST_STATUS: Record<
	string,
	{ label: string; tone: StatusTone }
> = {
	pending: { label: "Waiting", tone: "warn" },
	accepted: { label: "Accepted", tone: "ok" },
	rejected: { label: "Rejected", tone: "danger" },
	expired: { label: "No response", tone: "danger" },
	cancelled: { label: "Cancelled", tone: "neutral" },
};
