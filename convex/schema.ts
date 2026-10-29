import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { closeReasonValidator, sessionStatusValidator } from "./lib";

const color = v.union(
	v.literal("red"),
	v.literal("yellow"),
	v.literal("green"),
);
const city = v.optional(v.string()); // "bengaluru" | "kalaburagi"

export default defineSchema({
	/* ---------------- PATIENTS (persistent identity + history) --------- */
	patients: defineTable({
		fullName: v.string(),
		phone: v.optional(v.string()),
		abhaNumber: v.optional(v.string()), // replaces Aadhaar/PAN lookup
		govtId: v.optional(v.string()), // legacy, to be removed from UI
		vehicleNumber: v.optional(v.string()), // legacy
		age: v.optional(v.number()),
		bloodGroup: v.optional(v.string()),
		knownAllergies: v.optional(v.array(v.string())),
		chronicConditions: v.optional(v.array(v.string())),
		photoUrl: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_phone", ["phone"])
		.index("by_abha", ["abhaNumber"])
		.index("by_govtId", ["govtId"])
		.index("by_vehicleNumber", ["vehicleNumber"]),

	medicalRecords: defineTable({
		patientId: v.id("patients"),
		visitDate: v.number(),
		hospitalId: v.optional(v.id("hospitals")),
		diagnosis: v.string(),
		notes: v.optional(v.string()),
	}).index("by_patient", ["patientId"]),

	/* ---------------- AMBULANCES --------------------------------------- */
	ambulances: defineTable({
		vehicleNumber: v.string(),
		driverName: v.string(),
		helperName: v.string(),
		lat: v.number(),
		lng: v.number(),
		city,
		status: v.union(
			v.literal("idle"),
			v.literal("offered"), // job offered, waiting for driver accept
			v.literal("dispatched"),
			v.literal("en_route_to_patient"),
			v.literal("with_patient"),
			v.literal("en_route_to_hospital"),
			v.literal("at_hospital"),
			v.literal("sanitizing"), // after session close, before driver marks free
		),
		currentSessionId: v.optional(v.id("sessions")),
		equipmentLevel: v.union(v.literal("basic"), v.literal("advanced")),
		 simMultiplier: v.optional(v.number()), // demo speed chosen by the ERO, kept across legs
	})
		.index("by_status", ["status"])
		.index("by_city_status", ["city", "status"]),

	/* ---------------- HOSPITALS / DOCTORS ------------------------------- */
	hospitals: defineTable({
		name: v.string(),
		lat: v.number(),
		lng: v.number(),
		city,
		facilities: v.array(v.string()),
		totalBeds: v.number(),
		availableBeds: v.number(),
		erHeadName: v.string(),
		acceptingEmergencies: v.optional(v.boolean()),
	}).index("by_city", ["city"]),

	doctors: defineTable({
		hospitalId: v.id("hospitals"),
		name: v.string(),
		specialty: v.string(),
		available: v.boolean(),
	}).index("by_hospital", ["hospitalId"]),

	/* ---------------- TRAFFIC SIGNALS ----------------------------------- */
	signals: defineTable({
		name: v.string(),
		lat: v.number(),
		lng: v.number(),
		city,
		state: v.union(v.literal("red"), v.literal("yellow"), v.literal("green")),
		policeNotified: v.boolean(),
		pendingApproval: v.optional(v.boolean()), // officer must approve green
		approvedBy: v.optional(v.string()),
		activeSessionId: v.optional(v.id("sessions")),
	}),

	/* ---------------- SESSIONS (central entity) ------------------------- */
	sessions: defineTable({
		source: v.union(v.literal("call"), v.literal("app")),
		callerPhone: v.optional(v.string()),
		city,
		language: v.optional(v.string()), // detected: "en" | "hi" | "kn" ...

		incidentLat: v.number(),
		incidentLng: v.number(),
		incidentAddressGuess: v.optional(v.string()),
		incidentLocationSource: v.optional(
			v.union(
				v.literal("transcript"),
				v.literal("caller_link"),
				v.literal("pin"),
				v.literal("driver"),
				v.literal("default"),
			),
		),

		patientId: v.optional(v.id("patients")),
		patientNameUnconfirmed: v.optional(v.string()),

		transcript: v.optional(v.string()), // original language, concatenated
		transcriptEnglish: v.optional(v.string()), // translated, drives all logic
		extractedSymptoms: v.optional(v.array(v.string())),
		firstAidGiven: v.optional(v.array(v.string())),

		assignedAmbulanceId: v.optional(v.id("ambulances")),
		assignedHospitalId: v.optional(v.id("hospitals")),
		etaSeconds: v.optional(v.number()),
		dispatchMode: v.optional(v.union(v.literal("auto"), v.literal("manual"))),
		vetoDeadline: v.optional(v.number()), // ERO can cancel auto dispatch until then

		aiTriageColor: v.optional(color),
		aiTriageReasoning: v.optional(v.string()),
		finalTriageColor: v.optional(color),
		triageOverriddenByErHead: v.optional(v.boolean()), // true when ANY human overrode
		triageSetBy: v.optional(v.string()), // "AI" | "ero:<name>" | "er_head:<name>" | "rules"
		triageUpdatedAt: v.optional(v.number()),
		redFlagReasons: v.optional(v.array(v.string())),

		assignedDoctorId: v.optional(v.id("doctors")),
		doctorAssignedBy: v.optional(v.string()),
		assignedBedConfirmed: v.optional(v.boolean()),
		bedConfirmedAt: v.optional(v.number()),
		bedReservedHospitalId: v.optional(v.id("hospitals")), // so beds never leak

		status: sessionStatusValidator,

		// timestamps for the "call to dispatch" headline metric
		createdAt: v.number(), // call received
		dispatchedAt: v.optional(v.number()),
		hospitalSelectedAt: v.optional(v.number()),
		closedAt: v.optional(v.number()),

		// session end
		endRequestedReason: v.optional(closeReasonValidator),
		endRequestedBy: v.optional(v.string()),
		endRequestedAt: v.optional(v.number()),
		closeReason: v.optional(closeReasonValidator),
	})
		.index("by_status", ["status"])
		.index("by_patient", ["patientId"]),

	/* ---------------- LIVE TRANSCRIPT CHUNKS ---------------------------- */
	transcriptChunks: defineTable({
		sessionId: v.id("sessions"),
		seq: v.number(),
		text: v.string(), // original language
		translatedText: v.optional(v.string()),
		language: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_session", ["sessionId", "seq"]),

	/* ---------------- DISPATCH OFFERS (accept / decline / timeout) ------ */
	dispatchOffers: defineTable({
		sessionId: v.id("sessions"),
		ambulanceId: v.id("ambulances"),
		status: v.union(
			v.literal("pending"),
			v.literal("accepted"),
			v.literal("declined"),
			v.literal("expired"),
			v.literal("cancelled"),
		),
		declineReason: v.optional(v.string()),
		offeredAt: v.number(),
		expiresAt: v.number(),
		respondedAt: v.optional(v.number()),
	})
		.index("by_session", ["sessionId"])
		.index("by_ambulance_status", ["ambulanceId", "status"]),

	/* ---------------- HOSPITAL REQUESTS (accept / reject / timeout) ----- */
	hospitalRequests: defineTable({
		sessionId: v.id("sessions"),
		hospitalId: v.id("hospitals"),
		rank: v.number(),
		score: v.number(),
		status: v.union(
			v.literal("pending"),
			v.literal("accepted"),
			v.literal("rejected"),
			v.literal("expired"),
			v.literal("cancelled"),
		),
		rejectReason: v.optional(v.string()),
		requestedAt: v.number(),
		expiresAt: v.number(),
		respondedAt: v.optional(v.number()),
	})
		.index("by_session", ["sessionId"])
		.index("by_hospital_status", ["hospitalId", "status"]),

	/* ---------------- ROUTES (road polyline + simulated progress) -------- */
	routes: defineTable({
		sessionId: v.id("sessions"),
		ambulanceId: v.id("ambulances"),
		leg: v.union(v.literal("to_patient"), v.literal("to_hospital")),
		coords: v.array(v.array(v.number())), // [lng, lat] pairs, downsampled
		cumM: v.array(v.number()), // cumulative meters per vertex
		totalM: v.number(),
		traveledM: v.number(),
		durationS: v.number(),
		speedKmh: v.number(),
		multiplier: v.number(), // demo speed-up factor
		lastTickAt: v.number(),
		status: v.union(
			v.literal("active"),
			v.literal("done"),
			v.literal("cancelled"),
		),
		source: v.union(v.literal("osrm"), v.literal("fallback")),
		signals: v.array(v.object({ signalId: v.id("signals"), posM: v.number() })),
		createdAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_ambulance_status", ["ambulanceId", "status"]),

	/* ---------------- VITALS --------------------------------------------- */
	vitalsLog: defineTable({
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
		recordedAt: v.number(),
		recordedBy: v.string(),
	}).index("by_session", ["sessionId"]),

	/* ---------------- EVENT FEED (human-readable) ------------------------ */
	sessionEvents: defineTable({
		sessionId: v.id("sessions"),
		actor: v.string(),
		message: v.string(),
		createdAt: v.number(),
	}).index("by_session", ["sessionId"]),

	/* ---------------- AUDIT LOG (structured, AI vs human) ---------------- */
	auditLog: defineTable({
		sessionId: v.id("sessions"),
		actor: v.string(),
		role: v.string(),
		action: v.string(), // "override_triage" | "assign_doctor" | "ai_triage" ...
		field: v.optional(v.string()),
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
		aiSuggested: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_session", ["sessionId"]),
});
