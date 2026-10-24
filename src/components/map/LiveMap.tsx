"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "convex/react";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { ambulanceSvg } from "@/lib/ambulanceIcon";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useRole } from "@/hooks/useRole";
import { api, type Id } from "@/lib/convex";
import {
  MAP_COLORS,
  MAP_FALLBACK_STYLE,
  MAP_STYLE_BY_THEME,
  boundsOf,
  cityView,
  lineFeature,
  splitRoute,
  type LngLat,
} from "@/lib/mapStyle";
import { cn } from "@/lib/utils";

type MarkerStore = Map<string, maplibregl.Marker>;

/**
 * MapLibre positions a marker by writing `transform` on its root element. So the root must stay
 * untouched: all styling and animation goes on the child, never on the root.
 */
function marker(innerClass: string, html = ""): HTMLDivElement {
  const root = document.createElement("div");
  const child = document.createElement("div");
  child.className = innerClass;
  child.innerHTML = html;
  root.appendChild(child);
  return root;
}

function inner(node: HTMLElement): HTMLElement {
  return (node.firstElementChild as HTMLElement | null) ?? node;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const glides = new WeakMap<maplibregl.Marker, number>();

/** Slides a marker to a new position, so the ambulance rolls instead of jumping between server ticks. */
function glideTo(m: maplibregl.Marker, lng: number, lat: number, ms = 950) {
  const running = glides.get(m);
  if (running !== undefined) cancelAnimationFrame(running);
  const from = m.getLngLat();
  if (Math.abs(from.lng - lng) < 1e-9 && Math.abs(from.lat - lat) < 1e-9) return;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    m.setLngLat([from.lng + (lng - from.lng) * t, from.lat + (lat - from.lat) * t]);
    if (t < 1) glides.set(m, requestAnimationFrame(step));
    else glides.delete(m);
  };
  glides.set(m, requestAnimationFrame(step));
}

/** Adds, moves and removes markers so the store matches `items`. */
function syncMarkers<T extends { id: string; lng: number; lat: number }>(
  map: maplibregl.Map,
  store: MarkerStore,
  items: T[],
  build: (item: T) => HTMLElement,
  update?: (node: HTMLElement, item: T) => void,
  smooth = false,
) {
  const seen = new Set<string>();
  for (const item of items) {
    seen.add(item.id);
    const existing = store.get(item.id);
    if (existing) {
      update?.(existing.getElement(), item);
      if (smooth) glideTo(existing, item.lng, item.lat);
      else existing.setLngLat([item.lng, item.lat]);
    } else {
      const node = build(item);
      update?.(node, item);
      store.set(item.id, new maplibregl.Marker({ element: node }).setLngLat([item.lng, item.lat]).addTo(map));
    }
  }
  for (const [id, m] of store) {
    if (!seen.has(id)) {
      const running = glides.get(m);
      if (running !== undefined) cancelAnimationFrame(running);
      m.remove();
      store.delete(id);
    }
  }
}

type GeoData = Exclude<maplibregl.GeoJSONSourceSpecification["data"], string>;

const EMPTY = { type: "FeatureCollection" as const, features: [] as ReturnType<typeof lineFeature>[] };

/**
 * Live map: ambulances, hospitals, junctions, the incident and the route.
 * Everything comes from Convex, so it moves as the server-side simulation moves.
 */
