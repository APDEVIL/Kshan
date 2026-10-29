import { internalMutation, mutation, query } from "./_generated/server";
import type { DatabaseReader, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  assertCan,
  canTransition,
  distanceKm,
  estimateEtaSeconds,
  requiredFacilitiesFor,
  scoreHospital,
  type Color,
  type SessionStatus,
} from "./lib";
import { writeAudit } from "./audit";

const VETO_MS = 10_000; // ERO window to cancel an auto-dispatch
const OFFER_MS = 30_000; // driver must accept within 30 s
const HOSPITAL_MS = 20_000; // ER head must accept within 20 s

/* ================================================================== */
/* helpers                                                             */
/* ================================================================== */

async function evt(ctx: MutationCtx, sessionId: Id<"sessions">, actor: string, message: string): Promise<void> {
  await ctx.db.insert("sessionEvents", { sessionId, actor, message, createdAt: Date.now() });
}

async function moveStatus(ctx: MutationCtx, sessionId: Id<"sessions">, to: SessionStatus): Promise<void> {
  const s = await ctx.db.get(sessionId);
  if (!s || s.status === to) return;
  if (canTransition(s.status as SessionStatus, to)) await ctx.db.patch(sessionId, { status: to });
}

/* ---------------- ambulance selection ---------------- */

/**
 * How well an ambulance fits this emergency. Lower score is better.
 * RED (or not known yet): an ALS unit is needed, a BLS unit is a last resort.
 * YELLOW: ALS slightly preferred. GREEN: keep ALS free for the serious calls.
 */
function ambulanceFit(
  color: Color | undefined,
  amb: Doc<"ambulances">,
  km: number,
): { score: number; reason: string } {
  const als = amb.equipmentLevel === "advanced";
  const needAls = color === "red" || color === undefined; // unsure -> send ALS
  let score = km;
  let reason: string;
  if (needAls) {
    if (!als) score += 100;
    reason = als ? "ALS unit for a RED case" : "BLS only, no ALS free";
  } else if (color === "yellow") {
    if (als) score -= 1;
    reason = als ? "ALS preferred for YELLOW" : "BLS is enough for YELLOW";
  } else {
    if (als) score += 3;
    reason = als ? "ALS kept free, BLS is enough for GREEN" : "BLS is enough for GREEN";
  }
  return { score, reason };
}

async function pickAmbulance(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  excluded: Set<string>,
): Promise<{ amb: Doc<"ambulances">; km: number } | null> {
  const idle = await ctx.db
    .query("ambulances")
    .withIndex("by_status", (q) => q.eq("status", "idle"))
    .collect();
  const pool = idle.filter(
    (a) => !excluded.has(a._id) && (!session.city || !a.city || a.city === session.city),
  );
  const color = (session.finalTriageColor ?? session.aiTriageColor) as Color | undefined;
  let best: { amb: Doc<"ambulances">; km: number; score: number } | null = null;
  for (const a of pool) {
    const km = distanceKm(session.incidentLat, session.incidentLng, a.lat, a.lng);
    const { score } = ambulanceFit(color, a, km);
    if (!best || score < best.score) best = { amb: a, km, score };
  }
  return best ? { amb: best.amb, km: best.km } : null;
}

async function offerToAmbulance(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  amb: Doc<"ambulances">,
  km: number,
  actor: string,
): Promise<void> {
  const now = Date.now();
  const offerId = await ctx.db.insert("dispatchOffers", {
    sessionId: session._id,
    ambulanceId: amb._id,
    status: "pending",
    offeredAt: now,
    expiresAt: now + OFFER_MS,
  });
  await ctx.db.patch(amb._id, { status: "offered", currentSessionId: session._id });
  await evt(
    ctx,
    session._id,
    actor,
    `Job offered to ${amb.vehicleNumber} (${amb.driverName}, ${amb.equipmentLevel === "advanced" ? "ALS" : "BLS"}), ${km.toFixed(1)} km away, ETA ~${Math.max(1, Math.round(estimateEtaSeconds(km) / 60))} min. Waiting for driver (30 s).`,
  );
  await ctx.scheduler.runAfter(OFFER_MS, internal.dispatch.expireOffer, { offerId });
}

