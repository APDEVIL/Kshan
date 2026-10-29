"use client";

import { useMutation, useQuery } from "convex/react";
import { Ambulance, Bot, Check, CheckCheck, Hospital, MapPin, Octagon, Siren, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/effects/Reveal";
import { LiveMap } from "@/components/map/LiveMap";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton, EmptyNote, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useCountdown } from "@/hooks/useCountdown";
import { api, type Id } from "@/lib/convex";
import { formatEta, languageLabel } from "@/lib/format";
import { symptomLabel } from "@/lib/clinical";
import { describeTriageSource, TRIAGE, TRIAGE_ORDER } from "@/lib/triage";
import { AMBULANCE_STATUS, type AmbulanceStatus } from "@/lib/status";
import { TIMING } from "@/lib/timing";
import { cn } from "@/lib/utils";

const END_REASONS = [
  ["handed_over", "Handed over"],
  ["treated_on_scene", "Treated on scene"],
  ["refused_transport", "Refused transport"],
  ["false_alarm", "False alarm"],
  ["cancelled", "Cancelled"],
  ["deceased", "Deceased"],
] as const;

type EndReason = (typeof END_REASONS)[number][0];

export function EroDashboard() {
  const { sessionId, snapshot } = useActiveSession();
  const { playAs } = useSessionContext();
  const { role, actor, run } = useAct("ero");

  const transcript = useQuery(api.views.getTranscriptFeed, sessionId ? { sessionId, role: "ero" } : "skip");
  const route = useQuery(api.views.getRouteForSession, sessionId ? { sessionId } : "skip");
  const hospitals = useQuery(api.dispatch.rankHospitals, sessionId ? { sessionId } : "skip");
  const ambulances = useQuery(api.dispatch.recommendAmbulances, sessionId ? { sessionId } : "skip");

  const veto = useMutation(api.dispatch.vetoAutoDispatch);
  const dispatchNow = useMutation(api.dispatch.dispatchNow);
  const requestHospital = useMutation(api.dispatch.requestHospital);
  const overrideTriage = useMutation(api.sessions.overrideTriage);
  const closeSession = useMutation(api.sessions.closeSession);

  const [reason, setReason] = useState<EndReason>("handed_over");
  const s = snapshot?.session;
  const vetoCountdown = useCountdown(
    s && !s.assignedAmbulanceId && s.status !== "closed" ? s.vetoDeadline : undefined,
    TIMING.vetoMs,
  );

  if (!sessionId || !snapshot || !s) {
    return (
      <Panel title="Control room">
        <EmptyNote>
          No active emergency. <Link href="/" className="font-semibold text-brand-deep underline">Start one from the home screen</Link>.
        </EmptyNote>
      </Panel>
    );
  }

  const closed = s.status === "closed";
  const triage = snapshot.triage;
  const amb = snapshot.ambulance;
  const ambStatus = amb ? AMBULANCE_STATUS[amb.status as AmbulanceStatus] : null;
  const needsDispatch = !s.assignedAmbulanceId && !closed;
  const canChooseHospital = !closed && !!s.assignedAmbulanceId && !s.assignedHospitalId && !snapshot.hospitalRequest;

  return (
    <Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* left column: map and transcript */}
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Live map" className="h-[26rem]" action={<StatusPill tone="info">{s.city ?? "city"}</StatusPill>}>
          <div className="min-h-0 flex-1">
            <LiveMap sessionId={sessionId} city={s.city ?? null} />
          </div>
        </Panel>

        <Panel
          title="Call transcript"
          action={<StatusPill tone="neutral">{languageLabel(s.language)}</StatusPill>}
          className="max-h-72"
        >
          <div className="k-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {transcript === undefined ? (
              <EmptyNote>Loading…</EmptyNote>
            ) : transcript.length === 0 ? (
              <EmptyNote>Waiting for the caller to speak…</EmptyNote>
            ) : (
              transcript.map((c) => (
                <div key={c._id} className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
                  <p>{c.text}</p>
                  {c.translatedText && c.translatedText !== c.text ? (
                    <p className="mt-1 text-xs text-muted-foreground">EN: {c.translatedText}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* right column: decisions */}
      <div className="flex min-w-0 flex-col gap-3">
        <Panel
          title="Dispatch"
          action={
            ambStatus ? <StatusPill tone={ambStatus.tone}>{ambStatus.label}</StatusPill> : <StatusPill tone="warn">Unassigned</StatusPill>
          }
        >
          {needsDispatch ? (
            <div className="space-y-3">
              {vetoCountdown.active ? (
                <div className="flex items-center gap-3 rounded-2xl bg-brand/12 p-3.5">
                  <Bot className="size-5 text-brand-deep" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">AI will dispatch in {vetoCountdown.seconds}s</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand/20">
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-200"
                        style={{ width: `${vetoCountdown.progress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : snapshot.offer ? (
                <p className="rounded-2xl bg-muted p-3.5 text-sm">
                  Offer sent to <b>{snapshot.offer.driverName ?? snapshot.offer.vehicleNumber}</b>. Waiting for the driver to accept.
                </p>
              ) : (
                <EmptyNote>
                  {s.dispatchMode === "manual" ? "Auto-dispatch was vetoed. Dispatch manually." : "Waiting for symptoms before dispatch."}
                </EmptyNote>
              )}
              {!snapshot.offer && ambulances && ambulances.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Choose an ambulance
                  </p>
                  {ambulances.map((a) => (
                    <div
                      key={a.ambulanceId}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5",
                        a.recommended ? "bg-brand/12 ring-1 ring-brand/40" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-[11px] font-extrabold",
                          a.type === "ALS" ? "bg-[var(--danger)]/12 text-[var(--danger)]" : "bg-[var(--info)]/12 text-[var(--info)]",
                        )}
                      >
                        {a.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          {a.vehicleNumber}
                          {a.recommended ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                              <Star className="size-3" /> Recommended
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.distKm.toFixed(1)} km · ~{a.etaMin} min · {a.driverName} · {a.reason}
                        </p>
                      </div>
                      <ActionButton
                        variant={a.recommended ? "brand" : "outline"}
                        onClick={() =>
                          run(
                            () => dispatchNow({ sessionId, ambulanceId: a.ambulanceId as Id<"ambulances">, actor, role }),
                            `Job offered to ${a.vehicleNumber}`,
                          )
                        }
                      >
                        <Siren className="size-4" /> Dispatch
                      </ActionButton>
                    </div>
                  ))}
                  {playAs === "ero" ? <p className="text-xs text-brand-deep">Your turn: choose the ambulance to dispatch.</p> : null}
                </div>
              ) : !snapshot.offer ? (
                <p className="text-xs text-muted-foreground">No free ambulance in this city right now.</p>
              ) : null}
              {vetoCountdown.active ? (
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="outline"
                    onClick={() => run(() => veto({ sessionId, actor, role }), "Auto-dispatch cancelled")}
                  >
                    <Octagon className="size-4" /> Veto auto-dispatch
                  </ActionButton>
                </div>
              ) : null}
              {snapshot.offerStats.declined + snapshot.offerStats.expired > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {snapshot.offerStats.declined} declined, {snapshot.offerStats.expired} no response. Next best was tried.
                </p>
              ) : null}
            </div>
          ) : amb ? (
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
                <Ambulance className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{amb.vehicleNumber}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {amb.driverName} · {amb.equipmentLevel === "advanced" ? "ALS" : "BLS"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground uppercase">ETA</p>
                <p className="text-xl font-bold tabular-nums">{formatEta(s.etaSeconds)}</p>
              </div>
            </div>
          ) : (
            <EmptyNote>Mission closed.</EmptyNote>
          )}
          {route?.legs.find((l) => l.status === "active") ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Route runs at {route.legs.find((l) => l.status === "active")?.multiplier ?? TIMING.demoSpeedMultiplier}x speed for the demo.
            </p>
          ) : null}
        </Panel>

        <Panel title="Triage">
          <div className="flex items-center gap-3">
            <TriageBadge color={triage?.final ?? null} size="lg" showMeaning />
            <div className="min-w-0 text-xs text-muted-foreground">
              {triage?.final ? `Set by ${describeTriageSource(triage.setBy).label}` : "Waiting for symptoms"}
              {triage?.overridden ? " · human decision" : ""}
            </div>
          </div>
          {s.status !== "closed" && snapshot.symptoms.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snapshot.symptoms.map((x) => (
                <span key={x} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {symptomLabel(x)}
                </span>
              ))}
            </div>
          ) : null}
          {triage?.aiReasoning ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <b className="text-foreground">AI reasoning:</b> {triage.aiReasoning}
            </p>
          ) : null}
          {triage && triage.redFlags.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--danger)]">
              {triage.redFlags.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          ) : null}
          {!closed && triage?.final && !triage.overridden ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-muted p-3">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                <b className="text-foreground">Awaiting ERO decision.</b> The colour above is the AI suggestion. You make the final call.
              </p>
              <ActionButton
                onClick={() =>
                  run(
                    () => overrideTriage({ sessionId, color: triage.final as (typeof TRIAGE_ORDER)[number], erHeadName: actor, role }),
                    `Triage confirmed as ${TRIAGE[triage.final as (typeof TRIAGE_ORDER)[number]].label}`,
                  )
                }
              >
                <CheckCheck className="size-4" /> Confirm {TRIAGE[triage.final as (typeof TRIAGE_ORDER)[number]].label}
              </ActionButton>
            </div>
          ) : null}
          {!closed && triage?.final ? (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Change to</p>
              <div className="flex gap-2">
                {TRIAGE_ORDER.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={triage.final === c}
                    onClick={() =>
                      run(() => overrideTriage({ sessionId, color: c, erHeadName: actor, role }), `Triage set to ${TRIAGE[c].label}`)
                    }
                    className={cn(
                      "flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-40",
                      TRIAGE[c].soft,
                      TRIAGE[c].text,
                      TRIAGE[c].border,
                    )}
                  >
                    {TRIAGE[c].label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Hospital"
          action={
            snapshot.hospital ? (
              <StatusPill tone={s.assignedBedConfirmed ? "ok" : "warn"}>{s.assignedBedConfirmed ? "Bed confirmed" : "Awaiting ER"}</StatusPill>
            ) : null
          }
        >
          {snapshot.hospital ? (
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#3b82f6]/15 text-[#3b82f6]">
                <Hospital className="size-5" />
              </span>
              <div>
                <p className="font-bold">{snapshot.hospital.name}</p>
                <p className="text-xs text-muted-foreground">
                  {snapshot.hospital.availableBeds}/{snapshot.hospital.totalBeds} beds free
                  {snapshot.doctor ? ` · ${snapshot.doctor.name}` : ""}
                </p>
              </div>
            </div>
          ) : snapshot.hospitalRequest ? (
            <p className="rounded-2xl bg-muted p-3.5 text-sm">
              Pre-alert sent to <b>{snapshot.hospitalRequest.hospitalName}</b>. Waiting for the ER head.
            </p>
          ) : hospitals && hospitals.length > 0 ? (
            <div className="space-y-2">
              {hospitals.slice(0, 3).map((h) => (
                <div key={h.hospitalId} className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.distKm.toFixed(1)} km · {Math.round(h.etaMin)} min · {h.availableBeds} beds · {h.matched}/{h.required} facilities
                    </p>
                  </div>
                  <ActionButton
                    variant="outline"
                    disabled={!canChooseHospital || h.excluded}
                    onClick={() =>
                      run(
                        () => requestHospital({ sessionId, hospitalId: h.hospitalId as Id<"hospitals">, actor, role }),
                        `Pre-alert sent to ${h.name}`,
                      )
                    }
                  >
                    Pre-alert
                  </ActionButton>
                </div>
              ))}
              {playAs === "ero" && canChooseHospital ? (
                <p className="text-xs text-brand-deep">Your turn: choose a hospital to pre-alert.</p>
              ) : null}
            </div>
          ) : (
            <EmptyNote>Ranked hospitals appear once symptoms are known.</EmptyNote>
          )}
        </Panel>

        <Panel title="Green corridor">
          {route?.legs.find((l) => l.status === "active") ? (
            <ul className="space-y-1.5">
              {route.legs
                .find((l) => l.status === "active")
                ?.signals.map((g) => (
                  <li key={g.signalId} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        g.state === "green" ? "bg-[var(--triage-green)]" : g.pendingApproval ? "bg-[var(--triage-yellow)] pulse-dot" : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.state === "green" ? "Green" : g.pendingApproval ? "Needs officer" : "Normal"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyNote>Junctions are shown once an ambulance is moving.</EmptyNote>
          )}
        </Panel>

        {!closed ? (
          <Panel title="End mission">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as EndReason)}
                className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm"
              >
                {END_REASONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <ActionButton
                variant="danger"
                onClick={() => run(() => closeSession({ sessionId, reason, actor, role }), "Mission closed")}
              >
                <Check className="size-4" /> Close
              </ActionButton>
            </div>
          </Panel>
        ) : (
          <Panel title="Mission closed">
            <p className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-brand-deep" /> Closed: {s.closeReason?.replaceAll("_", " ")}.{" "}
              <Zap className="size-4 text-brand-deep" />
            </p>
          </Panel>
        )}
      </div>
    </Reveal>
  );
}