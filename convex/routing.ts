import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { canTransition, distanceKm, type SessionStatus } from "./lib";
import { cumulativeMeters, downsample, projectOnRoute, straightLine, type LngLat } from "./geo";
import { prepareCorridor, releaseCorridor, type RouteSignal } from "./traffic";
import { hazardPenaltyS, mockPotholes } from "./hazards";

const SPEED_KMH = 40; // ambulance with siren, urban
export const DEMO_SPEED_MULTIPLIER = 8; // demo runs 8x faster than real time
const SIGNAL_MATCH_M = 300; // junction counts as "on route" within 300 m

const legValidator = v.union(v.literal("to_patient"), v.literal("to_hospital"));

/** Traffic signals along the route from OpenStreetMap (free Overpass API). Best effort. */
async function fetchSignalsAlongRoute(coords: LngLat[]): Promise<{ lat: number; lng: number; name: string }[]> {
  const cum = cumulativeMeters(coords);
  const pts = downsample(coords, 80)
    .map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`)
    .join(",");
  const query = `[out:json][timeout:10];node["highway"="traffic_signals"](around:40,${pts});out body 200;`;

  type OverpassResponse = { elements?: { lat: number; lon: number; tags?: Record<string, string> }[] };
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  // Ask all mirrors at once and use the first good answer, so a blocked server never delays the ambulance.
  const ask = async (url: string): Promise<OverpassResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`Overpass ${url}: HTTP ${r.status}`);
      return (await r.json()) as OverpassResponse;
    } finally {
      clearTimeout(timer);
    }
  };
  let data: OverpassResponse;
  try {
    data = await Promise.any(endpoints.map(ask));
  } catch {
    return [];
  }
  const hits = (data.elements ?? [])
    .map((el) => ({ el, ...projectOnRoute(coords, cum, el.lat, el.lon) }))
    .filter((h) => h.distM <= 50)
    .sort((a, b) => a.posM - b.posM);

  // OSM often has one node per approach arm, so merge nodes closer than 60 m along the route.
  const out: { lat: number; lng: number; name: string }[] = [];
  let lastPos = -1e9;
  for (const h of hits) {
    if (h.posM - lastPos < 60) continue;
    lastPos = h.posM;
    out.push({
      lat: h.el.lat,
      lng: h.el.lon,
      name: h.el.tags?.name ?? h.el.tags?.["name:en"] ?? `Signal ${h.el.lat.toFixed(4)}, ${h.el.lon.toFixed(4)}`,
    });
  }
  return out.slice(0, 25);
}

/** Fetch an OSRM road route (free public server). Falls back to a straight line. */
export const planRoute = internalAction({
  args: {
    sessionId: v.id("sessions"),
    ambulanceId: v.id("ambulances"),
    leg: legValidator,
    fromLat: v.number(),
    fromLng: v.number(),
    toLat: v.number(),
    toLng: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    let coords: LngLat[] = [];
    let distanceM = 0;
    let durationS = 0;
    let source: "osrm" | "fallback" = "fallback";

    try {
      // Ask for alternative roads, then choose by: cost = travel time + hazard penalty (potholes).
      const url = `https://router.project-osrm.org/route/v1/driving/${args.fromLng},${args.fromLat};${args.toLng},${args.toLat}?overview=full&geometries=geojson&alternatives=true`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as {
          routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[];
        };
        let bestCost = Number.POSITIVE_INFINITY;
        for (const r of (data.routes ?? []).slice(0, 3)) {
          if (r.geometry.coordinates.length < 2) continue;
          const c = downsample(r.geometry.coordinates, 400);
          const cost = r.duration + hazardPenaltyS(mockPotholes(c, cumulativeMeters(c)));
          if (cost < bestCost) {
            bestCost = cost;
            coords = c;
            distanceM = r.distance;
            durationS = r.duration;
            source = "osrm";
          }
        }
      }
    } catch (err) {
      console.error("OSRM failed, using straight-line fallback:", err);
    }

    if (coords.length < 2) {
      coords = straightLine(args.fromLat, args.fromLng, args.toLat, args.toLng);
    }

    // Junctions on the real road path (best effort, falls back to seeded junctions).
    let osmSignals: { lat: number; lng: number; name: string }[] = [];
    if (source === "osrm") {
      try {
        osmSignals = await fetchSignalsAlongRoute(coords);
      } catch (err) {
        console.error("Overpass failed, using seeded signals only:", err);
      }
    }

    await ctx.runMutation(internal.routing.saveRoute, {
      sessionId: args.sessionId,
      ambulanceId: args.ambulanceId,
      leg: args.leg,
      coords,
      distanceM,
      durationS,
      source,
      osmSignals,
      hazards: mockPotholes(coords, cumulativeMeters(coords)),
    });
  },
});