/** Offer the job to the next-best ambulance that has not already declined / timed out. */
async function tryNextAmbulance(ctx: MutationCtx, sessionId: Id<"sessions">, actor: string): Promise<boolean> {
  const s = await ctx.db.get(sessionId);
  if (!s || s.assignedAmbulanceId || s.status === "closed") return false;

  const offers = await ctx.db
    .query("dispatchOffers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  if (offers.some((o) => o.status === "pending")) return true;

  const excluded = new Set<string>(
    offers.filter((o) => o.status === "declined" || o.status === "expired").map((o) => o.ambulanceId),
  );
  const pick = await pickAmbulance(ctx, s, excluded);
  if (!pick) {
    await evt(ctx, sessionId, "Dispatch Agent", "No free ambulance available. ERO: please assign one manually.");
    return false;
  }
  await moveStatus(ctx, sessionId, "awaiting_dispatch_approval");
  await offerToAmbulance(ctx, s, pick.amb, pick.km, actor);
  return true;
}

/* ---------------- hospital ranking ---------------- */

async function rankHospitalsImpl(db: DatabaseReader, s: Doc<"sessions">) {
  const required = requiredFacilitiesFor(s.extractedSymptoms ?? []);
  const color = (s.finalTriageColor ?? s.aiTriageColor ?? "yellow") as Color;

  // Distance from where the patient will be, not always the incident.
  let oLat = s.incidentLat;
  let oLng = s.incidentLng;
  const carrying: SessionStatus[] = ["patient_picked_up", "awaiting_hospital_accept", "en_route_to_hospital"];
  if (carrying.includes(s.status as SessionStatus) && s.assignedAmbulanceId) {
    const a = await db.get(s.assignedAmbulanceId);
    if (a) {
      oLat = a.lat;
      oLng = a.lng;
    }
  }

  const requests = await db
    .query("hospitalRequests")
    .withIndex("by_session", (q) => q.eq("sessionId", s._id))
    .collect();
  const excluded = new Set<string>(
    requests.filter((r) => r.status === "rejected" || r.status === "expired").map((r) => r.hospitalId),
  );

  const all = await db.query("hospitals").collect();
  return all
    .filter((h) => (!s.city || !h.city || h.city === s.city) && h.acceptingEmergencies !== false)
    .map((h) => {
      const km = distanceKm(oLat, oLng, h.lat, h.lng);
      const sc = scoreHospital({
        required,
        facilities: h.facilities,
        availableBeds: h.availableBeds,
        distKm: km,
        color,
      });
      return { hospital: h, distKm: Number(km.toFixed(1)), required, color, excluded: excluded.has(h._id), ...sc };
    })
    .sort((a, b) => b.score - a.score);
}

const SPECIALTY_HINTS: Record<string, string[]> = {
  cardiac: ["cardio"],
  neuro: ["neuro"],
  trauma: ["trauma", "emergency", "surgery"],
  orthopedic: ["ortho"],
  burns_unit: ["burn"],
  maternity: ["obst", "gyn", "matern"],
  icu: ["emergency", "critical", "intens"],
  antivenom: ["toxic", "emergency"],
  blood_bank: ["surgery", "emergency"],
  ventilator: ["emergency", "critical"],
};

/** Deterministic doctor recommendation. The ER head can change it. */
async function recommendDoctor(
  ctx: MutationCtx,
  hospitalId: Id<"hospitals">,
  required: string[],
): Promise<Id<"doctors"> | undefined> {
  const docs = (
    await ctx.db
      .query("doctors")
      .withIndex("by_hospital", (q) => q.eq("hospitalId", hospitalId))
      .collect()
  ).filter((d) => d.available);
  for (const f of required) {
    for (const hint of SPECIALTY_HINTS[f] ?? []) {
      const m = docs.find((d) => d.specialty.toLowerCase().includes(hint));
      if (m) return m._id;
    }
  }
  return docs[0]?._id;
}

async function releaseReservedBed(ctx: MutationCtx, s: Doc<"sessions">): Promise<void> {
  if (!s.bedReservedHospitalId) return;
  const h = await ctx.db.get(s.bedReservedHospitalId);
  if (h) await ctx.db.patch(h._id, { availableBeds: Math.min(h.totalBeds, h.availableBeds + 1) });
}

/** If we were waiting on a hospital but none is left, put the status back. */
async function settleHospitalStatus(ctx: MutationCtx, sessionId: Id<"sessions">): Promise<void> {
  const s = await ctx.db.get(sessionId);
  if (!s || s.status !== "awaiting_hospital_accept") return;
  const amb = s.assignedAmbulanceId ? await ctx.db.get(s.assignedAmbulanceId) : null;
  await moveStatus(ctx, sessionId, amb?.status === "en_route_to_hospital" ? "en_route_to_hospital" : "patient_picked_up");
}

async function offerNextHospital(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  actor: string,
  forcedHospitalId?: Id<"hospitals">,
): Promise<boolean> {
  const s = await ctx.db.get(sessionId);
  if (!s || s.status === "closed") return false;

  // Cancel an older pending request.
  const existing = await ctx.db
    .query("hospitalRequests")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const r of existing.filter((x) => x.status === "pending")) {
    await ctx.db.patch(r._id, { status: "cancelled" });
  }

  const ranked = await rankHospitalsImpl(ctx.db, s);
  const eligible = ranked.filter((r) => r.score > -1000);
  const pick = forcedHospitalId
    ? eligible.find((r) => r.hospital._id === forcedHospitalId)
    : eligible.find((r) => !r.excluded);

  if (!pick) {
    await evt(ctx, sessionId, "Dispatch Agent", "No hospital left to try. ERO: please choose one manually.");
    await settleHospitalStatus(ctx, sessionId);
    return false;
  }

  const now = Date.now();
  const rank = eligible.indexOf(pick) + 1;
  const requestId = await ctx.db.insert("hospitalRequests", {
    sessionId,
    hospitalId: pick.hospital._id,
    rank,
    score: pick.score,
    status: "pending",
    requestedAt: now,
    expiresAt: now + HOSPITAL_MS,
  });

  await evt(
    ctx,
    sessionId,
    actor,
    `Pre-alert sent to ${pick.hospital.name} (rank ${rank}, ${pick.matched}/${pick.required.length} facilities, ${pick.distKm} km, ${pick.hospital.availableBeds} beds). Waiting for ER head (20 s).`,
  );

  if (s.status === "patient_picked_up" || s.status === "en_route_to_hospital") {
    await moveStatus(ctx, sessionId, "awaiting_hospital_accept");
  }
  await ctx.scheduler.runAfter(HOSPITAL_MS, internal.dispatch.expireHospitalRequest, { requestId });
  return true;
}

