// Read-only queries the frontend screens use. Role-aware, so the driver and the traffic officer
// never receive medical detail they should not see (enforced here, not just hidden in the UI).
// The role string comes from the demo's role switcher. With real login it would come from the auth token.

import { v } from "convex/values";
import { query } from "./_generated/server";

const CLINICAL_ROLES = new Set(["ero", "helper", "er_head", "doctor"]);
const OUTPOST_FEED_ACTORS =
	/traffic|routing|dispatch|ambulance|outpost|caller|demo driver/i;

function maskPhone(phone: string | undefined): string | undefined {
	if (!phone) return undefined;
	const digits = phone.replace(/\D/g, "");
	if (digits.length < 6) return "••••";
	return `${digits.slice(0, 2)}••••${digits.slice(-3)}`;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

function secondsBetween(from: number, to: number | undefined): number | null {
	return to === undefined ? null : round1((to - from) / 1000);
}

/** Everything one screen needs about a session, in a single reactive query. */
export const getSessionSnapshot = query({
	args: { sessionId: v.id("sessions"), role: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const s = await ctx.db.get(args.sessionId);
		if (!s) return null;

		const role = args.role ?? "ero";
		const clinical = CLINICAL_ROLES.has(role);
		const isDriver = role === "driver";
		const isOutpost = role === "outpost";

		const [
			ambulance,
			hospital,
			doctor,
			patient,
			offers,
			requests,
			routes,
			vitals,
		] = await Promise.all([
			s.assignedAmbulanceId
				? ctx.db.get(s.assignedAmbulanceId)
				: Promise.resolve(null),
			s.assignedHospitalId
				? ctx.db.get(s.assignedHospitalId)
				: Promise.resolve(null),
			s.assignedDoctorId
				? ctx.db.get(s.assignedDoctorId)
				: Promise.resolve(null),
			s.patientId ? ctx.db.get(s.patientId) : Promise.resolve(null),
			ctx.db
				.query("dispatchOffers")
				.withIndex("by_session", (q) => q.eq("sessionId", s._id))
				.collect(),
			ctx.db
				.query("hospitalRequests")
				.withIndex("by_session", (q) => q.eq("sessionId", s._id))
				.collect(),
			ctx.db
				.query("routes")
				.withIndex("by_session", (q) => q.eq("sessionId", s._id))
				.collect(),
			ctx.db
				.query("vitalsLog")
				.withIndex("by_session", (q) => q.eq("sessionId", s._id))
				.order("desc")
				.first(),
		]);

		const pendingOffer = offers.find((o) => o.status === "pending");
		const offerAmbulance = pendingOffer
			? await ctx.db.get(pendingOffer.ambulanceId)
			: null;
		const pendingRequest = requests.find((r) => r.status === "pending");
		const requestHospital = pendingRequest
			? await ctx.db.get(pendingRequest.hospitalId)
			: null;

		const activeRoute = routes.find((r) => r.status === "active");
		const lastRoute = [...routes].sort((a, b) => b.createdAt - a.createdAt)[0];
		const route = activeRoute ?? lastRoute;

		return {
			viewerRole: role,

			session: {
				_id: s._id,
				status: s.status,
				source: s.source,
				city: s.city,
				language: s.language,
				callerPhone:
					role === "ero"
						? s.callerPhone
						: isOutpost
							? undefined
							: maskPhone(s.callerPhone),
				createdAt: s.createdAt,
				dispatchedAt: s.dispatchedAt,
				hospitalSelectedAt: s.hospitalSelectedAt,
				closedAt: s.closedAt,
				closeReason: s.closeReason,
				incidentLat: s.incidentLat,
				incidentLng: s.incidentLng,
				incidentAddressGuess: s.incidentAddressGuess,
				incidentLocationSource: s.incidentLocationSource,
				etaSeconds: s.etaSeconds,
				dispatchMode: s.dispatchMode,
				vetoDeadline: s.vetoDeadline,
				assignedAmbulanceId: s.assignedAmbulanceId,
				assignedHospitalId: s.assignedHospitalId,
				assignedDoctorId: s.assignedDoctorId,
				doctorAssignedBy: s.doctorAssignedBy,
				assignedBedConfirmed: s.assignedBedConfirmed ?? false,
				bedConfirmedAt: s.bedConfirmedAt,
				endRequestedReason: s.endRequestedReason,
				endRequestedBy: s.endRequestedBy,
				endRequestedAt: s.endRequestedAt,
			},

			// Triage: everyone except the traffic officer. Reasoning and rule hits are clinical-only.
			triage: isOutpost
				? null
				: {
						ai: s.aiTriageColor,
						final: s.finalTriageColor,
						setBy: s.triageSetBy,
						overridden: s.triageOverriddenByErHead ?? false,
						updatedAt: s.triageUpdatedAt,
						aiReasoning: clinical ? s.aiTriageReasoning : undefined,
						redFlags: clinical ? (s.redFlagReasons ?? []) : [],
					},

			symptoms: isOutpost ? [] : (s.extractedSymptoms ?? []),
			firstAid: clinical ? (s.firstAidGiven ?? []) : [],
			transcript: clinical
				? { original: s.transcript, english: s.transcriptEnglish }
				: null,

			ambulance: ambulance
				? {
						_id: ambulance._id,
						vehicleNumber: ambulance.vehicleNumber,
						driverName: ambulance.driverName,
						helperName: ambulance.helperName,
						lat: ambulance.lat,
						lng: ambulance.lng,
						status: ambulance.status,
						equipmentLevel: ambulance.equipmentLevel,
					}
				: null,

			hospital: hospital
				? {
						_id: hospital._id,
						name: hospital.name,
						lat: hospital.lat,
						lng: hospital.lng,
						availableBeds: hospital.availableBeds,
						totalBeds: hospital.totalBeds,
						facilities: hospital.facilities,
						erHeadName: hospital.erHeadName,
					}
				: null,

			doctor:
				doctor && !isOutpost
					? { _id: doctor._id, name: doctor.name, specialty: doctor.specialty }
					: null,

			// Identity only. Allergies, conditions and records stay behind patients.getHistoryForSession.
			patient:
				patient && (clinical || isDriver)
					? {
							_id: patient._id,
							fullName: patient.fullName,
							age: patient.age,
							bloodGroup: patient.bloodGroup,
							phoneMasked: clinical ? maskPhone(patient.phone) : undefined,
						}
					: null,
			patientNameUnconfirmed:
				clinical || isDriver ? s.patientNameUnconfirmed : undefined,

			vitals:
				clinical && vitals
					? {
							heartRate: vitals.heartRate,
							systolic: vitals.bloodPressureSystolic,
							diastolic: vitals.bloodPressureDiastolic,
							spo2: vitals.spo2,
							consciousness: vitals.consciousness,
							recordedAt: vitals.recordedAt,
							recordedBy: vitals.recordedBy,
						}
					: null,

			offer: pendingOffer
				? {
						_id: pendingOffer._id,
						ambulanceId: pendingOffer.ambulanceId,
						vehicleNumber: offerAmbulance?.vehicleNumber,
						driverName: offerAmbulance?.driverName,
						offeredAt: pendingOffer.offeredAt,
						expiresAt: pendingOffer.expiresAt,
					}
				: null,
			offerStats: {
				declined: offers.filter((o) => o.status === "declined").length,
				expired: offers.filter((o) => o.status === "expired").length,
			},

			hospitalRequest: pendingRequest
				? {
						_id: pendingRequest._id,
						hospitalId: pendingRequest.hospitalId,
						hospitalName: requestHospital?.name,
						rank: pendingRequest.rank,
						score: pendingRequest.score,
						requestedAt: pendingRequest.requestedAt,
						expiresAt: pendingRequest.expiresAt,
					}
				: null,
			requestStats: {
				rejected: requests.filter((r) => r.status === "rejected").length,
				expired: requests.filter((r) => r.status === "expired").length,
			},

			route: route
				? {
						_id: route._id,
						leg: route.leg,
						status: route.status,
						source: route.source,
						totalM: route.totalM,
						traveledM: route.traveledM,
						durationS: route.durationS,
						multiplier: route.multiplier,
						junctions: route.signals.length,
					}
				: null,

			metrics: {
				callToDispatchSec: secondsBetween(s.createdAt, s.dispatchedAt),
				callToHospitalSec: secondsBetween(s.createdAt, s.hospitalSelectedAt),
				callToCloseSec: secondsBetween(s.createdAt, s.closedAt),
			},
		};
	},
});

function decimate(coords: number[][], max: number): number[][] {
	if (coords.length <= max) return coords;
	const out: number[][] = [];
	const step = (coords.length - 1) / (max - 1);
	for (let i = 0; i < max; i++) {
		const p = coords[Math.round(i * step)];
		if (p) out.push(p);
	}
	return out;
}

/** Road polylines and junction states for the map. The active leg has full detail, finished legs are thinned. */
export const getRouteForSession = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		const routes = await ctx.db
			.query("routes")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const live = routes
			.filter((r) => r.status !== "cancelled")
			.sort((a, b) => a.createdAt - b.createdAt);
		if (live.length === 0) return null;

		const legs = [];
		for (const r of live) {
			const active = r.status === "active";
			const signals = [];
			for (const sg of r.signals) {
				const doc = await ctx.db.get(sg.signalId);
				if (!doc) continue;
				signals.push({
					signalId: sg.signalId,
					posM: sg.posM,
					name: doc.name,
					lat: doc.lat,
					lng: doc.lng,
					state: doc.state,
					pendingApproval: doc.pendingApproval ?? false,
					approved: doc.policeNotified,
					approvedBy: doc.approvedBy,
				});
			}
			legs.push({
				routeId: r._id,
				leg: r.leg,
				status: r.status,
				source: r.source,
				totalM: r.totalM,
				traveledM: r.traveledM,
				durationS: r.durationS,
				multiplier: r.multiplier,
				coords: active ? r.coords : decimate(r.coords, 80),
				cumM: active ? r.cumM : [],
				signals,
			});
		}
		return {
			legs,
			activeRouteId: legs.find((l) => l.status === "active")?.routeId ?? null,
		};
	},
});

