// Shared domain logic for RAKSHA. Pure functions + validators, no ctx.db here.
import { v } from "convex/values";

/* ------------------------------------------------------------------ */
/* Geo helpers (unchanged)                                             */
/* ------------------------------------------------------------------ */

export function distanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateEtaSeconds(km: number): number {
	const avgSpeedKmh = 40;
	return Math.round((km / avgSpeedKmh) * 3600);
}

/* ------------------------------------------------------------------ */
/* Session state machine                                               */
/* ------------------------------------------------------------------ */

export const sessionStatusValidator = v.union(
	v.literal("created"),
	v.literal("first_aid_in_progress"),
	v.literal("awaiting_dispatch_approval"),
	v.literal("ambulance_dispatched"),
	v.literal("ambulance_en_route_to_patient"),
	v.literal("patient_picked_up"),
	v.literal("awaiting_hospital_accept"),
	v.literal("en_route_to_hospital"),
	v.literal("arrived_at_hospital"),
	v.literal("closed"),
);

export type SessionStatus =
	| "created"
	| "first_aid_in_progress"
	| "awaiting_dispatch_approval"
	| "ambulance_dispatched"
	| "ambulance_en_route_to_patient"
	| "patient_picked_up"
	| "awaiting_hospital_accept"
	| "en_route_to_hospital"
	| "arrived_at_hospital"
	| "closed";

const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
	created: [
		"first_aid_in_progress",
		"awaiting_dispatch_approval",
		"ambulance_dispatched",
		"closed",
	],
	first_aid_in_progress: [
		"awaiting_dispatch_approval",
		"ambulance_dispatched",
		"closed",
	],
	awaiting_dispatch_approval: ["ambulance_dispatched", "closed"],
	// offer declined / timed out -> back to awaiting approval
	ambulance_dispatched: [
		"awaiting_dispatch_approval",
		"ambulance_en_route_to_patient",
		"patient_picked_up",
		"closed",
	],
	// treated on scene -> closed directly
	ambulance_en_route_to_patient: [
		"ambulance_dispatched",
		"patient_picked_up",
		"closed",
	],
	patient_picked_up: [
		"awaiting_hospital_accept",
		"en_route_to_hospital",
		"closed",
	],
	// hospital rejected -> back to picked_up, next hospital is tried
	awaiting_hospital_accept: [
		"patient_picked_up",
		"en_route_to_hospital",
		"closed",
	],
	en_route_to_hospital: [
		"awaiting_hospital_accept",
		"arrived_at_hospital",
		"closed",
	],
	arrived_at_hospital: ["closed"],
	closed: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
	return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export const closeReasonValidator = v.union(
	v.literal("treated_on_scene"),
	v.literal("refused_transport"),
	v.literal("handed_over"),
	v.literal("false_alarm"),
	v.literal("deceased"),
	v.literal("cancelled"),
);

/* ------------------------------------------------------------------ */
/* Roles / permissions (role switcher in the demo, enforced here)      */
/* ------------------------------------------------------------------ */

export type Role =
	| "caller"
	| "ero"
	| "driver"
	| "helper"
	| "er_head"
	| "doctor"
	| "outpost"
	| "system";

export type Action =
	| "override_triage"
	| "override_dispatch"
	| "choose_hospital"
	| "record_vitals"
	| "confirm_bed"
	| "assign_doctor"
	| "request_end"
	| "close_session"
	| "approve_signals"
	| "set_location"
	| "link_patient";

const PERMISSIONS: Record<Action, Role[]> = {
	override_triage: ["ero", "er_head", "doctor"],
	override_dispatch: ["ero"],
	choose_hospital: ["ero", "er_head", "helper", "driver"],
	record_vitals: ["helper", "driver", "ero"],
	confirm_bed: ["er_head"],
	assign_doctor: ["er_head"],
	request_end: ["driver", "helper", "ero"],
	close_session: ["ero", "er_head", "system"],
	approve_signals: ["ero", "outpost"],
	set_location: ["ero", "driver", "helper", "caller", "system"],
	link_patient: ["helper", "ero", "er_head", "doctor"],
};

export function can(role: string, action: Action): boolean {
	return (PERMISSIONS[action] as string[]).includes(role) || role === "system";
}

export function assertCan(role: string, action: Action): void {
	if (!can(role, action)) {
		throw new Error(`Role "${role}" is not allowed to perform "${action}".`);
	}
}

