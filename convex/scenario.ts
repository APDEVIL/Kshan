import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { SCENARIOS, type ScenarioKey } from "./demoData";

const CHUNK_GAP_MS = 3000;
const MAX_ATTEMPTS = 200; // 200 polls x ~2 s, so a human playing a role has several minutes per step
const CREW_ROLES = ["ero", "driver", "helper", "er_head", "doctor", "outpost"];

type Leg = "to_patient" | "to_hospital";
type CrewArgs = {
	sessionId: Id<"sessions">;
	phase: string;
	attempt: number;
	playAs?: string;
	leg?: Leg;
};

// Typed by hand, so this file does not depend on the generated api.d.ts listing this module.
const autoPlayRef = makeFunctionReference<"mutation", CrewArgs, null>(
	"scenario:autoPlay",
);

export const listScenarios = query({
	args: {},
	handler: async () =>
		(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => ({
			key,
			label: SCENARIOS[key].label,
			city: SCENARIOS[key].city,
			language: SCENARIOS[key].language,
		})),
});

/**
 * Plays a scripted emergency call: transcript chunks arrive every 3 s, the intake agent
 * extracts symptoms, triage and dispatch start in parallel.
 * The demo crew (driver, helper, ER head, outpost officer) acts automatically for every role
 * EXCEPT the one in `playAs`, which waits for a real person. That is the guided walkthrough:
 * pick a role, and the rest of the system plays around you.
 */