/* ================================================================== */
/* dispatch mutations                                                  */
/* ================================================================== */

/** Start dispatch in parallel with triage. Auto mode gives the ERO 10 s to veto. */
export const requestDispatch = mutation({
  args: {
    sessionId: v.id("sessions"),
    mode: v.union(v.literal("auto"), v.literal("manual")),
    actor: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    assertCan(args.role, "override_dispatch");
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Session not found");
    if (s.assignedAmbulanceId) throw new Error("An ambulance is already assigned.");
    // Repeated intake runs must not restart a countdown that is already running.
    if (args.mode === "auto" && s.vetoDeadline !== undefined) return;

    await moveStatus(ctx, args.sessionId, "awaiting_dispatch_approval");

    if (args.mode === "auto") {
      await ctx.db.patch(args.sessionId, { dispatchMode: "auto", vetoDeadline: Date.now() + VETO_MS });
      await evt(ctx, args.sessionId, "Dispatch Agent", "Auto-dispatch starts in 10 s unless the ERO vetoes.");
      await ctx.scheduler.runAfter(VETO_MS + 200, internal.dispatch.executeAutoDispatch, {
        sessionId: args.sessionId,
      });
    } else {
      await ctx.db.patch(args.sessionId, { dispatchMode: "manual", vetoDeadline: undefined });
      await evt(ctx, args.sessionId, "Dispatch Agent", "Waiting for ERO to approve dispatch.");
    }
    await writeAudit(ctx, {
      sessionId: args.sessionId,
      actor: args.actor,
      role: args.role,
      action: "request_dispatch",
      newValue: args.mode,
    });
  },
});

export const vetoAutoDispatch = mutation({
  args: { sessionId: v.id("sessions"), actor: v.string(), role: v.string() },
  handler: async (ctx, args): Promise<void> => {
    assertCan(args.role, "override_dispatch");
    await ctx.db.patch(args.sessionId, { vetoDeadline: undefined, dispatchMode: "manual" });
    await evt(ctx, args.sessionId, args.actor, "ERO vetoed auto-dispatch. Manual approval required.");
    await writeAudit(ctx, {
      sessionId: args.sessionId,
      actor: args.actor,
      role: args.role,
      action: "veto_dispatch",
    });
  },
});