/* ------------------------------------------------------------------ */
/* Symptom -> facility mapping (canonical English codes)               */
/* The LLM must output ONLY these codes, in any input language.        */
/* ------------------------------------------------------------------ */

export const SYMPTOM_TO_FACILITY: Record<string, string[]> = {
	bleeding: ["trauma"],
	"heavy bleeding": ["trauma", "blood_bank"],
	fracture: ["trauma", "orthopedic"],
	unconscious: ["trauma", "neuro"],
	"head injury": ["neuro", "trauma"],
	"not breathing": ["icu", "ventilator"],
	drowning: ["icu", "ventilator"],
	"chest pain": ["cardiac"],
	"heart attack": ["cardiac", "icu"],
	burns: ["burns_unit"],
	seizure: ["neuro"],
	"spinal injury": ["neuro", "trauma"],
	pregnant: ["maternity"],
	"snake bite": ["icu", "antivenom"],
	poisoning: ["icu"],
	stroke: ["neuro", "icu"],
};

export function requiredFacilitiesFor(symptoms: string[]): string[] {
	const set = new Set<string>();
	for (const symptom of symptoms) {
		const mapped = SYMPTOM_TO_FACILITY[symptom.toLowerCase().trim()];
		if (mapped) {
			for (const f of mapped) set.add(f);
		}
	}
	if (set.size === 0) set.add("trauma");
	return Array.from(set);
}

/* ------------------------------------------------------------------ */
/* First aid. Now covers EVERY symptom code, so the intake agent       */
/* (which builds its allowed list from these keys) can detect all 16.  */
/* ------------------------------------------------------------------ */

export const FIRST_AID_STEPS: Record<string, string[]> = {
	bleeding: [
		"Apply firm, direct pressure on the wound with a clean cloth.",
		"Do not remove the cloth if it soaks through. Add another layer on top.",
		"Keep the injured area raised above heart level if possible.",
	],
	"heavy bleeding": [
		"Apply firm direct pressure with both hands using a clean cloth.",
		"Keep pressure constant. Do not check the wound repeatedly.",
		"If a limb is involved and bleeding does not stop, a tourniquet above the wound is a last resort.",
	],
	"not breathing": [
		"Tilt the head back gently and check the airway is clear.",
		"Begin CPR: 30 chest compressions, then 2 rescue breaths.",
		"Push hard and fast in the center of the chest, about 5 cm deep.",
		"Continue until help arrives or the person starts breathing.",
	],
	drowning: [
		"Move the person to dry, flat ground.",
		"If not breathing, begin CPR immediately.",
		"Turn the head to the side if they vomit water.",
	],
	unconscious: [
		"Check if the person is breathing normally.",
		"If breathing, place them in the recovery position on their side.",
		"Do not give food or water.",
	],
	fracture: [
		"Do not try to straighten or move the injured limb.",
		"Support the area above and below the injury to keep it still.",
		"Apply a cold pack wrapped in cloth if available.",
	],
	"chest pain": [
		"Help the person sit in a comfortable, upright position.",
		"Loosen tight clothing around the neck and chest.",
		"Keep them calm and still. Do not let them walk around.",
	],
	"heart attack": [
		"Sit the person down, upright and calm. Do not let them walk.",
		"If they are not allergic and are conscious, they may chew one aspirin (300 mg) if one is at hand.",
		"If they become unresponsive and stop breathing, start CPR.",
	],
	burns: [
		"Cool the burn under running water for at least 10 minutes.",
		"Do not apply ice, butter, or ointments.",
		"Cover loosely with a clean, non-stick cloth.",
	],
	seizure: [
		"Clear the area of anything that could cause injury.",
		"Do not hold the person down or put anything in their mouth.",
		"Turn them on their side once the seizure stops.",
	],
	stroke: [
		"Note the time symptoms started and tell the crew.",
		"Keep the person seated or lying with head slightly raised.",
		"Give nothing to eat or drink.",
	],
	"head injury": [
		"Keep the person still and the neck supported.",
		"Press a clean cloth on any bleeding without pushing on a possible skull fracture.",
		"Watch for vomiting, drowsiness or confusion and tell the crew.",
	],
	"spinal injury": [
		"Do not move the person unless there is immediate danger.",
		"Keep the head, neck and back in a straight line.",
		"Tell them to stay still until the ambulance arrives.",
	],
	pregnant: [
		"Help the woman lie on her left side, comfortable and calm.",
		"Do not give food or drink.",
		"Note contraction timing and tell the crew.",
	],
	"snake bite": [
		"Keep the person calm and the bitten limb still, below heart level.",
		"Remove rings and tight items near the bite.",
		"Do not cut, suck, or tie the wound. Note the snake's look if safe.",
	],
	poisoning: [
		"Do not induce vomiting.",
		"Keep the container or substance to show the crew.",
		"If unconscious, place in the recovery position.",
	],
};

