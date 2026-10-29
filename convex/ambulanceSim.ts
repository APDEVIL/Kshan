import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { type LngLat, pointAtMeters } from "./geo";
import { canTransition, type SessionStatus } from "./lib";
import { releaseCorridor, updateCorridor } from "./traffic";

const TICK_MS = 1000;

/**
 * Server-side movement. Runs on the Convex scheduler, so it keeps going when
 * the browser tab is closed and cannot be double-speeded by two tabs.
 */
export const tick = internalMutation({
	args: { routeId: v.id("routes") },
	handler: async (ctx, args): Promise<void> => {
		const route = await ctx.db.get(args.routeId);
		if (!route || route.status !== "active") return;

		const session = await ctx.db.get(route.sessionId);
		const amb = await ctx.db.get(route.ambulanceId);
		if (
			!session ||
			!amb ||
			session.status === "closed" ||
			amb.currentSessionId !== route.sessionId
		) {
			await ctx.db.patch(route._id, { status: "cancelled" });
			await releaseCorridor(ctx, route.signals, route.sessionId);
			return;
		}

		const now = Date.now();
		const dt = Math.min((now - route.lastTickAt) / 1000, 5);
		const advanceM = ((route.speedKmh * route.multiplier) / 3.6) * dt;
		const traveledM = Math.min(route.totalM, route.traveledM + advanceM);
		const remainingM = route.totalM - traveledM;

		const coords = route.coords as LngLat[];
		const pos = pointAtMeters(coords, route.cumM, traveledM);
		const etaSeconds = Math.round(remainingM / (route.speedKmh / 3.6)); // real-world ETA

		await ctx.db.patch(amb._id, { lat: pos.lat, lng: pos.lng });
		await ctx.db.patch(route._id, { traveledM, lastTickAt: now });

		if (remainingM > 15) {
			await ctx.db.patch(session._id, { etaSeconds });
			await updateCorridor(ctx, route.signals, traveledM, route.sessionId);
			await ctx.scheduler.runAfter(TICK_MS, internal.ambulanceSim.tick, {
				routeId: route._id,
			});
			return;
		}

		// ---- arrived ----
		await ctx.db.patch(route._id, { status: "done" });
		await releaseCorridor(ctx, route.signals, route.sessionId);

		if (route.leg === "to_patient") {
			await ctx.db.patch(amb._id, { status: "with_patient" });
			const to: SessionStatus = "patient_picked_up";
			await ctx.db.patch(session._id, {
				etaSeconds: 0,
				...(canTransition(session.status as SessionStatus, to)
					? { status: to }
					: {}),
			});
			await ctx.db.insert("sessionEvents", {
				sessionId: session._id,
				actor: "Ambulance",
				message: `${amb.vehicleNumber} reached the patient.`,
				createdAt: now,
			});
		} else {
			await ctx.db.patch(amb._id, { status: "at_hospital" });
			const to: SessionStatus = "arrived_at_hospital";
			await ctx.db.patch(session._id, {
				etaSeconds: 0,
				...(canTransition(session.status as SessionStatus, to)
					? { status: to }
					: {}),
			});
			await ctx.db.insert("sessionEvents", {
				sessionId: session._id,
				actor: "Ambulance",
				message: `${amb.vehicleNumber} arrived at the hospital. Handover in progress.`,
				createdAt: now,
			});
			// Handover completes the session automatically.
			await ctx.scheduler.runAfter(4000, api.sessions.closeSession, {
				sessionId: session._id,
				reason: "handed_over",
				actor: "ER Handover",
				role: "system",
			});
		}
	},
});

/** Driver (or helper) taps "Depart" once the hospital has accepted. */
export const departForHospital = mutation({
	args: {
		ambulanceId: v.id("ambulances"),
		actor: v.optional(v.string()),
		role: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<void> => {
		const amb = await ctx.db.get(args.ambulanceId);
		if (!amb || !amb.currentSessionId)
			throw new Error("Ambulance not on an active session");
		const session = await ctx.db.get(amb.currentSessionId);
		if (!session) throw new Error("Session not found");
		if (amb.status !== "with_patient")
			throw new Error("Patient is not on board yet.");
		if (!session.assignedHospitalId)
			throw new Error("No hospital confirmed yet. Use 'Get hospital' first.");

		const pending = await ctx.db
			.query("hospitalRequests")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.collect();
		if (pending.some((r) => r.status === "pending")) {
			throw new Error("Waiting for the hospital to accept.");
		}

		const hospital = await ctx.db.get(session.assignedHospitalId);
		if (!hospital) throw new Error("Hospital not found");

		await ctx.db.insert("sessionEvents", {
			sessionId: session._id,
			actor: args.actor ?? amb.driverName,
			message: `${amb.vehicleNumber} departing for ${hospital.name} with patient on board.`,
			createdAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.routing.planRoute, {
			sessionId: session._id,
			ambulanceId: amb._id,
			leg: "to_hospital",
			fromLat: amb.lat,
			fromLng: amb.lng,
			toLat: hospital.lat,
			toLng: hospital.lng,
		});
	},
});

/** ERO changes how fast the demo runs (1 = real time). Remembered on the ambulance for later legs. */
export const setSimSpeed = mutation({
  args: { ambulanceId: v.id("ambulances"), multiplier: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const m = Math.max(1, Math.min(30, args.multiplier));
    // remember the choice on the ambulance, so it also applies to the next leg and after the mission ends
    await ctx.db.patch(args.ambulanceId, { simMultiplier: m });
    const routes = await ctx.db
      .query("routes")
      .withIndex("by_ambulance_status", (q) => q.eq("ambulanceId", args.ambulanceId).eq("status", "active"))
      .collect();
    for (const r of routes) await ctx.db.patch(r._id, { multiplier: m });
  },
});

/** DEPRECATED: movement is server-side now. Kept so the old UI compiles. */
export const tickAmbulance = mutation({
	args: { ambulanceId: v.id("ambulances") },
	handler: async () => null,
});

/** Legacy: frees an ambulance immediately. Prefer sessions.markAmbulanceFree. */
export const releaseAmbulance = mutation({
	args: { ambulanceId: v.id("ambulances") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.ambulanceId, {
			status: "idle",
			currentSessionId: undefined,
		});
	},
});
