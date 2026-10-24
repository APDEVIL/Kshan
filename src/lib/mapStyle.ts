// Map configuration. OpenFreeMap needs no API key, but the map needs internet at the demo.
// The credit line below must stay visible on the map (OpenFreeMap / OpenMapTiles / OpenStreetMap).
import { BRAND_COLORS } from "./brand";

export type MapTheme = "light" | "dark";
export type LngLat = [number, number];
export type CityKey = "bengaluru" | "kalaburagi";

const BASE = "https://tiles.openfreemap.org/styles";

export const MAP_STYLES = {
	positron: `${BASE}/positron`,
	liberty: `${BASE}/liberty`,
	bright: `${BASE}/bright`,
	dark: `${BASE}/dark`, // listed by a third-party package, not verified. Falls back to positron.
} as const;

export const MAP_STYLE_BY_THEME: Record<MapTheme, string> = {
	light: MAP_STYLES.positron,
	dark: MAP_STYLES.dark,
};

export const MAP_FALLBACK_STYLE = MAP_STYLES.positron;

export const MAP_ATTRIBUTION =
	"© OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap";

export const MAP_COLORS = {
	ambulance: BRAND_COLORS.lime,
	incident: "#e5484d",
	hospital: "#3b82f6",
	signalGreen: "#2fb36d",
	signalRed: "#9aa59c",
	signalPending: "#f0a020",
	routeRemaining: BRAND_COLORS.lime,
	routeDone: "#b9c4ba",
} as const;

export const CITY_VIEW: Record<
	CityKey,
	{ center: LngLat; zoom: number; label: string }
> = {
	bengaluru: { center: [77.5946, 12.9716], zoom: 11.5, label: "Bengaluru" },
	kalaburagi: { center: [76.8343, 17.3297], zoom: 12, label: "Kalaburagi" },
};

export function cityView(city?: string | null) {
	return city === "kalaburagi" ? CITY_VIEW.kalaburagi : CITY_VIEW.bengaluru;
}

/** [[west, south], [east, north]] around the given points, or null when there are none. */
export function boundsOf(points: LngLat[]): [LngLat, LngLat] | null {
	if (points.length === 0) return null;
	let minLng = Number.POSITIVE_INFINITY;
	let minLat = Number.POSITIVE_INFINITY;
	let maxLng = Number.NEGATIVE_INFINITY;
	let maxLat = Number.NEGATIVE_INFINITY;
	for (const [lng, lat] of points) {
		minLng = Math.min(minLng, lng);
		minLat = Math.min(minLat, lat);
		maxLng = Math.max(maxLng, lng);
		maxLat = Math.max(maxLat, lat);
	}
	return [
		[minLng, minLat],
		[maxLng, maxLat],
	];
}

export function lineFeature(coords: number[][]) {
	return {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "LineString" as const, coordinates: coords },
	};
}

/**
 * Splits the route at how far the ambulance has travelled, so the map can draw
 * the finished part grey and the rest in brand lime.
 */
export function splitRoute(
	coords: number[][],
	cumM: number[],
	traveledM: number,
): { done: number[][]; remaining: number[][] } {
	if (coords.length < 2 || cumM.length !== coords.length)
		return { done: [], remaining: coords };

	let i = 1;
	while (i < cumM.length - 1 && (cumM[i] ?? 0) < traveledM) i++;

	const a = coords[i - 1];
	const b = coords[i];
	if (!a || !b) return { done: [], remaining: coords };

	const c0 = cumM[i - 1] ?? 0;
	const c1 = cumM[i] ?? c0;
	const t =
		c1 > c0 ? Math.min(1, Math.max(0, (traveledM - c0) / (c1 - c0))) : 0;
	const point = [
		(a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t,
		(a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t,
	];

	return {
		done: [...coords.slice(0, i), point],
		remaining: [point, ...coords.slice(i)],
	};
}
