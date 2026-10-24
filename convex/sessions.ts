import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./audit";
import {
	assertCan,
	type Color,
	canTransition,
	closeReasonValidator,
	evaluateRedFlags,
	maxColor,
	type SessionStatus,
	sessionStatusValidator,
} from "./lib";

const colorValidator = v.union(
	v.literal("red"),
	v.literal("yellow"),
	v.literal("green"),
);

/* ---------------- internal helpers ---------------- */

async function logEventRow(
	ctx: MutationCtx,
	sessionId: Id<"sessions">,
	actor: string,
	message: string,
) {
	await ctx.db.insert("sessionEvents", {
		sessionId,
		actor,
		message,
		createdAt: Date.now(),
	});
}

async function latestVitals(ctx: MutationCtx, sessionId: Id<"sessions">) {
	return await ctx.db
		.query("vitalsLog")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.order("desc")
		.first();
}

/* ---------------- create / log ---------------- */

export const createSession = mutation({
	args: {
		source: v.union(v.literal("call"), v.literal("app")),
		callerPhone: v.optional(v.string()),
		incidentLat: v.number(),
		incidentLng: v.number(),
		incidentAddressGuess: v.optional(v.string()),
		city: v.optional(v.string()),
		language: v.optional(v.string()),
		locationSource: v.optional(
			v.union(
				v.literal("transcript"),
				v.literal("caller_link"),
				v.literal("pin"),
				v.literal("driver"),
				v.literal("default"),
			),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const sessionId = await ctx.db.insert("sessions", {
			source: args.source,
			callerPhone: args.callerPhone,
			city: args.city,
			language: args.language,
			incidentLat: args.incidentLat,
			incidentLng: args.incidentLng,
			incidentAddressGuess: args.incidentAddressGuess,
			incidentLocationSource: args.locationSource ?? "default",
			status: "created",
			createdAt: now,
		});
		await logEventRow(
			ctx,
			sessionId,
			args.source === "call" ? "Caller" : "App User",
			args.source === "call"
				? "Emergency call received. Session created."
				: "Emergency reported via app. Session created.",
		);
		await writeAudit(ctx, {
			sessionId,
			actor: "system",
			role: "system",
			action: "session_created",
		});
		return sessionId;
	},
});

export const logEvent = mutation({
	args: { sessionId: v.id("sessions"), actor: v.string(), message: v.string() },
	handler: async (ctx, args) => {
		await logEventRow(ctx, args.sessionId, args.actor, args.message);
	},
});

export const internalLogEvent = internalMutation({
	args: { sessionId: v.id("sessions"), actor: v.string(), message: v.string() },
	handler: async (ctx, args) => {
		await logEventRow(ctx, args.sessionId, args.actor, args.message);
	},
});

/* ---------------- guarded status changes ---------------- */

export const setStatus = mutation({
	args: {
		sessionId: v.id("sessions"),
		status: sessionStatusValidator,
		actor: v.optional(v.string()),
		role: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) throw new Error("Session not found");
		if (
			!canTransition(
				session.status as SessionStatus,
				args.status as SessionStatus,
			)
		) {
			throw new Error(
				`Illegal status change: ${session.status} -> ${args.status}`,
			);
		}
		if (session.status === args.status) return;
		await ctx.db.patch(args.sessionId, { status: args.status });
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor ?? "system",
			role: args.role ?? "system",
			action: "status_change",
			field: "status",
			oldValue: session.status,
			newValue: args.status,
		});
	},
});

/* ---------------- queries ---------------- */

export const getSession = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const listActiveSessions = query({
	args: {},
	handler: async (ctx) => {
		const all = await ctx.db.query("sessions").order("desc").take(100);
		return all.filter((s) => s.status !== "closed");
	},
});

export const getSessionEvents = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) =>
		await ctx.db
			.query("sessionEvents")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("asc")
			.collect(),
});

export const getVitalsForSession = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) =>
		await ctx.db
			.query("vitalsLog")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("desc")
			.collect(),
});

export const getTranscriptChunks = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) =>
		await ctx.db
			.query("transcriptChunks")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("asc")
			.collect(),
});

/** Headline numbers for the demo: call -> dispatch etc. (seconds). */
export const getMetrics = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		const s = await ctx.db.get(args.sessionId);
		if (!s) return null;
		const sec = (t?: number) =>
			t ? Math.round((t - s.createdAt) / 100) / 10 : null;
		return {
			callToDispatchSec: sec(s.dispatchedAt),
			callToHospitalSelectedSec: sec(s.hospitalSelectedAt),
			callToCloseSec: sec(s.closedAt),
		};
	},
});

