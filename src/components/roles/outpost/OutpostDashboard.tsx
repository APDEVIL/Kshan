"use client";

import { useMutation, useQuery } from "convex/react";
import { Ambulance, CircleCheck, ShieldCheck, TrafficCone } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/effects/Reveal";
import { LiveMap } from "@/components/map/LiveMap";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton, EmptyNote, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import { api } from "@/lib/convex";
import { formatEta, formatMeters } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OutpostDashboard() {
  const { sessionId, snapshot } = useActiveSession();
  const { playAs } = useSessionContext();
  const { role, actor, run } = useAct("outpost");
  const route = useQuery(api.views.getRouteForSession, sessionId ? { sessionId } : "skip");
  const approve = useMutation(api.traffic.approveCorridor);

  if (!sessionId || !snapshot) {
    return (
      <Panel title="Traffic outpost">
        <EmptyNote>
          No ambulance on the road. <Link href="/" className="font-semibold text-brand-deep underline">Start a demo</Link>.
        </EmptyNote>
      </Panel>
    );
  }

  const active = route?.legs.find((l) => l.status === "active") ?? null;
  const signals = active?.signals ?? [];
  const pending = signals.filter((g) => g.pendingApproval).length;
  const green = signals.filter((g) => g.state === "green").length;
  const amb = snapshot.ambulance;

  return (
    <Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel title="Ambulance on route" className="h-[30rem]">
        <div className="min-h-0 flex-1">
          <LiveMap sessionId={sessionId} city={snapshot.session.city ?? null} />
        </div>
      </Panel>

      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Green corridor request" tone={pending > 0 ? "brand" : "default"}>
          {active ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-12 place-items-center rounded-2xl", pending > 0 ? "bg-white/25" : "bg-brand-soft text-brand-deep")}>
                  {pending > 0 ? <TrafficCone className="size-6" /> : <ShieldCheck className="size-6" />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold">
                    {pending > 0 ? `${pending} junction${pending === 1 ? "" : "s"} waiting for you` : "Corridor approved"}
                  </p>
                  <p className="text-sm opacity-80">
                    {amb?.vehicleNumber} · {active.leg === "to_patient" ? "going to the patient" : "going to the hospital"}
                  </p>
                </div>
              </div>
              <ActionButton
                disabled={pending === 0}
                className={pending > 0 ? "bg-white text-[#17261c] shadow-none" : ""}
                onClick={() => run(() => approve({ sessionId, actor, role }), "Green corridor approved")}
              >
                <CircleCheck className="size-4" /> Approve green corridor
              </ActionButton>
              {playAs === "outpost" && pending > 0 ? <p className="text-sm font-semibold">Your turn: approve the corridor.</p> : null}
            </div>
          ) : (
            <EmptyNote>A request appears here when an ambulance route is planned.</EmptyNote>
          )}
        </Panel>

        <Panel title="Ambulance" action={amb ? <StatusPill tone="info">{amb.status.replaceAll("_", " ")}</StatusPill> : null}>
          {amb ? (
            <div className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
                <Ambulance className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{amb.vehicleNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {active ? `${formatMeters(Math.max(0, active.totalM - active.traveledM))} to go` : "Not moving"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground uppercase">ETA</p>
                <p className="text-xl font-bold tabular-nums">{formatEta(snapshot.session.etaSeconds)}</p>
              </div>
            </div>
          ) : (
            <EmptyNote>No ambulance assigned.</EmptyNote>
          )}
        </Panel>

        <Panel title="Junctions" action={signals.length ? <StatusPill tone="ok">{green}/{signals.length} green</StatusPill> : null}>
          {signals.length === 0 ? (
            <EmptyNote>No junctions on the route yet.</EmptyNote>
          ) : (
            <ul className="space-y-1.5">
              {signals.map((g) => (
                <li key={g.signalId} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      g.state === "green" ? "bg-[var(--triage-green)]" : g.pendingApproval ? "bg-[var(--triage-yellow)] pulse-dot" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.state === "green" ? "Green" : g.pendingApproval ? "Needs approval" : "Normal"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Reveal>
  );
}