export const executeAutoDispatch = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<void> => {
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.status !== "awaiting_dispatch_approval" || s.vetoDeadline === undefined || s.assignedAmbulanceId) {
      return; // vetoed, already dispatched, or session ended
    }
    await ctx.db.patch(args.sessionId, { vetoDeadline: undefined });
    await tryNextAmbulance(ctx, args.sessionId, "Dispatch Agent");
  },
});

/** ERO approves now, optionally choosing the ambulance. */
async function dispatchNowImpl(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  ambulanceId: Id<"ambulances"> | undefined,
  actor: string,
  role: string,
): Promise<void> {
  assertCan(role, "override_dispatch");
  const s = await ctx.db.get(sessionId);
  if (!s) throw new Error("Session not found");
  if (s.assignedAmbulanceId) throw new Error("An ambulance is already assigned.");

  await ctx.db.patch(sessionId, { vetoDeadline: undefined });
  await moveStatus(ctx, sessionId, "awaiting_dispatch_approval");

  if (ambulanceId) {
    const amb = await ctx.db.get(ambulanceId);
    if (!amb || amb.status !== "idle") throw new Error("That ambulance is not free.");
    const km = distanceKm(s.incidentLat, s.incidentLng, amb.lat, amb.lng);
    // cancel any other pending offer for this session
    const offers = await ctx.db
      .query("dispatchOffers")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const o of offers.filter((x) => x.status === "pending")) {
      await ctx.db.patch(o._id, { status: "cancelled" });
      await ctx.db.patch(o.ambulanceId, { status: "idle", currentSessionId: undefined });
    }
    await offerToAmbulance(ctx, s, amb, km, actor);
  } else {
    await tryNextAmbulance(ctx, sessionId, actor);
  }
  await writeAudit(ctx, {
    sessionId,
    actor,
    role,
    action: "dispatch_now",
    newValue: ambulanceId ?? "auto-pick",
  });
}

export const dispatchNow = mutation({
  args: {
    sessionId: v.id("sessions"),
    ambulanceId: v.optional(v.id("ambulances")),
    actor: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await dispatchNowImpl(ctx, args.sessionId, args.ambulanceId, args.actor, args.role);
  },
});

/** Driver accepts / declines the job. */
export const respondToOffer = mutation({
  args: {
    offerId: v.id("dispatchOffers"),
    accept: v.boolean(),
    declineReason: v.optional(v.string()),
    actor: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!["driver", "ero", "system"].includes(args.role)) {
      throw new Error(`Role "${args.role}" cannot answer a dispatch offer.`);
    }
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.status !== "pending") throw new Error("This offer is no longer active.");
    const amb = await ctx.db.get(offer.ambulanceId);
    const s = await ctx.db.get(offer.sessionId);
    if (!amb || !s) throw new Error("Offer data missing.");
    const now = Date.now();

    if (args.accept) {
      await ctx.db.patch(offer._id, { status: "accepted", respondedAt: now });
      await ctx.db.patch(amb._id, { status: "dispatched", currentSessionId: s._id });
      await ctx.db.patch(s._id, { assignedAmbulanceId: amb._id, dispatchedAt: now, vetoDeadline: undefined });
      await moveStatus(ctx, s._id, "ambulance_dispatched");
      await evt(
        ctx,
        s._id,
        amb.driverName,
        `${amb.vehicleNumber} accepted the job. Call to dispatch: ${((now - s.createdAt) / 1000).toFixed(1)} s.`,
      );
      await writeAudit(ctx, {
        sessionId: s._id,
        actor: args.actor,
        role: args.role,
        action: "accept_offer",
        newValue: amb.vehicleNumber,
      });
      await ctx.scheduler.runAfter(0, internal.routing.planRoute, {
        sessionId: s._id,
        ambulanceId: amb._id,
        leg: "to_patient",
        fromLat: amb.lat,
        fromLng: amb.lng,
        toLat: s.incidentLat,
        toLng: s.incidentLng,
      });
    } else {
      await ctx.db.patch(offer._id, {
        status: "declined",
        declineReason: args.declineReason ?? "no reason given",
        respondedAt: now,
      });
      await ctx.db.patch(amb._id, { status: "idle", currentSessionId: undefined });
      await evt(
        ctx,
        s._id,
        amb.driverName,
        `${amb.vehicleNumber} declined (${args.declineReason ?? "no reason"}). Trying the next ambulance.`,
      );
      await writeAudit(ctx, {
        sessionId: s._id,
        actor: args.actor,
        role: args.role,
        action: "decline_offer",
        newValue: args.declineReason ?? "no reason",
      });
      await tryNextAmbulance(ctx, s._id, "Dispatch Agent");
    }
  },
});