/* ---------------- live transcript (chunked STT) ---------------- */

export const appendTranscriptChunk = mutation({
	args: {
		sessionId: v.id("sessions"),
		seq: v.number(),
		text: v.string(),
		translatedText: v.optional(v.string()),
		language: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) throw new Error("Session not found");
		const text = args.text.trim();
		if (!text) return null;

		await ctx.db.insert("transcriptChunks", {
			sessionId: args.sessionId,
			seq: args.seq,
			text,
			translatedText: args.translatedText,
			language: args.language,
			createdAt: Date.now(),
		});

		const original = [session.transcript, text].filter(Boolean).join(" ");
		const english = [session.transcriptEnglish, args.translatedText ?? text]
			.filter(Boolean)
			.join(" ");
		await ctx.db.patch(args.sessionId, {
			transcript: original,
			transcriptEnglish: english,
			language: args.language ?? session.language,
		});
		return { transcriptEnglish: english };
	},
});

/* ---------------- location with source tag ---------------- */

export const setLocation = mutation({
	args: {
		sessionId: v.id("sessions"),
		lat: v.number(),
		lng: v.number(),
		source: v.union(
			v.literal("transcript"),
			v.literal("caller_link"),
			v.literal("pin"),
			v.literal("driver"),
		),
		addressGuess: v.optional(v.string()),
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		assertCan(args.role, "set_location");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");
		await ctx.db.patch(args.sessionId, {
			incidentLat: args.lat,
			incidentLng: args.lng,
			incidentAddressGuess: args.addressGuess ?? s.incidentAddressGuess,
			incidentLocationSource: args.source,
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			`Incident location updated (${args.source}).`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "set_location",
			field: "incidentLocation",
			oldValue: `${s.incidentLat.toFixed(4)},${s.incidentLng.toFixed(4)} (${s.incidentLocationSource ?? "?"})`,
			newValue: `${args.lat.toFixed(4)},${args.lng.toFixed(4)} (${args.source})`,
		});
	},
});

/* ---------------- AI results (internal) ---------------- */

export const applyIntakeResult = internalMutation({
	args: {
		sessionId: v.id("sessions"),
		transcript: v.string(),
		extractedSymptoms: v.array(v.string()),
		firstAidGiven: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const s = await ctx.db.get(args.sessionId);
		if (!s) return;

		// Never rewind a session that has already moved on.
		const patch: Record<string, unknown> = {
			extractedSymptoms: args.extractedSymptoms,
			firstAidGiven: args.firstAidGiven,
		};
		if (!s.transcript) patch.transcript = args.transcript;
		if (s.status === "created") patch.status = "first_aid_in_progress";

		// Rule-based floor available immediately, before any LLM triage call.
		const floor = evaluateRedFlags(
			args.extractedSymptoms,
			await latestVitals(ctx, args.sessionId),
		);
		patch.redFlagReasons = floor.reasons;
		if (!s.triageOverriddenByErHead) {
			const current = (s.finalTriageColor ?? "green") as Color;
			const next = maxColor(current, floor.minColor);
			if (
				next !== s.finalTriageColor &&
				(floor.reasons.length > 0 || !s.finalTriageColor)
			) {
				patch.finalTriageColor = next;
				patch.triageSetBy = "rules";
				patch.triageUpdatedAt = Date.now();
			}
		}
		await ctx.db.patch(args.sessionId, patch);

		await logEventRow(
			ctx,
			args.sessionId,
			"AI Agent",
			`Detected: ${args.extractedSymptoms.join(", ") || "no clear symptoms yet"}. First-aid guidance sent.`,
		);
	},
});

