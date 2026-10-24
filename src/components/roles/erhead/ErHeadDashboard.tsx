"use client";

import { useMutation, useQuery } from "convex/react";
import { BedDouble, Check, HeartPulse, Siren, Stethoscope, X } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/effects/Reveal";
import { VitalsGrid } from "@/components/panels/VitalsGrid";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton, EmptyNote, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useCountdown } from "@/hooks/useCountdown";
import { symptomLabel } from "@/lib/clinical";
import { api } from "@/lib/convex";
import { formatEta } from "@/lib/format";
import { TIMING } from "@/lib/timing";
import { describeTriageSource, TRIAGE, TRIAGE_ORDER } from "@/lib/triage";
import { cn } from "@/lib/utils";

export function ErHeadDashboard() {
  const { sessionId, snapshot } = useActiveSession();
  const { playAs } = useSessionContext();
  const { role, actor, run } = useAct("er_head");
  const doctors = useQuery(api.views.getDoctorsForSession, sessionId ? { sessionId } : "skip");

  const respond = useMutation(api.dispatch.respondHospitalRequest);
  const confirmBed = useMutation(api.sessions.confirmBed);
  const assignDoctor = useMutation(api.sessions.assignDoctor);
  const overrideTriage = useMutation(api.sessions.overrideTriage);

  const request = snapshot?.hospitalRequest ?? null;
  const countdown = useCountdown(request?.expiresAt, TIMING.hospitalMs);

  if (!sessionId || !snapshot) {
    return (
      <Panel title="ER head">
        <EmptyNote>
          No incoming patient. <Link href="/" className="font-semibold text-brand-deep underline">Start a demo</Link>.
        </EmptyNote>
      </Panel>
    );
  }

  const s = snapshot.session;
  const triage = snapshot.triage;
  const closed = s.status === "closed";
  const hospital = snapshot.hospital;

  return (
    <Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        {request ? (
          <Panel
            title="Incoming pre-alert"
            tone="brand"
            action={<StatusPill tone="warn" pulse>{countdown.seconds}s left</StatusPill>}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/25">
                <Siren className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold">{request.hospitalName}</p>
                <p className="text-sm opacity-80">
                  Ambulance ETA {formatEta(s.etaSeconds)} · rank #{request.rank + 1}
                </p>
              </div>
              <TriageBadge color={triage?.final ?? null} className="ml-auto bg-white/90" />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${countdown.progress * 100}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                className="bg-white text-[#17261c] shadow-none"
                onClick={() => run(() => respond({ requestId: request._id, accept: true, actor, role }), "Patient accepted")}
              >
                <Check className="size-4" /> Accept patient
              </ActionButton>
              <ActionButton
                variant="outline"
                className="border-white/50 bg-transparent text-inherit"
                onClick={() =>
                  run(() => respond({ requestId: request._id, accept: false, rejectReason: "No capacity", actor, role }), "Request rejected")
                }
              >
                <X className="size-4" /> No capacity
              </ActionButton>
            </div>
            {playAs === "er_head" ? <p className="mt-3 text-sm font-semibold">Your turn: accept or reject the pre-alert.</p> : null}
          </Panel>
        ) : null}

        <Panel title="Patient on the way" action={<TriageBadge color={triage?.final ?? null} />}>
          {s.assignedAmbulanceId || request || hospital ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {snapshot.symptoms.length === 0 ? (
                  <EmptyNote>Symptoms not captured yet.</EmptyNote>
                ) : (
                  snapshot.symptoms.map((x) => (
                    <span key={x} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {symptomLabel(x)}
                    </span>
                  ))
                )}
              </div>
              <VitalsGrid vitals={snapshot.vitals} />
              {triage?.aiReasoning ? (
                <p className="rounded-2xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  <b className="text-foreground">AI reasoning:</b> {triage.aiReasoning}
                </p>
              ) : null}
              {triage?.redFlags.length ? (
                <ul className="space-y-1 text-xs text-[var(--danger)]">
                  {triage.redFlags.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <EmptyNote>No ambulance assigned yet.</EmptyNote>
          )}
        </Panel>

        {snapshot.firstAid.length > 0 ? (
          <Panel title="First aid given by the caller">
            <ul className="space-y-1.5 text-sm">
              {snapshot.firstAid.map((f) => (
                <li key={f} className="flex gap-2">
                  <HeartPulse className="mt-0.5 size-4 shrink-0 text-brand-deep" /> {f}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <Panel
          title="Bed"
          action={
            hospital ? <StatusPill tone={s.assignedBedConfirmed ? "ok" : "warn"}>{s.assignedBedConfirmed ? "Ready" : "Not confirmed"}</StatusPill> : null
          }
        >
          {hospital ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#3b82f6]/15 text-[#3b82f6]">
                  <BedDouble className="size-5" />
                </span>
                <div>
                  <p className="font-bold">{hospital.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hospital.availableBeds} of {hospital.totalBeds} beds free
                  </p>
                </div>
              </div>
              <ActionButton
                disabled={closed}
                variant={s.assignedBedConfirmed ? "outline" : "brand"}
                onClick={() =>
                  run(
                    () => confirmBed({ sessionId, confirmed: !s.assignedBedConfirmed, actor, role }),
                    s.assignedBedConfirmed ? "Bed marked not ready" : "Bed confirmed",
                  )
                }
              >
                <BedDouble className="size-4" /> {s.assignedBedConfirmed ? "Mark bed not ready" : "Confirm bed is ready"}
              </ActionButton>
            </div>
          ) : (
            <EmptyNote>Accept the pre-alert to reserve a bed.</EmptyNote>
          )}
        </Panel>

        <Panel title="Emergency doctor" action={snapshot.doctor ? <StatusPill tone="ok">{snapshot.doctor.name}</StatusPill> : null}>
          {doctors === undefined || doctors.length === 0 ? (
            <EmptyNote>Doctors appear once a hospital is chosen.</EmptyNote>
          ) : (
            <div className="space-y-2">
              {doctors.map((d) => {
                const current = s.assignedDoctorId === d._id;
                return (
                  <div key={d._id} className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-2.5">
                    <Stethoscope className="size-4 shrink-0 text-brand-deep" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.specialty} · {d.available ? "available" : "busy"}
                      </p>
                    </div>
                    <ActionButton
                      variant={current ? "brand" : "outline"}
                      disabled={current || closed || !hospital}
                      onClick={() => run(() => assignDoctor({ sessionId, doctorId: d._id, actor, role }), `${d.name} assigned`)}
                    >
                      {current ? "Assigned" : "Assign"}
                    </ActionButton>
                  </div>
                );
              })}
              {s.doctorAssignedBy ? (
                <p className="text-xs text-muted-foreground">Assigned by {s.doctorAssignedBy.replace(":", " · ")}</p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Triage decision">
          <div className="flex items-center gap-3">
            <TriageBadge color={triage?.final ?? null} size="lg" showMeaning />
            <p className="text-xs text-muted-foreground">
              {triage?.final ? `Set by ${describeTriageSource(triage.setBy).label}` : "Waiting for symptoms"}
            </p>
          </div>
          {!closed && triage?.final ? (
            <div className="mt-3 flex gap-2">
              {TRIAGE_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={triage.final === c}
                  onClick={() => run(() => overrideTriage({ sessionId, color: c, erHeadName: actor, role }), `Triage set to ${TRIAGE[c].label}`)}
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
          ) : null}
        </Panel>
      </div>
    </Reveal>
  );
}