// Road hazards (potholes) along a route.
// MOCK DATA for now: deterministic, so the same road always shows the same potholes.
// Later this file is replaced by a lookup of detections from a road-damage model
// (YOLO trained on RDD2022, class D40 = pothole), stored as lat/lng points with a severity.
import { pointAtMeters, type LngLat } from "./geo";

export type Pothole = { posM: number; lat: number; lng: number; severity: number }; // severity 1 low, 2 medium, 3 severe

const CELL_M = 120; // one chance of a pothole per 120 m of road
const CHANCE = 0.22;
const SECONDS_PER_SEVERITY = 12; // extra travel time a pothole costs (slowing down), used in the route cost

function hash(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function mockPotholes(coords: LngLat[], cum: number[]): Pothole[] {
  const total = cum[cum.length - 1] ?? 0;
  const out: Pothole[] = [];
  for (let m = CELL_M / 2; m < total; m += CELL_M) {
    const p = pointAtMeters(coords, cum, m);
    const h = hash(Math.round(p.lat * 1000), Math.round(p.lng * 1000));
    if (h >= CHANCE) continue;
    out.push({ posM: Math.round(m), lat: p.lat, lng: p.lng, severity: h < 0.07 ? 3 : h < 0.15 ? 2 : 1 });
  }
  return out;
}

/** The HazardPenalty term of the route cost, in seconds. */
export function hazardPenaltyS(potholes: Pothole[]): number {
  return potholes.reduce((sum, p) => sum + p.severity * SECONDS_PER_SEVERITY, 0);
}