export const applyTriageResult = internalMutation({
	args: {
		sessionId: v.id("sessions"),
		aiTriageColor: colorValidator,
		aiTriageReasoning: v.string(),
		assignedDoctorId: v.optional(v.id("doctors")),
	},
	handler: async (ctx, args) => {
		const s = await ctx.db.get(args.sessionId);
		if (!s) return;

		const floor = evaluateRedFlags(
			s.extractedSymptoms ?? [],
			await latestVitals(ctx, args.sessionId),
		);
		const safe = maxColor(args.aiTriageColor, floor.minColor);
		const escalated = safe !== args.aiTriageColor;

		const patch: Record<string, unknown> = {
			aiTriageColor: args.aiTriageColor,
			aiTriageReasoning:
				args.aiTriageReasoning +
				(escalated
					? ` [Safety rule raised this to ${safe.toUpperCase()}: ${floor.reasons.join("; ")}]`
					: ""),
			redFlagReasons: floor.reasons,
			triageUpdatedAt: Date.now(),
		};

		// A human override is sticky. Re-running the AI must not erase it.
		if (!s.triageOverriddenByErHead) {
			patch.finalTriageColor = safe;
			patch.triageSetBy = escalated ? "rules" : "AI";
		}
		// Only auto-assign a doctor if a human has not chosen one.
		if (args.assignedDoctorId && !s.doctorAssignedBy) {
			patch.assignedDoctorId = args.assignedDoctorId;
		}
		// NOTE: bed confirmation is NOT set here anymore. The ER head confirms it.
		await ctx.db.patch(args.sessionId, patch);

		await logEventRow(
			ctx,
			args.sessionId,
			"AI Agent",
			`Triage proposed: ${args.aiTriageColor.toUpperCase()}${escalated ? ` (raised to ${safe.toUpperCase()} by safety rules)` : ""}. ${args.aiTriageReasoning}`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: "AI Agent",
			role: "system",
			action: "ai_triage",
			field: "triageColor",
			oldValue: s.finalTriageColor,
			newValue: s.triageOverriddenByErHead ? s.finalTriageColor : safe,
			aiSuggested: args.aiTriageColor,
		});
	},
});

/* ---------------- human decisions ---------------- */

export const overrideTriage = mutation({
	args: {
		sessionId: v.id("sessions"),
		color: colorValidator,
		erHeadName: v.string(), // name of whoever is overriding (kept for compatibility)
		role: v.optional(v.string()), // "ero" | "er_head" | "doctor"
	},
	handler: async (ctx, args) => {
		const role = args.role ?? "er_head";
		assertCan(role, "override_triage");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");

		await ctx.db.patch(args.sessionId, {
			finalTriageColor: args.color,
			triageOverriddenByErHead: true,
			triageSetBy: `${role}:${args.erHeadName}`,
			triageUpdatedAt: Date.now(),
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.erHeadName,
			`${role.toUpperCase()} set triage to ${args.color.toUpperCase()} (AI suggested ${(s.aiTriageColor ?? "none").toUpperCase()}).`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.erHeadName,
			role,
			action: "override_triage",
			field: "triageColor",
			oldValue: s.finalTriageColor,
			newValue: args.color,
			aiSuggested: s.aiTriageColor,
		});
	},
});

export const assignDoctor = mutation({
	args: {
		sessionId: v.id("sessions"),
		doctorId: v.id("doctors"),
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		assertCan(args.role, "assign_doctor");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");
		const doc = await ctx.db.get(args.doctorId);
		if (!doc) throw new Error("Doctor not found");
		if (s.assignedHospitalId && doc.hospitalId !== s.assignedHospitalId) {
			throw new Error("Doctor does not work at the assigned hospital.");
		}
		await ctx.db.patch(args.sessionId, {
			assignedDoctorId: args.doctorId,
			doctorAssignedBy: `${args.role}:${args.actor}`,
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			`${doc.name} (${doc.specialty}) assigned to the patient.`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "assign_doctor",
			field: "assignedDoctorId",
			oldValue: s.assignedDoctorId,
			newValue: args.doctorId,
		});
	},
});

export const confirmBed = mutation({
	args: {
		sessionId: v.id("sessions"),
		confirmed: v.boolean(),
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		assertCan(args.role, "confirm_bed");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");
		await ctx.db.patch(args.sessionId, {
			assignedBedConfirmed: args.confirmed,
			bedConfirmedAt: args.confirmed ? Date.now() : undefined,
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			args.confirmed
				? "ER head confirmed a bed is ready."
				: "ER head marked the bed as NOT ready.",
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "confirm_bed",
			field: "assignedBedConfirmed",
			oldValue: String(s.assignedBedConfirmed ?? false),
			newValue: String(args.confirmed),
		});
	},
});

export const linkPatient = mutation({
	args: {
		sessionId: v.id("sessions"),
		patientId: v.optional(v.id("patients")),
		patientNameUnconfirmed: v.optional(v.string()),
		actor: v.string(),
		role: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const role = args.role ?? "helper";
		assertCan(role, "link_patient");
		await ctx.db.patch(args.sessionId, {
			patientId: args.patientId,
			patientNameUnconfirmed: args.patientNameUnconfirmed,
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			args.patientId
				? "Patient identified and linked to existing record."
				: `Patient not found in records. Proceeding as "${args.patientNameUnconfirmed ?? "Unknown"}".`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role,
			action: "link_patient",
			newValue: args.patientId ?? args.patientNameUnconfirmed ?? "unknown",
		});
	},
});