export const expireOffer = internalMutation({
  args: { offerId: v.id("dispatchOffers") },
  handler: async (ctx, args): Promise<void> => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.status !== "pending") return;
    await ctx.db.patch(offer._id, { status: "expired", respondedAt: Date.now() });
    const amb = await ctx.db.get(offer.ambulanceId);
    if (amb && amb.status === "offered") {
      await ctx.db.patch(amb._id, { status: "idle", currentSessionId: undefined });
    }
    await evt(
      ctx,
      offer.sessionId,
      "Dispatch Agent",
      `${amb?.vehicleNumber ?? "Ambulance"} did not respond in 30 s. Trying the next ambulance.`,
    );
    await tryNextAmbulance(ctx, offer.sessionId, "Dispatch Agent");
  },
});

/* ================================================================== */
/* hospital mutations                                                  */
/* ================================================================== */

/** Ranked hospitals for the UI (score, facilities matched, ETA, why). */
export const rankHospitals = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return [];
    const ranked = await rankHospitalsImpl(ctx.db, s);
    return ranked.slice(0, 6).map((r) => ({
      hospitalId: r.hospital._id,
      name: r.hospital.name,
      score: r.score,
      matched: r.matched,
      required: r.required,
      fullMatch: r.fullMatch,
      distKm: r.distKm,
      etaMin: r.etaMin,
      availableBeds: r.hospital.availableBeds,
      excluded: r.excluded,
      color: r.color,
    }));
  },
});

/** Pre-alert the best hospital (or a specific one chosen by a human). */
export const requestHospital = mutation({
  args: {
    sessionId: v.id("sessions"),
    hospitalId: v.optional(v.id("hospitals")),
    actor: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    assertCan(args.role, "choose_hospital");
    await offerNextHospital(ctx, args.sessionId, args.actor, args.hospitalId);
    await writeAudit(ctx, {
      sessionId: args.sessionId,
      actor: args.actor,
      role: args.role,
      action: "request_hospital",
      newValue: args.hospitalId ?? "top-ranked",
    });
  },
});

/** ER head accepts or rejects the pre-alert. Accepting reserves the bed. */
export const respondHospitalRequest = mutation({
  args: {
    requestId: v.id("hospitalRequests"),
    accept: v.boolean(),
    rejectReason: v.optional(v.string()),
    actor: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    assertCan(args.role, "confirm_bed");
    const req = await ctx.db.get(args.requestId);
    if (!req || req.status !== "pending") throw new Error("This request is no longer active.");
    const s = await ctx.db.get(req.sessionId);
    const h = await ctx.db.get(req.hospitalId);
    if (!s || !h) throw new Error("Request data missing.");
    const now = Date.now();

    if (args.accept) {
      if (h.availableBeds <= 0 && s.bedReservedHospitalId !== h._id) {
        throw new Error("No bed available. Reject the request instead.");
      }
      const alreadyHere = s.bedReservedHospitalId === h._id;
      if (!alreadyHere) {
        await releaseReservedBed(ctx, s);
        await ctx.db.patch(h._id, { availableBeds: h.availableBeds - 1 });
      }

      const required = requiredFacilitiesFor(s.extractedSymptoms ?? []);
      const doctorId = s.doctorAssignedBy ? undefined : await recommendDoctor(ctx, h._id, required);
      const hospitalChanged = s.assignedHospitalId !== h._id;

      await ctx.db.patch(req._id, { status: "accepted", respondedAt: now });
      await ctx.db.patch(s._id, {
        assignedHospitalId: h._id,
        bedReservedHospitalId: h._id,
        assignedBedConfirmed: true,
        bedConfirmedAt: now,
        hospitalSelectedAt: s.hospitalSelectedAt ?? now,
        ...(doctorId ? { assignedDoctorId: doctorId } : {}),
      });
      await evt(
        ctx,
        s._id,
        args.actor,
        `${h.name} accepted. Bed reserved${doctorId ? ", doctor recommended (ER head can change)" : ""}.`,
      );
      await writeAudit(ctx, {
        sessionId: s._id,
        actor: args.actor,
        role: args.role,
        action: "accept_hospital",
        newValue: h.name,
      });

      await settleHospitalStatus(ctx, s._id);

      // Hospital changed while already driving: replan from the current position.
      const amb = s.assignedAmbulanceId ? await ctx.db.get(s.assignedAmbulanceId) : null;
      if (amb && amb.status === "en_route_to_hospital" && hospitalChanged) {
        await ctx.scheduler.runAfter(0, internal.routing.planRoute, {
          sessionId: s._id,
          ambulanceId: amb._id,
          leg: "to_hospital",
          fromLat: amb.lat,
          fromLng: amb.lng,
          toLat: h.lat,
          toLng: h.lng,
        });
      }
    } else {
      await ctx.db.patch(req._id, {
        status: "rejected",
        rejectReason: args.rejectReason ?? "no reason given",
        respondedAt: now,
      });
      await evt(
        ctx,
        s._id,
        args.actor,
        `${h.name} rejected (${args.rejectReason ?? "no reason"}). Trying the next hospital.`,
      );
      await writeAudit(ctx, {
        sessionId: s._id,
        actor: args.actor,
        role: args.role,
        action: "reject_hospital",
        newValue: `${h.name}: ${args.rejectReason ?? "no reason"}`,
      });
      await offerNextHospital(ctx, s._id, "Dispatch Agent");
    }
  },
});