export const saveRoute = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    ambulanceId: v.id("ambulances"),
    leg: legValidator,
    coords: v.array(v.array(v.number())),
    distanceM: v.number(),
    durationS: v.number(),
    source: v.union(v.literal("osrm"), v.literal("fallback")),
    osmSignals: v.optional(v.array(v.object({ lat: v.number(), lng: v.number(), name: v.string() }))),
    hazards: v.optional(
      v.array(v.object({ posM: v.number(), lat: v.number(), lng: v.number(), severity: v.number() })),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const session = await ctx.db.get(args.sessionId);
    const amb = await ctx.db.get(args.ambulanceId);
    if (!session || !amb || session.status === "closed") return;

    // Replace any older active route for this ambulance (reroute or next leg).
    const old = await ctx.db
      .query("routes")
      .withIndex("by_ambulance_status", (q) => q.eq("ambulanceId", args.ambulanceId).eq("status", "active"))
      .collect();
    for (const r of old) {
      await ctx.db.patch(r._id, { status: "cancelled" });
      await releaseCorridor(ctx, r.signals, r.sessionId);
    }

    const coords = args.coords as LngLat[];
    const cum = cumulativeMeters(coords);
    const totalM = cum[cum.length - 1] ?? 0;

    // Add OSM junctions we have not seen before (skip anything within 30 m of a known one).
    const known = await ctx.db.query("signals").collect();
    for (const o of args.osmSignals ?? []) {
      if (known.some((s) => distanceKm(s.lat, s.lng, o.lat, o.lng) < 0.03)) continue;
      await ctx.db.insert("signals", {
        name: o.name,
        lat: o.lat,
        lng: o.lng,
        city: session.city,
        state: "red",
        policeNotified: false,
      });
    }

    // Junctions on this route, in travel order.
    const allSignals = await ctx.db.query("signals").collect();
    const onRoute: RouteSignal[] = [];
    for (const s of allSignals) {
      if (session.city && s.city && s.city !== session.city) continue;
      if (s.activeSessionId && s.activeSessionId !== args.sessionId) continue;
      const p = projectOnRoute(coords, cum, s.lat, s.lng);
      if (p.distM <= SIGNAL_MATCH_M) onRoute.push({ signalId: s._id, posM: p.posM });
    }
    onRoute.sort((a, b) => a.posM - b.posM);

    const now = Date.now();
    const routeId = await ctx.db.insert("routes", {
      sessionId: args.sessionId,
      ambulanceId: args.ambulanceId,
      leg: args.leg,
      coords,
      cumM: cum,
      totalM,
      traveledM: 0,
      durationS: args.durationS,
      speedKmh: SPEED_KMH,
      multiplier: amb.simMultiplier ?? DEMO_SPEED_MULTIPLIER,
      lastTickAt: now,
      status: "active",
      source: args.source,
      signals: onRoute,
      hazards: args.hazards ?? [],
      createdAt: now,
    });

    await ctx.db.patch(args.ambulanceId, {
      status: args.leg === "to_patient" ? "en_route_to_patient" : "en_route_to_hospital",
    });

    const target: SessionStatus = args.leg === "to_patient" ? "ambulance_en_route_to_patient" : "en_route_to_hospital";
    const etaSeconds = Math.round(totalM / (SPEED_KMH / 3.6));
    const patch: { etaSeconds: number; status?: SessionStatus } = { etaSeconds };
    if (canTransition(session.status as SessionStatus, target)) patch.status = target;
    await ctx.db.patch(args.sessionId, patch);

    await ctx.db.insert("sessionEvents", {
      sessionId: args.sessionId,
      actor: "Routing Agent",
      message: `Route ${args.leg === "to_patient" ? "to patient" : "to hospital"}: ${(totalM / 1000).toFixed(1)} km, ETA ~${Math.max(1, Math.round(etaSeconds / 60))} min (${args.source === "osrm" ? "road route" : "straight-line fallback"}). ${(args.hazards ?? []).length} potholes on this road (simulated data).`,
      createdAt: now,
    });

    await prepareCorridor(ctx, args.sessionId, onRoute);
    await ctx.scheduler.runAfter(1000, internal.ambulanceSim.tick, { routeId });
  },
});