export function LiveMap({
  sessionId,
  city,
  className,
}: {
  sessionId: Id<"sessions"> | null;
  city?: string | null;
  className?: string;
}) {
  const { theme } = useTheme();
  const { role } = useRole();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ambMarkers = useRef<MarkerStore>(new Map());
  const hospMarkers = useRef<MarkerStore>(new Map());
  const sigMarkers = useRef<MarkerStore>(new Map());
  const incidentMarker = useRef<maplibregl.Marker | null>(null);
  const fittedFor = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const fleet = useQuery(api.views.getFleetOverview, city ? { city } : {});
  const route = useQuery(api.views.getRouteForSession, sessionId ? { sessionId } : "skip");
  const snapshot = useQuery(
    api.views.getSessionSnapshot,
    sessionId ? { sessionId, role: role ?? "ero" } : "skip",
  );

  // Create the map. Re-created when the theme changes, which is the simplest way to swap the base style.
  useEffect(() => {
    if (!box.current) return;
    setReady(false);
    const view = cityView(city);
    const map = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE_BY_THEME[theme === "dark" ? "dark" : "light"], // the ambulance theme is a light theme
      center: view.center,
      zoom: view.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    let fellBack = false;
    map.on("error", () => {
      // The dark style name is not guaranteed. Fall back once to the light style.
      if (!fellBack && !map.isStyleLoaded()) {
        fellBack = true;
        map.setStyle(MAP_FALLBACK_STYLE);
      }
    });

    map.on("style.load", () => {
      for (const id of ["route-done", "route-other", "route-remaining"]) {
        map.addSource(id, { type: "geojson", data: EMPTY });
      }
      map.addLayer({
        id: "route-other",
        type: "line",
        source: "route-other",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": MAP_COLORS.routeDone, "line-width": 4, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "route-done",
        type: "line",
        source: "route-done",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": MAP_COLORS.routeDone, "line-width": 5 },
      });
      map.addLayer({
        id: "route-remaining",
        type: "line",
        source: "route-remaining",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssVar("--brand", MAP_COLORS.routeRemaining), "line-width": 6 },
      });
      setReady(true);
    });

    const markerStores = [ambMarkers.current, hospMarkers.current, sigMarkers.current];
    const incident = incidentMarker;
    return () => {
      for (const store of markerStores) {
        for (const m of store.values()) m.remove();
        store.clear();
      }
      incident.current?.remove();
      incident.current = null;
      map.remove();
      mapRef.current = null;
      fittedFor.current = null;
    };
  }, [theme, city]);

  // Fleet markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fleet) return;

    syncMarkers(
      map,
      hospMarkers.current,
      fleet.hospitals.map((h) => ({ id: h._id, lng: h.lng, lat: h.lat, name: h.name, beds: h.availableBeds })),
      () =>
        marker(
          "grid size-7 place-items-center rounded-lg bg-[#1f6feb] text-xs font-extrabold text-white shadow-md ring-2 ring-white",
          "H",
        ),
      (node, h) => {
        node.title = `${h.name} · ${h.beds} beds free`;
      },
    );

    syncMarkers(
      map,
      ambMarkers.current,
      fleet.ambulances.map((a) => ({
        id: a._id,
        lng: a.lng,
        lat: a.lat,
        label: a.vehicleNumber,
        busy: a.status !== "idle",
        mine: a.currentSessionId === sessionId,
      })),
      (a) => marker("w-11 transition-[opacity,filter] duration-300 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full", ambulanceSvg(a.mine)),
      (node, a) => {
        node.title = a.label;
        // face the way it drives: the drawing faces right, so flip it when moving west
        const prev = Number(node.dataset.lng ?? a.lng);
        if (a.lng < prev - 1e-7) node.dataset.dir = "w";
        else if (a.lng > prev + 1e-7) node.dataset.dir = "e";
        node.dataset.lng = String(a.lng);
        node.style.zIndex = a.mine ? "5" : "2";
        const body = inner(node);
        body.style.transform = node.dataset.dir === "w" ? "scaleX(-1)" : "";
        body.style.opacity = a.mine || !a.busy ? "1" : "0.55";
        body.style.filter = a.mine ? `drop-shadow(0 0 7px ${cssVar("--brand", MAP_COLORS.ambulance)})` : "drop-shadow(0 1px 2px rgb(0 0 0 / 0.35))";
      },
      true,
    );

    syncMarkers(
      map,
      sigMarkers.current,
      fleet.signals.map((g) => ({
        id: g._id,
        lng: g.lng,
        lat: g.lat,
        name: g.name,
        state: g.state,
        pending: g.pendingApproval,
      })),
      () => marker("size-3.5 rounded-full border-2 border-white shadow transition-colors"),
      (node, g) => {
        node.title = `${g.name}${g.pending ? " (needs approval)" : ""}`;
        inner(node).style.background = g.pending
          ? MAP_COLORS.signalPending
          : g.state === "green"
            ? MAP_COLORS.signalGreen
            : MAP_COLORS.signalRed;
      },
    );
  }, [fleet, ready, sessionId]);

  // Incident pin.
  const incLat = snapshot?.session.incidentLat;
  const incLng = snapshot?.session.incidentLng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (incLat === undefined || incLng === undefined) {
      incidentMarker.current?.remove();
      incidentMarker.current = null;
      return;
    }
    if (!incidentMarker.current) {
      incidentMarker.current = new maplibregl.Marker({
        element: marker(
          "k-ping grid size-6 place-items-center rounded-full bg-[#e5484d] ring-4 ring-[#e5484d]/30",
          '<span class="size-2 rounded-full bg-white"></span>',
        ),
      })
        .setLngLat([incLng, incLat])
        .addTo(map);
    } else {
      incidentMarker.current.setLngLat([incLng, incLat]);
    }
  }, [incLat, incLng, ready]);

  // Route lines and the pan to fit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const set = (id: string, data: GeoData) => {
      const src = map.getSource(id);
      if (src && "setData" in src) (src as maplibregl.GeoJSONSource).setData(data);
    };
    if (!route) {
      set("route-done", EMPTY);
      set("route-other", EMPTY);
      set("route-remaining", EMPTY);
      return;
    }
    const active = route.legs.find((l) => l.status === "active");
    const others = route.legs.filter((l) => l.status !== "active" && l.coords.length > 1);
    set("route-other", { type: "FeatureCollection", features: others.map((l) => lineFeature(l.coords)) });
    if (active) {
      const { done, remaining } = splitRoute(active.coords, active.cumM, active.traveledM);
      set("route-done", done.length > 1 ? lineFeature(done) : EMPTY);
      set("route-remaining", remaining.length > 1 ? lineFeature(remaining) : EMPTY);
    } else {
      set("route-done", EMPTY);
      set("route-remaining", EMPTY);
    }

    // Fit once per leg so the map does not fight the user when they pan.
    const key = `${sessionId}:${active?.routeId ?? "none"}`;
    if (active && fittedFor.current !== key) {
      fittedFor.current = key;
      const b = boundsOf(active.coords.map((c) => [c[0] ?? 0, c[1] ?? 0] as LngLat));
      if (b) map.fitBounds(b, { padding: 70, duration: 900, maxZoom: 15 });
    }
  }, [route, ready, sessionId]);

  return <div ref={box} className={cn("size-full min-h-64 overflow-hidden rounded-[1.5rem]", className)} />;
}