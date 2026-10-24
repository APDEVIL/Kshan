"use client";

import { useMutation, useQuery } from "convex/react";
import { FileHeart, KeyRound, ShieldAlert, UserSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/effects/Reveal";
import { VitalsGrid } from "@/components/panels/VitalsGrid";
import { ActionButton, EmptyNote, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import { symptomLabel } from "@/lib/clinical";
import { api } from "@/lib/convex";
import { formatEta } from "@/lib/format";
import { describeTriageSource, TRIAGE, TRIAGE_ORDER } from "@/lib/triage";
import { cn } from "@/lib/utils";

export function DoctorDashboard() {
  const { sessionId, snapshot } = useActiveSession();
  const { role, actor, run } = useAct("doctor");
  const history = useQuery(api.patients.getHistoryForSession, sessionId ? { sessionId, role } : "skip");

  const linkPatient = useMutation(api.sessions.linkPatient);
  const grant = useMutation(api.patients.grantHistoryAccess);
  const overrideTriage = useMutation(api.sessions.overrideTriage);

  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [lookupPhone, setLookupPhone] = useState<string | null>(null);
  const found = useQuery(api.patients.lookupByPhone, lookupPhone ? { phone: lookupPhone } : "skip");

  if (!sessionId || !snapshot) {
    return (
      <Panel title="Emergency doctor">
        <EmptyNote>
          No patient yet. <Link href="/" className="font-semibold text-brand-deep underline">Start a demo</Link>.
        </EmptyNote>
      </Panel>
    );
  }

  const s = snapshot.session;
  const triage = snapshot.triage;
  const closed = s.status === "closed";
  const linked = snapshot.patient;

  return (
    <Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Patient" action={<TriageBadge color={triage?.final ?? null} />}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold">{linked?.fullName ?? snapshot.patientNameUnconfirmed ?? "Unidentified patient"}</p>
              <p className="text-xs text-muted-foreground">
                {linked ? `${linked.age ?? "?"} yrs · ${linked.bloodGroup ?? "blood group unknown"}` : "Not linked to a record yet"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase">Arrives in</p>
              <p className="text-xl font-bold tabular-nums">{formatEta(s.etaSeconds)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {snapshot.symptoms.map((x) => (
              <span key={x} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {symptomLabel(x)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Vitals from the ambulance">
          <VitalsGrid vitals={snapshot.vitals} />
          {snapshot.vitals ? (
            <p className="mt-2 text-xs text-muted-foreground">Recorded by {snapshot.vitals.recordedBy}</p>
          ) : null}
        </Panel>

        <Panel title="Triage">
          <div className="flex items-center gap-3">
            <TriageBadge color={triage?.final ?? null} size="lg" showMeaning />
            <p className="text-xs text-muted-foreground">
              {triage?.final ? `Set by ${describeTriageSource(triage.setBy).label}` : "Waiting for symptoms"}
            </p>
          </div>
          {triage?.aiReasoning ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <b className="text-foreground">AI reasoning:</b> {triage.aiReasoning}
            </p>
          ) : null}
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

      <div className="flex min-w-0 flex-col gap-3">
        <Panel
          title="Medical history"
          action={history?.allowed ? <StatusPill tone="ok">{history.accessMode === "break_glass" ? "Break-glass" : "Consent"}</StatusPill> : <StatusPill tone="neutral">Locked</StatusPill>}
        >
          {history?.allowed ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {history.patient.knownAllergies.map((a) => (
                  <span key={a} className="rounded-full bg-[var(--danger)]/12 px-2.5 py-1 font-semibold text-[var(--danger)]">
                    Allergy: {a}
                  </span>
                ))}
                {history.patient.chronicConditions.map((c) => (
                  <span key={c} className="rounded-full bg-[var(--warn)]/14 px-2.5 py-1 font-semibold text-[var(--warn)]">
                    {c}
                  </span>
                ))}
              </div>
              {history.records.length === 0 ? (
                <EmptyNote>No records in the last 12 months.</EmptyNote>
              ) : (
                <ul className="space-y-2">
                  {history.records.map((r) => (
                    <li key={r._id} className="rounded-2xl bg-muted px-3.5 py-2.5">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <FileHeart className="size-4 text-brand-deep" /> {r.diagnosis}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.visitDate).toLocaleDateString("en-IN")}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : !linked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Find the patient by phone number to link their record.</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setLookupPhone(phone.trim() || null);
                }}
              >
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="10-digit phone"
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand"
                />
                <ActionButton type="submit" disabled={phone.length < 6}>
                  <UserSearch className="size-4" /> Find
                </ActionButton>
              </form>
              {lookupPhone && found === null ? <p className="text-xs text-muted-foreground">No record for that number.</p> : null}
              {found ? (
                <div className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{found.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {found.age ?? "?"} yrs · {found.bloodGroup ?? "–"}
                    </p>
                  </div>
                  <ActionButton
                    onClick={() => run(() => linkPatient({ sessionId, patientId: found._id, actor, role }), "Patient linked")}
                  >
                    Link
                  </ActionButton>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">Demo numbers: 9845011223, 9886123456, 9900112233, 9448012345.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <KeyRound className="size-4 text-brand-deep" /> History for <b>{linked.fullName}</b> is locked. Every opening is logged.
              </p>
              <ActionButton onClick={() => run(() => grant({ sessionId, mode: "consent", actor, role }), "History opened with consent")}>
                Patient or family consents
              </ActionButton>
              <div className="rounded-2xl border border-[var(--danger)]/30 p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--danger)]">
                  <ShieldAlert className="size-4" /> Break-glass: patient cannot consent
                </p>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (required)"
                  className="mb-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                />
                <ActionButton
                  variant="danger"
                  disabled={reason.trim().length < 3}
                  onClick={() => run(() => grant({ sessionId, mode: "break_glass", reason, actor, role }), "Break-glass access logged")}
                >
                  Open history now
                </ActionButton>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Reveal>
  );
}