/* ------------------------------------------------------------------ */
/* Triage safety floor. Rules run BEFORE/AFTER the LLM and can only    */
/* raise severity, never lower it.                                     */
/* ------------------------------------------------------------------ */

export type Color = "red" | "yellow" | "green";
const RANK: Record<Color, number> = { green: 0, yellow: 1, red: 2 };

export function maxColor(a: Color, b: Color): Color {
	return RANK[a] >= RANK[b] ? a : b;
}

const RED_SYMPTOMS = new Set([
	"not breathing",
	"unconscious",
	"heavy bleeding",
	"drowning",
	"heart attack",
	"stroke",
]);
const YELLOW_SYMPTOMS = new Set([
	"chest pain",
	"fracture",
	"burns",
	"seizure",
	"pregnant",
	"snake bite",
	"poisoning",
	"head injury",
	"spinal injury",
	"bleeding",
]);

export type VitalsLike = {
	heartRate?: number;
	bloodPressureSystolic?: number;
	spo2?: number;
	consciousness?: "alert" | "responsive" | "unresponsive";
};

export function evaluateRedFlags(
	symptoms: string[],
	vitals?: VitalsLike | null,
): { minColor: Color; reasons: string[] } {
	let minColor: Color = "green";
	const reasons: string[] = [];
	const bump = (c: Color, why: string) => {
		minColor = maxColor(minColor, c);
		reasons.push(why);
	};

	for (const s of symptoms) {
		const key = s.toLowerCase().trim();
		if (RED_SYMPTOMS.has(key)) bump("red", `Red-flag symptom: ${key}`);
		else if (YELLOW_SYMPTOMS.has(key)) bump("yellow", `Urgent symptom: ${key}`);
	}

	if (vitals) {
		if (vitals.spo2 !== undefined) {
			if (vitals.spo2 < 90) bump("red", `SpO2 ${vitals.spo2}% (<90)`);
			else if (vitals.spo2 < 94) bump("yellow", `SpO2 ${vitals.spo2}% (<94)`);
		}
		if (
			vitals.bloodPressureSystolic !== undefined &&
			vitals.bloodPressureSystolic < 90
		) {
			bump("red", `Systolic BP ${vitals.bloodPressureSystolic} (<90)`);
		}
		if (
			vitals.heartRate !== undefined &&
			(vitals.heartRate > 130 || vitals.heartRate < 40)
		) {
			bump("red", `Heart rate ${vitals.heartRate} bpm out of safe range`);
		}
		if (vitals.consciousness === "unresponsive")
			bump("red", "Patient unresponsive");
		else if (vitals.consciousness === "responsive")
			bump("yellow", "Patient only responds to stimulus");
	}

	return { minColor, reasons };
}

/* ------------------------------------------------------------------ */
/* Hospital score. Deterministic, the LLM only explains it.            */
/* Higher = better. beds == 0 -> ineligible.                           */
/* ------------------------------------------------------------------ */

export function scoreHospital(p: {
	required: string[];
	facilities: string[];
	availableBeds: number;
	distKm: number;
	color: Color;
}): { score: number; matched: number; fullMatch: boolean; etaMin: number } {
	const matched = p.required.filter((f) => p.facilities.includes(f)).length;
	const ratio = p.required.length ? matched / p.required.length : 1;
	const fullMatch = matched === p.required.length;
	const etaMin = estimateEtaSeconds(p.distKm) / 60;

	if (p.availableBeds <= 0) return { score: -1000, matched, fullMatch, etaMin };

	const facilityWeight =
		p.color === "red" ? 100 : p.color === "yellow" ? 80 : 50;
	const timePenaltyPerMin =
		p.color === "red" ? 2.0 : p.color === "yellow" ? 1.2 : 1.0;
	const missingPenalty = fullMatch ? 0 : p.color === "red" ? 40 : 20;

	const score =
		ratio * facilityWeight -
		Math.min(etaMin, 90) * timePenaltyPerMin -
		missingPenalty +
		Math.min(p.availableBeds, 10) * 0.5;

	return {
		score: Number(score.toFixed(2)),
		matched,
		fullMatch,
		etaMin: Number(etaMin.toFixed(1)),
	};
}
