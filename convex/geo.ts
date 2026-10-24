// Pure polyline helpers. No Convex imports besides lib.
// Written so it also passes `noUncheckedIndexedAccess` (the root tsconfig sees this file through the generated api).
import { distanceKm } from "./lib";

export type LngLat = [number, number]; // GeoJSON order

function pt(coords: LngLat[], i: number): LngLat {
	return coords[i] ?? [0, 0];
}

function num(arr: number[], i: number): number {
	return arr[i] ?? 0;
}

export function cumulativeMeters(coords: LngLat[]): number[] {
	const cum: number[] = [0];
	for (let i = 1; i < coords.length; i++) {
		const [lng1, lat1] = pt(coords, i - 1);
		const [lng2, lat2] = pt(coords, i);
		cum.push(num(cum, i - 1) + distanceKm(lat1, lng1, lat2, lng2) * 1000);
	}
	return cum;
}

/** Position `m` meters along the polyline (clamped). */
export function pointAtMeters(
	coords: LngLat[],
	cum: number[],
	m: number,
): { lat: number; lng: number } {
	const total = cum[cum.length - 1] ?? 0;
	const d = Math.max(0, Math.min(m, total));
	let i = 1;
	while (i < cum.length - 1 && num(cum, i) < d) i++;
	const segLen = num(cum, i) - num(cum, i - 1);
	const t = segLen > 0 ? (d - num(cum, i - 1)) / segLen : 0;
	const [lng1, lat1] = pt(coords, i - 1);
	const [lng2, lat2] = pt(coords, i);
	return { lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t };
}

/** Closest point on the polyline to (lat,lng): meters along route + distance off route. */
export function projectOnRoute(
	coords: LngLat[],
	cum: number[],
	lat: number,
	lng: number,
): { posM: number; distM: number } {
	const kx = Math.cos((lat * Math.PI) / 180) * 111320;
	const ky = 110540;
	let best = Number.POSITIVE_INFINITY;
	let posM = 0;
	for (let i = 0; i < coords.length - 1; i++) {
		const [aLng, aLat] = pt(coords, i);
		const [bLng, bLat] = pt(coords, i + 1);
		const ax = (aLng - lng) * kx;
		const ay = (aLat - lat) * ky;
		const bx = (bLng - lng) * kx;
		const by = (bLat - lat) * ky;
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		const t =
			len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
		const d = Math.hypot(ax + t * dx, ay + t * dy);
		if (d < best) {
			best = d;
			posM = num(cum, i) + t * (num(cum, i + 1) - num(cum, i));
		}
	}
	return { posM, distM: best };
}

export function downsample(coords: LngLat[], max: number): LngLat[] {
	if (coords.length <= max) return coords;
	const out: LngLat[] = [];
	const step = (coords.length - 1) / (max - 1);
	for (let i = 0; i < max; i++) out.push(pt(coords, Math.round(i * step)));
	return out;
}

export function straightLine(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	n = 24,
): LngLat[] {
	const out: LngLat[] = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		out.push([
			fromLng + (toLng - fromLng) * t,
			fromLat + (toLat - fromLat) * t,
		]);
	}
	return out;
}
