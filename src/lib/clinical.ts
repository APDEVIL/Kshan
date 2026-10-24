// Display helpers for symptoms, facilities and vitals.
// Vital thresholds mirror the safety rules in convex/lib.ts (evaluateRedFlags).
import { SYMPTOM_TO_FACILITY } from "../../convex/lib";
import { snakeToWords, titleCase } from "./format";

export const SYMPTOM_CODES: string[] = Object.keys(SYMPTOM_TO_FACILITY);

export function symptomLabel(code: string): string {
	return titleCase(code);
}

export const FACILITY_LABELS: Record<string, string> = {
	trauma: "Trauma",
	neuro: "Neuro",
	icu: "ICU",
	ventilator: "Ventilator",
	cardiac: "Cardiac",
	orthopedic: "Orthopedic",
	burns_unit: "Burns unit",
	blood_bank: "Blood bank",
	maternity: "Maternity",
	antivenom: "Antivenom",
};

export function facilityLabel(code: string): string {
	return FACILITY_LABELS[code] ?? snakeToWords(code);
}

/* ---------------- vitals ---------------- */

export type VitalKey = "heartRate" | "systolic" | "diastolic" | "spo2";
export type VitalTone = "ok" | "warn" | "critical" | "unknown";

export const VITAL_META: Record<
	VitalKey,
	{ label: string; unit: string; normal: string }
> = {
	heartRate: { label: "Heart rate", unit: "bpm", normal: "50-110" },
	systolic: { label: "Systolic BP", unit: "mmHg", normal: "100-160" },
	diastolic: { label: "Diastolic BP", unit: "mmHg", normal: "50-100" },
	spo2: { label: "SpO2", unit: "%", normal: "94-100" },
};

export function vitalTone(key: VitalKey, value?: number | null): VitalTone {
	if (value === null || value === undefined) return "unknown";
	switch (key) {
		case "heartRate":
			if (value < 40 || value > 130) return "critical";
			if (value < 50 || value > 110) return "warn";
			return "ok";
		case "systolic":
			if (value < 90) return "critical";
			if (value < 100 || value > 160) return "warn";
			return "ok";
		case "diastolic":
			if (value < 50 || value > 110) return "warn";
			return "ok";
		case "spo2":
			if (value < 90) return "critical";
			if (value < 94) return "warn";
			return "ok";
	}
}

export const VITAL_TONE_CLASS: Record<
	VitalTone,
	{ text: string; soft: string }
> = {
	ok: { text: "text-[var(--brand-deep)]", soft: "bg-[var(--brand)]/12" },
	warn: { text: "text-[var(--warn)]", soft: "bg-[var(--warn)]/14" },
	critical: { text: "text-[var(--danger)]", soft: "bg-[var(--danger)]/12" },
	unknown: {
		text: "text-[var(--muted-foreground)]",
		soft: "bg-[var(--muted)]",
	},
};

export type Consciousness = "alert" | "responsive" | "unresponsive";

export const CONSCIOUSNESS: Record<
	Consciousness,
	{ label: string; tone: VitalTone }
> = {
	alert: { label: "Alert", tone: "ok" },
	responsive: { label: "Responds to stimulus", tone: "warn" },
	unresponsive: { label: "Unresponsive", tone: "critical" },
};
