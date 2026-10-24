"use client";

import { useMutation } from "convex/react";
import { Activity, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionButton, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { useActiveSession } from "@/hooks/useActiveSession";
import { CONSCIOUSNESS, VITAL_META, VITAL_TONE_CLASS, vitalTone, type Consciousness, type VitalKey } from "@/lib/clinical";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

const STREAM_MS = 6000;

type Reading = Record<VitalKey, number>;

const PRESETS: Record<string, { label: string; values: Reading; consciousness: Consciousness }> = {
  normal: { label: "Stable", values: { heartRate: 78, systolic: 122, diastolic: 80, spo2: 98 }, consciousness: "alert" },
  cardiac: { label: "Cardiac", values: { heartRate: 126, systolic: 88, diastolic: 56, spo2: 91 }, consciousness: "responsive" },
  shock: { label: "Shock", values: { heartRate: 142, systolic: 78, diastolic: 44, spo2: 86 }, consciousness: "unresponsive" },
};

const RANGE: Record<VitalKey, [number, number]> = {
  heartRate: [30, 180],
  systolic: [60, 220],
  diastolic: [30, 130],
  spo2: [70, 100],
};

/** One heartbeat as a shape: phase 0..1 gives the signal height (-1..1). */
function beat(phase: number): number {
  const g = (c: number, w: number, a: number) => a * Math.exp(-((phase - c) ** 2) / (2 * w * w));
  return g(0.12, 0.025, 0.18) + g(0.27, 0.008, -0.18) + g(0.3, 0.01, 1) + g(0.33, 0.01, -0.3) + g(0.55, 0.04, 0.3);
}

function EcgTrace({ heartRate, flat }: { heartRate: number; flat: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hrRef = useRef(heartRate);
  const flatRef = useRef(flat);
  useEffect(() => {
    hrRef.current = heartRate;
    flatRef.current = flat;
  }, [heartRate, flat]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const color = getComputedStyle(canvas).getPropertyValue("--brand").trim() || "#7ac70c";
    const W = canvas.width;
    const H = canvas.height;
    const SPEED = 110; // pixels per second
    let x = 0;
    let lastY = H / 2;
    let last = performance.now();
    let phaseClock = 0;
    let raf = 0;

    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dx = Math.max(1, Math.round(SPEED * dt));
      for (let i = 0; i < dx; i++) {
        phaseClock += hrRef.current / 60 / SPEED;
        const phase = phaseClock % 1;
        const v = flatRef.current ? 0 : beat(phase);
        const y = H / 2 - v * (H * 0.4);
        ctx.clearRect(x + 1, 0, 14, H);
        ctx.beginPath();
        ctx.moveTo(x, lastY);
        ctx.lineTo(x + 1, y);
        ctx.stroke();
        lastY = y;
        x += 1;
        if (x >= W) {
          x = 0;
          lastY = H / 2;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={640} height={130} className="h-32 w-full rounded-2xl bg-[#0f1a13]" />;
}

export function VitalsMonitorSim() {
  const { sessionId } = useActiveSession();
  const record = useMutation(api.sessions.recordVitals);
  const [values, setValues] = useState<Reading>(PRESETS.normal?.values ?? { heartRate: 78, systolic: 122, diastolic: 80, spo2: 98 });
  const [consciousness, setConsciousness] = useState<Consciousness>("alert");
  const [streaming, setStreaming] = useState(false);

  const latest = useRef({ values, consciousness });
  useEffect(() => {
    latest.current = { values, consciousness };
  }, [values, consciousness]);

  const send = async () => {
    if (!sessionId) return;
    const { values: v, consciousness: c } = latest.current;
    await record({
      sessionId,
      heartRate: v.heartRate,
      bloodPressureSystolic: v.systolic,
      bloodPressureDiastolic: v.diastolic,
      spo2: v.spo2,
      consciousness: c,
      recordedBy: "Vitals monitor",
      role: "helper",
    });
  };

  useEffect(() => {
    if (!streaming || !sessionId) return;
    const tick = () => {
      send().catch((err) => {
        setStreaming(false);
        toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not send vitals");
      });
    };
    tick();
    const id = window.setInterval(tick, STREAM_MS);
    return () => window.clearInterval(id);
    // biome-ignore lint/correctness/useExhaustiveDependencies: send reads the latest values from a ref
  }, [streaming, sessionId, send]);

  const apply = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setValues(p.values);
    setConsciousness(p.consciousness);
  };

  return (
    <Panel
      title="Vitals monitor"
      action={<StatusPill tone={streaming ? "ok" : "neutral"} pulse={streaming}>{streaming ? "Streaming to ER" : "Not sending"}</StatusPill>}
    >
      <EcgTrace heartRate={values.heartRate} flat={values.heartRate < 20} />
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button
            key={k}
            type="button"
            onClick={() => apply(k)}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold hover:border-brand"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(RANGE) as VitalKey[]).map((k) => {
          const tone = vitalTone(k, values[k]);
          return (
            <label key={k} className="block">
              <span className="flex items-baseline justify-between text-xs font-semibold text-muted-foreground">
                {VITAL_META[k].label}
                <span className={cn("text-base font-extrabold tabular-nums", VITAL_TONE_CLASS[tone].text)}>
                  {values[k]} <span className="text-[10px] font-medium">{VITAL_META[k].unit}</span>
                </span>
              </span>
              <input
                type="range"
                min={RANGE[k][0]}
                max={RANGE[k][1]}
                value={values[k]}
                onChange={(e) => setValues({ ...values, [k]: Number(e.target.value) })}
                className="mt-1 w-full accent-[var(--brand)]"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex gap-1.5">
        {(Object.keys(CONSCIOUSNESS) as Consciousness[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setConsciousness(c)}
            className={cn(
              "flex-1 rounded-xl border px-2 py-2 text-[11px] font-semibold",
              consciousness === c ? "border-transparent bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {CONSCIOUSNESS[c].label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton disabled={!sessionId} onClick={() => send().then(() => toast.success("Vitals sent"))}>
          <Activity className="size-4" /> Send once
        </ActionButton>
        <ActionButton variant={streaming ? "danger" : "outline"} disabled={!sessionId} onClick={() => setStreaming((s) => !s)}>
          <Radio className="size-4" /> {streaming ? "Stop streaming" : "Stream every 6 s"}
        </ActionButton>
      </div>
      {!sessionId ? <p className="mt-2 text-xs text-muted-foreground">Start an emergency first.</p> : null}
    </Panel>
  );
}