/** Fleet, hospitals and junctions for the control-room map. */
export const getFleetOverview = query({
	args: { city: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const [ambulances, hospitals, signals] = await Promise.all([
			ctx.db.query("ambulances").collect(),
			ctx.db.query("hospitals").collect(),
			ctx.db.query("signals").collect(),
		]);
		const inCity = (c: string | undefined) =>
			!args.city || !c || c === args.city;
		return {
			ambulances: ambulances
				.filter((a) => inCity(a.city))
				.map((a) => ({
					_id: a._id,
					vehicleNumber: a.vehicleNumber,
					driverName: a.driverName,
					lat: a.lat,
					lng: a.lng,
					status: a.status,
					equipmentLevel: a.equipmentLevel,
					city: a.city,
					currentSessionId: a.currentSessionId,
				})),
			hospitals: hospitals
				.filter((h) => inCity(h.city))
				.map((h) => ({
					_id: h._id,
					name: h.name,
					lat: h.lat,
					lng: h.lng,
					availableBeds: h.availableBeds,
					totalBeds: h.totalBeds,
					facilities: h.facilities,
					city: h.city,
				})),
			signals: signals
				.filter((g) => inCity(g.city))
				.map((g) => ({
					_id: g._id,
					name: g.name,
					lat: g.lat,
					lng: g.lng,
					state: g.state,
					pendingApproval: g.pendingApproval ?? false,
					activeSessionId: g.activeSessionId,
				})),
		};
	},
});

