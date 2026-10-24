export type TriageColor = "red" | "yellow" | "green";

interface TriageStyle {
	label: string;
	badgeVariant: "red" | "amber" | "green";
	dotColor: string;
	description: string;
}

export const TRIAGE_STYLES: Record<TriageColor, TriageStyle> = {
	red: {
		label: "RED — Immediate",
		badgeVariant: "red",
		dotColor: "var(--color-red)",
		description: "Life-threatening. Needs care within minutes.",
	},
	yellow: {
		label: "AMBER — Urgent",
		badgeVariant: "amber",
		dotColor: "var(--color-amber)",
		description: "Serious but stable enough to wait briefly.",
	},
	green: {
		label: "GREEN — Stable",
		badgeVariant: "green",
		dotColor: "var(--color-green)",
		description: "Non-critical. Can wait safely.",
	},
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
	created: "Session Created",
	first_aid_in_progress: "First Aid In Progress",
	ambulance_dispatched: "Ambulance Dispatched",
	ambulance_en_route_to_patient: "En Route to Patient",
	patient_picked_up: "Patient Picked Up",
	en_route_to_hospital: "En Route to Hospital",
	arrived_at_hospital: "Arrived at Hospital",
	closed: "Closed",
};
