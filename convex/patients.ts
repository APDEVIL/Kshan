import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audit";
import { assertCan } from "./lib";

/* ---------------- lookups (identity only, no medical history) ---------------- */

export const lookupByPhone = query({
	args: { phone: v.string() },
	handler: async (ctx, args) =>
		await ctx.db
			.query("patients")
			.withIndex("by_phone", (q) => q.eq("phone", args.phone.trim()))
			.first(),
});

/** ABHA number (consent-based national health ID). Digits and dashes both accepted. */
export const lookupByAbha = query({
	args: { abhaNumber: v.string() },
	handler: async (ctx, args) => {
		const wanted = args.abhaNumber.replace(/\D/g, "");
		const all = await ctx.db.query("patients").collect();
		return (
			all.find((p) => (p.abhaNumber ?? "").replace(/\D/g, "") === wanted) ??
			null
		);
	},
});

/* ---------------- gated medical history ---------------- */

/**
 * Opens medical history for the session's linked patient. Always audited.
 *  - "consent": patient or family agreed (ABHA / phone OTP in a real system).
 *  - "break_glass": patient cannot consent. A reason is mandatory and logged.
 */
export const grantHistoryAccess = mutation({
	args: {
		sessionId: v.id("sessions"),
		mode: v.union(v.literal("consent"), v.literal("break_glass")),
		reason: v.optional(v.string()),
		actor: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args): Promise<void> => {
		assertCan(args.role, "link_patient");
		const s = await ctx.db.get(args.sessionId);
		if (!s) throw new Error("Session not found");
		if (!s.patientId) throw new Error("Link a patient to the session first.");
		if (args.mode === "break_glass" && (args.reason ?? "").trim().length < 3) {
			throw new Error("Break-glass access needs a reason.");
		}
		await ctx.db.insert("sessionEvents", {
			sessionId: args.sessionId,
			actor: args.actor,
			message:
				args.mode === "break_glass"
					? `Medical history opened by BREAK-GLASS (${args.reason?.trim()}).`
					: "Medical history opened with patient consent.",
			createdAt: Date.now(),
		});
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "history_access",
			field: args.mode,
			newValue: args.reason?.trim() ?? "consent",
		});
	},
});

/** Last 12 months of records. Returns nothing until access has been granted and audited. */
export const getHistoryForSession = query({
	args: { sessionId: v.id("sessions"), role: v.string() },
	handler: async (ctx, args) => {
		// Prototype: the role comes from the role switcher. With real auth, derive it server-side.
		if (!["helper", "ero", "er_head", "doctor"].includes(args.role)) {
			return { allowed: false as const, reason: "role" as const };
		}
		const s = await ctx.db.get(args.sessionId);
		if (!s?.patientId)
			return { allowed: false as const, reason: "no_patient" as const };

		const audit = await ctx.db
			.query("auditLog")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const grant = audit.find((a) => a.action === "history_access");
		if (!grant) return { allowed: false as const, reason: "no_grant" as const };

		const patient = await ctx.db.get(s.patientId);
		if (!patient)
			return { allowed: false as const, reason: "no_patient" as const };

		const cutoff = s.createdAt - 365 * 24 * 60 * 60 * 1000;
		const records = (
			await ctx.db
				.query("medicalRecords")
				.withIndex("by_patient", (q) => q.eq("patientId", patient._id))
				.order("desc")
				.take(50)
		).filter((r) => r.visitDate >= cutoff);

		return {
			allowed: true as const,
			accessMode: grant.field ?? "consent",
			patient: {
				fullName: patient.fullName,
				age: patient.age,
				bloodGroup: patient.bloodGroup,
				knownAllergies: patient.knownAllergies ?? [],
				chronicConditions: patient.chronicConditions ?? [],
			},
			records,
		};
	},
});

export const createPatient = mutation({
	args: {
		fullName: v.string(),
		phone: v.optional(v.string()),
		abhaNumber: v.optional(v.string()),
		age: v.optional(v.number()),
		bloodGroup: v.optional(v.string()),
		knownAllergies: v.optional(v.array(v.string())),
		chronicConditions: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) =>
		await ctx.db.insert("patients", { ...args, createdAt: Date.now() }),
});

/* ---------------- DEPRECATED, kept so the old UI compiles ---------------- */

/** Old Aadhaar-like lookup. Remove from the UI. Aadhaar/PAN are not a legal path to health data. */
export const lookupByGovtId = query({
	args: { govtId: v.string() },
	handler: async (ctx, args) =>
		await ctx.db
			.query("patients")
			.withIndex("by_govtId", (q) => q.eq("govtId", args.govtId))
			.first(),
});

export const lookupByVehicleNumber = query({
	args: { vehicleNumber: v.string() },
	handler: async (ctx, args) =>
		await ctx.db
			.query("patients")
			.withIndex("by_vehicleNumber", (q) =>
				q.eq("vehicleNumber", args.vehicleNumber),
			)
			.first(),
});

/** Removed: the random "face match" looked fake. Always returns null. */
export const mockFaceMatch = query({
	args: {},
	handler: async () => null,
});

/** UNGATED. Use getHistoryForSession instead. */
export const getPatientHistory = query({
	args: { patientId: v.id("patients") },
	handler: async (ctx, args) =>
		await ctx.db
			.query("medicalRecords")
			.withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
			.order("desc")
			.collect(),
});