/** Live feed for the right rail. The traffic officer only sees traffic, routing and dispatch lines. */
export const getSessionFeed = query({
	args: {
		sessionId: v.id("sessions"),
		role: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = Math.min(Math.max(args.limit ?? 60, 1), 200);
		const rows = await ctx.db
			.query("sessionEvents")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("desc")
			.take(limit);
		const filtered =
			args.role === "outpost"
				? rows.filter((e) => OUTPOST_FEED_ACTORS.test(e.actor))
				: rows;
		return filtered.map((e) => ({
			_id: e._id,
			actor: e.actor,
			message: e.message,
			createdAt: e.createdAt,
		}));
	},
});

/** Transcript lines. Clinical roles only. */
export const getTranscriptFeed = query({
	args: { sessionId: v.id("sessions"), role: v.optional(v.string()) },
	handler: async (ctx, args) => {
		if (!CLINICAL_ROLES.has(args.role ?? "ero")) return [];
		const rows = await ctx.db
			.query("transcriptChunks")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("asc")
			.collect();
		return rows.map((c) => ({
			_id: c._id,
			seq: c.seq,
			text: c.text,
			translatedText: c.translatedText,
			language: c.language,
			createdAt: c.createdAt,
		}));
	},
});

/** Light list used to pick the session every screen follows. */
export const listSessionIds = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("sessions")
			.order("desc")
			.take(Math.min(Math.max(args.limit ?? 20, 1), 50));
		return rows.map((s) => ({
			_id: s._id,
			status: s.status,
			createdAt: s.createdAt,
		}));
	},
});

/** Summaries for the audit screen: AI suggestion versus the final human-approved color, and response times. */
export const listRecentSessions = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("sessions")
			.order("desc")
			.take(Math.min(Math.max(args.limit ?? 20, 1), 50));
		return await Promise.all(
			rows.map(async (s) => {
				const hospital = s.assignedHospitalId
					? await ctx.db.get(s.assignedHospitalId)
					: null;
				return {
					_id: s._id,
					status: s.status,
					city: s.city,
					language: s.language,
					createdAt: s.createdAt,
					closedAt: s.closedAt,
					closeReason: s.closeReason,
					symptoms: s.extractedSymptoms ?? [],
					aiColor: s.aiTriageColor,
					finalColor: s.finalTriageColor,
					overridden: s.triageOverriddenByErHead ?? false,
					triageSetBy: s.triageSetBy,
					hospitalName: hospital?.name,
					callToDispatchSec: secondsBetween(s.createdAt, s.dispatchedAt),
				};
			}),
		);
	},
});

/** Doctors at the hospital this session is going to (or is being pre-alerted at). */
export const getDoctorsForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return [];
    let hospitalId = s.assignedHospitalId;
    if (!hospitalId) {
      const reqs = await ctx.db
        .query("hospitalRequests")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      hospitalId = reqs.find((r) => r.status === "pending")?.hospitalId;
    }
    if (!hospitalId) return [];
    const hid = hospitalId;
    const docs = await ctx.db
      .query("doctors")
      .withIndex("by_hospital", (q) => q.eq("hospitalId", hid))
      .collect();
    return docs.map((d) => ({ _id: d._id, name: d.name, specialty: d.specialty, available: d.available }));
  },
});