export const recordVitals = mutation({
	args: {
		sessionId: v.id("sessions"),
		heartRate: v.optional(v.number()),
		bloodPressureSystolic: v.optional(v.number()),
		bloodPressureDiastolic: v.optional(v.number()),
		spo2: v.optional(v.number()),
		consciousness: v.optional(
			v.union(
				v.literal("alert"),
				v.literal("responsive"),
				v.literal("unresponsive"),
			),
		),
		recordedBy: v.string(),
		role: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const role = args.role ?? "helper";
		assertCan(role, "record_vitals");
		const { role: _role, ...vitals } = args;
		await ctx.db.insert("vitalsLog", { ...vitals, recordedAt: Date.now() });
		await logEventRow(
			ctx,
			args.sessionId,
			args.recordedBy,
			"Vitals recorded and synced to ER dashboard.",
		);

		// Auto-escalate: dangerous vitals raise severity (never lower it).
		const s = await ctx.db.get(args.sessionId);
		if (!s) return;
		const floor = evaluateRedFlags(s.extractedSymptoms ?? [], vitals);
		const current = (s.finalTriageColor ?? "green") as Color;
		const next = maxColor(current, floor.minColor);
		if (next !== current) {
			if (!s.triageOverriddenByErHead) {
				await ctx.db.patch(args.sessionId, {
					finalTriageColor: next,
					triageSetBy: "rules",
					triageUpdatedAt: Date.now(),
					redFlagReasons: floor.reasons,
				});
			}
			await logEventRow(
				ctx,
				args.sessionId,
				"Safety Rules",
				`Vitals suggest ${next.toUpperCase()}: ${floor.reasons.join("; ")}.${s.triageOverriddenByErHead ? " Human override is in place, so the color was not changed. Please review." : ""}`,
			);
			await writeAudit(ctx, {
				sessionId: args.sessionId,
				actor: "Safety Rules",
				role: "system",
				action: "auto_escalate",
				field: "triageColor",
				oldValue: current,
				newValue: next,
			});
		}
	},
});

/* ---------------- ending a session ---------------- */

/** Driver / helper asks to end. ERO or ER head confirms with closeSession. */
export const requestEnd = mutation({
	args: {
		sessionId: v.id("sessions"),
		reason: closeReasonValidator,
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		assertCan(args.role, "request_end");
		await ctx.db.patch(args.sessionId, {
			endRequestedReason: args.reason,
			endRequestedBy: `${args.role}:${args.actor}`,
			endRequestedAt: Date.now(),
		});
		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			`Requested to end the session: ${args.reason.replace(/_/g, " ")}.`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "request_end",
			newValue: args.reason,
		});
	},
});

export const closeSession = mutation({
	args: {
		sessionId: v.id("sessions"),
		reason: closeReasonValidator,
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		assertCan(args.role, "close_session");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");
		if (s.status === "closed") return;

		await ctx.db.patch(args.sessionId, {
			status: "closed",
			closeReason: args.reason,
			closedAt: Date.now(),
		});

		// Ambulance goes to sanitizing. The driver marks it free afterwards.
		if (s.assignedAmbulanceId) {
			await ctx.db.patch(s.assignedAmbulanceId, { status: "sanitizing" });
		}

		// If the patient never reached the hospital, give the reserved bed back.
		if (s.bedReservedHospitalId && args.reason !== "handed_over") {
			const h = await ctx.db.get(s.bedReservedHospitalId);
			if (h) {
				await ctx.db.patch(h._id, {
					availableBeds: Math.min(h.totalBeds, h.availableBeds + 1),
				});
			}
			await ctx.db.patch(args.sessionId, { bedReservedHospitalId: undefined });
		}

		await logEventRow(
			ctx,
			args.sessionId,
			args.actor,
			`Session closed: ${args.reason.replace(/_/g, " ")}.`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "close_session",
			field: "status",
			oldValue: s.status,
			newValue: `closed (${args.reason})`,
		});
	},
});

/** Driver marks the ambulance free after sanitizing and restocking. */
export const markAmbulanceFree = mutation({
	args: { ambulanceId: v.id("ambulances"), actor: v.string() },
	handler: async (ctx, args) => {
		const a = await ctx.db.get(args.ambulanceId);
		if (!a) throw new Error("Ambulance not found");
		if (a.status !== "sanitizing") {
			throw new Error("Ambulance can only be marked free after sanitizing.");
		}
		await ctx.db.patch(args.ambulanceId, {
			status: "idle",
			currentSessionId: undefined,
		});
	},
});

// keep `internal` import used for future scheduler calls in batch 2
void internal;
