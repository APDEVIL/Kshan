"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Navigation, Siren, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { LiveMap } from "@/components/map/LiveMap";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useCountdown } from "@/hooks/useCountdown";
import { api } from "@/lib/convex";
import { formatEta, formatMeters } from "@/lib/format";
import { AMBULANCE_STATUS, type AmbulanceStatus } from "@/lib/status";
import { TIMING } from "@/lib/timing";
import { cn } from "@/lib/utils";

export function DriverScreen() {
  const { sessionId, snapshot } = useActiveSession();
  const { playAs } = useSessionContext();
  const { role, actor, run } = useAct("driver");
  const respond = useMutation(api.dispatch.respondToOffer);
  const depart = useMutation(api.ambulanceSim.departForHospital);
  const free = useMutation(api.sessions.markAmbulanceFree);
  const route = useQuery(api.views.getRouteForSession, sessionId ? { sessionId } : "skip");

  const offer = snapshot?.offer ?? null;
  const countdown = useCountdown(offer?.expiresAt, TIMING.offerMs);
  const amb = snapshot?.ambulance ?? null;
  const s = snapshot?.session;
  const active = route?.legs.find((l) => l.status === "active");
  const status = amb ? AMBULANCE_STATUS[amb.status as AmbulanceStatus] : null;

  return (
    <PhoneFrame>
      {!snapshot || !s ? (
        <div className="grid h-full place-items-center text-center">
          <div>
            <Siren className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-bold">Waiting for a job</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/" className="font-semibold text-brand-deep underline">
                Start a demo
              </Link>{" "}
              to get an offer.
            </p>
          </div>
        </div>
      ) : offer ? (
        <div className="flex h-full flex-col gap-3 pt-2">
          <div className="rounded-3xl bg-[var(--danger)]/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-[var(--danger)] uppercase">
              <Siren className="size-4 pulse-dot" /> New emergency
            </p>
            <p className="mt-2 text-lg leading-snug font-bold">{s.incidentAddressGuess ?? "Pickup location set"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TriageBadge color={snapshot.triage?.final ?? null} />
              {snapshot.symptoms.slice(0, 3).map((x) => (
                <span key={x} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium">
                  {x}
                </span>
              ))}
            </div>
          </div>
          <div className="text-center">
            <p className="font-mono text-5xl font-extrabold tabular-nums">{countdown.seconds}</p>
            <p className="text-xs text-muted-foreground">seconds to accept</p>
            <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${countdown.progress * 100}%` }} />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <ActionButton
              variant="outline"
              onClick={() =>
                run(() => respond({ offerId: offer._id, accept: false, declineReason: "Not available", actor, role }), "Declined")
              }
            >
              <X className="size-4" /> Decline
            </ActionButton>
            <ActionButton onClick={() => run(() => respond({ offerId: offer._id, accept: true, actor, role }), "Job accepted")}>
              <Check className="size-4" /> Accept
            </ActionButton>
          </div>
          {playAs === "driver" ? <p className="text-center text-xs text-brand-deep">Your turn: accept the job.</p> : null}
        </div>
      ) : amb ? (
        <div className="flex h-full flex-col gap-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{amb.vehicleNumber}</p>
              <p className="text-xs text-muted-foreground">{amb.driverName}</p>
            </div>
            {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
          </div>

          <div className="h-52 shrink-0">
            <LiveMap sessionId={sessionId} city={s.city ?? null} className="min-h-0 rounded-3xl" />
          </div>

          {active ? (
            <div className="rounded-3xl bg-muted p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Navigation className="size-4 text-brand-deep" />
                  {active.leg === "to_patient" ? "To the patient" : "To the hospital"}
                </p>
                <p className="text-lg font-bold tabular-nums">{formatEta(s.etaSeconds)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (active.traveledM / Math.max(1, active.totalM)) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatMeters(Math.max(0, active.totalM - active.traveledM))} left ·{" "}
                {active.signals.filter((g) => g.state === "green").length}/{active.signals.length} junctions green
              </p>
            </div>
          ) : null}

          {active && snapshot.route && snapshot.route.potholesTotal > 0 ? (
            <div
              className={cn(
                "rounded-3xl p-3.5",
                snapshot.route.roadRisk === "high"
                  ? "bg-[var(--danger)]/12"
                  : snapshot.route.roadRisk === "medium"
                    ? "bg-[var(--triage-yellow)]/15"
                    : "bg-muted",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <TriangleAlert
                    className={cn(
                      "size-4",
                      snapshot.route.roadRisk === "high" ? "text-[var(--danger)]" : snapshot.route.roadRisk === "medium" ? "text-[var(--warn)]" : "text-muted-foreground",
                    )}
                  />
                  Road condition
                </p>
                <span className="text-xs font-bold tracking-wider uppercase">{snapshot.route.roadRisk} risk</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-extrabold tabular-nums">{snapshot.route.potholesAhead}</p>
                  <p className="text-[11px] text-muted-foreground">potholes ahead</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold tabular-nums">{snapshot.route.severeAhead}</p>
                  <p className="text-[11px] text-muted-foreground">severe</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold tabular-nums">
                    {snapshot.route.nextPotholeM === null ? "-" : formatMeters(snapshot.route.nextPotholeM)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">next one</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Simulated road data for the demo.</p>
            </div>
          ) : null}

          {snapshot.patient || snapshot.patientNameUnconfirmed ? (
            <p className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
              Patient: <b>{snapshot.patient?.fullName ?? snapshot.patientNameUnconfirmed}</b>
              {snapshot.patient?.age ? `, ${snapshot.patient.age}` : ""}
            </p>
          ) : null}

          <div className="mt-auto space-y-2">
            {amb.status === "with_patient" && s.assignedHospitalId ? (
              <ActionButton className="w-full" onClick={() => run(() => depart({ ambulanceId: amb._id, actor, role }), "Heading to hospital")}>
                <Navigation className="size-4" /> Depart for hospital
              </ActionButton>
            ) : null}
            {amb.status === "sanitizing" ? (
              <ActionButton className="w-full" onClick={() => run(() => free({ ambulanceId: amb._id, actor }), "Ambulance is free")}>
                <Check className="size-4" /> Mark ambulance free
              </ActionButton>
            ) : null}
            {playAs === "driver" && amb.status === "with_patient" && !s.assignedHospitalId ? (
              <p className="text-center text-xs text-muted-foreground">Waiting for the hospital to accept.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
          No ambulance is assigned to this call yet.
        </div>
      )}
    </PhoneFrame>
  );
}