export const expireHospitalRequest = internalMutation({
  args: { requestId: v.id("hospitalRequests") },
  handler: async (ctx, args): Promise<void> => {
    const req = await ctx.db.get(args.requestId);
    if (!req || req.status !== "pending") return;
    await ctx.db.patch(req._id, { status: "expired", respondedAt: Date.now() });
    const h = await ctx.db.get(req.hospitalId);
    await evt(
      ctx,
      req.sessionId,
      "Dispatch Agent",
      `${h?.name ?? "Hospital"} did not respond in 20 s. Trying the next hospital.`,
    );
    await offerNextHospital(ctx, req.sessionId, "Dispatch Agent");
  },
});

/* ================================================================== */
/* queries for the UI                                                  */
/* ================================================================== */

/** Free ambulances ranked for this emergency, with the best fit first. The ERO picks from this list. */
export const recommendAmbulances = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return [];
    const idle = await ctx.db
      .query("ambulances")
      .withIndex("by_status", (q) => q.eq("status", "idle"))
      .collect();
    const color = (s.finalTriageColor ?? s.aiTriageColor) as Color | undefined;
    const rows = idle
      .filter((a) => !s.city || !a.city || a.city === s.city)
      .map((a) => {
        const km = distanceKm(s.incidentLat, s.incidentLng, a.lat, a.lng);
        const fit = ambulanceFit(color, a, km);
        return {
          ambulanceId: a._id,
          vehicleNumber: a.vehicleNumber,
          driverName: a.driverName,
          type: a.equipmentLevel === "advanced" ? ("ALS" as const) : ("BLS" as const),
          distKm: Number(km.toFixed(1)),
          etaMin: Math.max(1, Math.round(estimateEtaSeconds(km) / 60)),
          reason: fit.reason,
          score: fit.score,
        };
      })
      .sort((a, b) => a.score - b.score);
    return rows.slice(0, 5).map((r, i) => ({ ...r, recommended: i === 0 }));
  },
});

export const getSessionOffers = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("dispatchOffers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect(),
});

export const getSessionHospitalRequests = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("hospitalRequests")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect(),
});

/** Driver screen: is there a job waiting for me? */
export const getPendingOfferForAmbulance = query({
  args: { ambulanceId: v.id("ambulances") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("dispatchOffers")
      .withIndex("by_ambulance_status", (q) => q.eq("ambulanceId", args.ambulanceId).eq("status", "pending"))
      .first(),
});

/** ER head screen: incoming pre-alerts for my hospital. */
export const getPendingRequestsForHospital = query({
  args: { hospitalId: v.id("hospitals") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("hospitalRequests")
      .withIndex("by_hospital_status", (q) => q.eq("hospitalId", args.hospitalId).eq("status", "pending"))
      .collect(),
});

/* ================================================================== */
/* DEPRECATED wrappers so the old UI still compiles                    */
/* ================================================================== */

export const dispatchNearestAmbulance = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<{ offered: boolean }> => {
    await dispatchNowImpl(ctx, args.sessionId, undefined, "Dispatcher", "ero");
    return { offered: true };
  },
});

export const assignBestHospital = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<{ requested: boolean }> => {
    const ok = await offerNextHospital(ctx, args.sessionId, "Dispatcher");
    return { requested: ok };
  },
});