export const startScenario = mutation({
	args: {
		scenario: v.string(),
		autoPlay: v.optional(v.boolean()),
		playAs: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<{ sessionId: Id<"sessions"> }> => {
		const sc = SCENARIOS[args.scenario as ScenarioKey];
		if (!sc) throw new Error(`Unknown scenario "${args.scenario}".`);
		const playAs =
			args.playAs && CREW_ROLES.includes(args.playAs) ? args.playAs : undefined;

		const now = Date.now();
		const sessionId = await ctx.db.insert("sessions", {
			source: "call",
			callerPhone: sc.callerPhone,
			city: sc.city,
			language: sc.language,
			incidentLat: sc.lat,
			incidentLng: sc.lng,
			incidentAddressGuess: sc.address,
			incidentLocationSource: "pin",
			status: "created",
			createdAt: now,
		});
		await ctx.db.insert("sessionEvents", {
			sessionId,
			actor: "Caller",
			message: `Emergency call received (${sc.label}). Session created.`,
			createdAt: now,
		});

		sc.chunks.forEach((c, i) => {
			void ctx.scheduler.runAfter(
				500 + i * CHUNK_GAP_MS,
				api.sessions.appendTranscriptChunk,
				{
					sessionId,
					seq: i,
					text: c.original,
					translatedText: c.english,
					language: sc.language,
				},
			);
		});

		// Intake after the 2nd chunk (early dispatch) and again after the last chunk.
		void ctx.scheduler.runAfter(
			500 + 1 * CHUNK_GAP_MS + 1200,
			api.intakeAgent.processIntakeTranscript,
			{ sessionId },
		);
		void ctx.scheduler.runAfter(
			500 + (sc.chunks.length - 1) * CHUNK_GAP_MS + 1200,
			api.intakeAgent.processIntakeTranscript,
			{ sessionId },
		);

		if (args.autoPlay !== false) {
			void ctx.scheduler.runAfter(6000, autoPlayRef, {
				sessionId,
				phase: "offer",
				attempt: 0,
				...(playAs ? { playAs } : {}),
			});
		}
		return { sessionId };
	},
});

/**
 * Demo crew. Each phase polls until its precondition is true, then moves on.
 * When `playAs` names the role a phase would act as, the phase only WAITS for the human to do it.
 */
export const autoPlay = internalMutation({
	args: {
		sessionId: v.id("sessions"),
		phase: v.string(),
		attempt: v.number(),
		playAs: v.optional(v.string()),
		leg: v.optional(v.union(v.literal("to_patient"), v.literal("to_hospital"))),
	},
	handler: async (ctx, args): Promise<void> => {
		const s = await ctx.db.get(args.sessionId);
		if (!s || args.attempt > MAX_ATTEMPTS) return;
		if (s.status === "closed" && args.phase !== "free") return;

		const human = args.playAs;
		const carry = human ? { playAs: human } : {};

		const again = async (ms = 2000): Promise<void> => {
			await ctx.scheduler.runAfter(ms, autoPlayRef, {
				sessionId: args.sessionId,
				phase: args.phase,
				attempt: args.attempt + 1,
				...carry,
				...(args.leg ? { leg: args.leg } : {}),
			});
		};
		const next = async (phase: string, ms = 1500): Promise<void> => {
			await ctx.scheduler.runAfter(ms, autoPlayRef, {
				sessionId: args.sessionId,
				phase,
				attempt: 0,
				...carry,
			});
		};
		/** The officer approves the green corridor once the route for that leg exists. */
		const startApproval = async (leg: Leg): Promise<void> => {
			if (human === "outpost") return; // the human officer does this
			await ctx.scheduler.runAfter(2500, autoPlayRef, {
				sessionId: args.sessionId,
				phase: "approve",
				attempt: 0,
				leg,
				...carry,
			});
		};

		if (args.phase === "offer") {
			if (human === "driver") {
				if (!s.assignedAmbulanceId) return again(); // waiting for the human driver to accept
				await startApproval("to_patient");
				return next("prealert", 3000);
			}
			const offers = await ctx.db
				.query("dispatchOffers")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			const pending = offers.find((o) => o.status === "pending");
			if (!pending) return again();
			await ctx.runMutation(api.dispatch.respondToOffer, {
				offerId: pending._id,
				accept: true,
				actor: "Demo driver",
				role: "driver",
			});
			await startApproval("to_patient");
			return next("prealert", 3000);
		}

		if (args.phase === "approve") {
			const wanted: Leg = args.leg ?? "to_patient";
			const routes = await ctx.db
				.query("routes")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			if (!routes.some((r) => r.status === "active" && r.leg === wanted))
				return again(1500);
			await ctx.runMutation(api.traffic.approveCorridor, {
				sessionId: args.sessionId,
				actor: "Outpost Officer",
				role: "outpost",
			});
			return;
		}

		if (args.phase === "prealert") {
			if (human === "ero" || human === "helper") {
				// the human sends the pre-alert
				const reqs = await ctx.db
					.query("hospitalRequests")
					.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
					.collect();
				if (reqs.length === 0 && !s.assignedHospitalId) return again();
				return next("hospital", 1000);
			}
			await ctx.runMutation(api.dispatch.requestHospital, {
				sessionId: args.sessionId,
				actor: "Dispatch Agent",
				role: "ero",
			});
			return next("hospital", 2000);
		}

		if (args.phase === "hospital") {
			if (human === "er_head") {
				if (!s.assignedHospitalId) return again(); // waiting for the human ER head to accept
				return next("arrive", 500);
			}
			const reqs = await ctx.db
				.query("hospitalRequests")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			const pending = reqs.find((r) => r.status === "pending");
			if (!pending) {
				if (s.assignedHospitalId) return next("arrive", 500);
				return again();
			}
			await ctx.runMutation(api.dispatch.respondHospitalRequest, {
				requestId: pending._id,
				accept: true,
				actor: "Demo ER head",
				role: "er_head",
			});
			return next("arrive", 1500);
		}

		if (args.phase === "arrive") {
			const aboard =
				s.status === "patient_picked_up" ||
				s.status === "awaiting_hospital_accept";
			if (!aboard) return again();
			if (human === "helper") {
				const first = await ctx.db
					.query("vitalsLog")
					.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
					.first();
				if (!first) return again(); // waiting for the human helper to record vitals
				return next("depart", 1500);
			}
			const trauma = (s.extractedSymptoms ?? []).some((x) =>
				["bleeding", "heavy bleeding", "fracture", "head injury"].includes(x),
			);
			await ctx.runMutation(api.sessions.recordVitals, {
				sessionId: args.sessionId,
				heartRate: trauma ? 118 : 126,
				bloodPressureSystolic: trauma ? 100 : 88,
				bloodPressureDiastolic: trauma ? 70 : 56,
				spo2: trauma ? 95 : 91,
				consciousness: trauma ? "unresponsive" : "responsive",
				recordedBy: "Demo helper",
				role: "helper",
			});
			return next("depart", 2500);
		}

		if (args.phase === "depart") {
			if (!s.assignedAmbulanceId) return again();
			if (human === "driver") {
				const amb = await ctx.db.get(s.assignedAmbulanceId);
				if (!amb || amb.status !== "en_route_to_hospital") return again(); // waiting for the human to depart
			} else {
				try {
					await ctx.runMutation(api.ambulanceSim.departForHospital, {
						ambulanceId: s.assignedAmbulanceId,
						actor: "Demo driver",
						role: "driver",
					});
				} catch {
					return again(); // hospital not accepted yet
				}
			}
			await startApproval("to_hospital");
			return next("free", 3000);
		}

		if (args.phase === "free") {
			if (s.status !== "closed") return again(3000);
			if (human === "driver") return; // the human taps "mark ambulance free"
			if (s.assignedAmbulanceId) {
				const amb = await ctx.db.get(s.assignedAmbulanceId);
				if (amb && amb.status === "sanitizing") {
					await ctx.db.patch(amb._id, {
						status: "idle",
						currentSessionId: undefined,
					});
				}
			}
		}
	},
});
