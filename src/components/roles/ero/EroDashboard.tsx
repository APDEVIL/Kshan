"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Ambulance,
	Bot,
	Check,
	Hospital,
	MapPin,
	Octagon,
	Siren,
} from "lucide-react";
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
import { symptomLabel } from "@/lib/clinical";
import { api, type Id } from "@/lib/convex";
import { formatEta, languageLabel } from "@/lib/format";
import { AMBULANCE_STATUS, type AmbulanceStatus } from "@/lib/status";
import { TIMING } from "@/lib/timing";
import { describeTriageSource, TRIAGE, TRIAGE_ORDER } from "@/lib/triage";
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

	const transcript = useQuery(
		api.views.getTranscriptFeed,
		sessionId ? { sessionId, role: "ero" } : "skip",
	);
	const route = useQuery(
		api.views.getRouteForSession,
		sessionId ? { sessionId } : "skip",
	);
	const hospitals = useQuery(
		api.dispatch.rankHospitals,
		sessionId ? { sessionId } : "skip",
	);

	const veto = useMutation(api.dispatch.vetoAutoDispatch);
	const dispatchNow = useMutation(api.dispatch.dispatchNow);
	const requestHospital = useMutation(api.dispatch.requestHospital);
	const overrideTriage = useMutation(api.sessions.overrideTriage);
	const closeSession = useMutation(api.sessions.closeSession);

	const [reason, setReason] = useState<EndReason>("handed_over");
	const s = snapshot?.session;
	const vetoCountdown = useCountdown(
		s && !s.assignedAmbulanceId && s.status !== "closed"
			? s.vetoDeadline
			: undefined,
		TIMING.vetoMs,
	);

	if (!sessionId || !snapshot || !s) {
		return (
			<Panel title="Control room">
				<EmptyNote>
					No active emergency.{" "}
					<Link className="font-semibold text-brand-deep underline" href="/">
						Start one from the home screen
					</Link>
					.
				</EmptyNote>
			</Panel>
		);
	}

	const closed = s.status === "closed";
	const triage = snapshot.triage;
	const amb = snapshot.ambulance;
	const ambStatus = amb
		? AMBULANCE_STATUS[amb.status as AmbulanceStatus]
		: null;
	const needsDispatch = !s.assignedAmbulanceId && !closed;
	const canChooseHospital =
		!closed &&
		!!s.assignedAmbulanceId &&
		!s.assignedHospitalId &&
		!snapshot.hospitalRequest;

	return (
		<Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
			{/* left column: map and transcript */}
			<div className="flex min-w-0 flex-col gap-3">
				<Panel
					action={<StatusPill tone="info">{s.city ?? "city"}</StatusPill>}
					className="h-[26rem]"
					title="Live map"
				>
					<div className="min-h-0 flex-1">
						<LiveMap city={s.city ?? null} sessionId={sessionId} />
					</div>
				</Panel>

				<Panel
					action={
						<StatusPill tone="neutral">{languageLabel(s.language)}</StatusPill>
					}
					className="max-h-72"
					title="Call transcript"
				>
					<div className="k-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
						{transcript === undefined ? (
							<EmptyNote>Loading…</EmptyNote>
						) : transcript.length === 0 ? (
							<EmptyNote>Waiting for the caller to speak…</EmptyNote>
						) : (
							transcript.map((c) => (
								<div
									className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm"
									key={c._id}
								>
									<p>{c.text}</p>
									{c.translatedText && c.translatedText !== c.text ? (
										<p className="mt-1 text-muted-foreground text-xs">
											EN: {c.translatedText}
										</p>
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
					action={
						ambStatus ? (
							<StatusPill tone={ambStatus.tone}>{ambStatus.label}</StatusPill>
						) : (
							<StatusPill tone="warn">Unassigned</StatusPill>
						)
					}
					title="Dispatch"
				>
					{needsDispatch ? (
						<div className="space-y-3">
							{vetoCountdown.active ? (
								<div className="flex items-center gap-3 rounded-2xl bg-brand/12 p-3.5">
									<Bot className="size-5 text-brand-deep" />
									<div className="flex-1">
										<p className="font-semibold text-sm">
											AI will dispatch in {vetoCountdown.seconds}s
										</p>
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
									Offer sent to{" "}
									<b>
										{snapshot.offer.driverName ?? snapshot.offer.vehicleNumber}
									</b>
									. Waiting for the driver to accept.
								</p>
							) : (
								<EmptyNote>
									{s.dispatchMode === "manual"
										? "Auto-dispatch was vetoed. Dispatch manually."
										: "Waiting for symptoms before dispatch."}
								</EmptyNote>
							)}
							<div className="flex flex-wrap gap-2">
								<ActionButton
									onClick={() =>
										run(
											() => dispatchNow({ sessionId, actor, role }),
											"Nearest ambulance offered the job",
										)
									}
								>
									<Siren className="size-4" /> Dispatch now
								</ActionButton>
								{vetoCountdown.active ? (
									<ActionButton
										onClick={() =>
											run(
												() => veto({ sessionId, actor, role }),
												"Auto-dispatch cancelled",
											)
										}
										variant="outline"
									>
										<Octagon className="size-4" /> Veto
									</ActionButton>
								) : null}
							</div>
							{snapshot.offerStats.declined + snapshot.offerStats.expired >
							0 ? (
								<p className="text-muted-foreground text-xs">
									{snapshot.offerStats.declined} declined,{" "}
									{snapshot.offerStats.expired} no response. Next nearest was
									tried.
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
								<p className="truncate text-muted-foreground text-sm">
									{amb.driverName} · {amb.equipmentLevel}
								</p>
							</div>
							<div className="text-right">
								<p className="text-[11px] text-muted-foreground uppercase">
									ETA
								</p>
								<p className="font-bold text-xl tabular-nums">
									{formatEta(s.etaSeconds)}
								</p>
							</div>
						</div>
					) : (
						<EmptyNote>Mission closed.</EmptyNote>
					)}
					{route?.legs.find((l) => l.status === "active") ? (
						<p className="mt-3 text-muted-foreground text-xs">
							Route runs at {TIMING.demoSpeedMultiplier}x speed for the demo.
						</p>
					) : null}
				</Panel>

				<Panel title="Triage">
					<div className="flex items-center gap-3">
						<TriageBadge color={triage?.final ?? null} showMeaning size="lg" />
						<div className="min-w-0 text-muted-foreground text-xs">
							{triage?.final
								? `Set by ${describeTriageSource(triage.setBy).label}`
								: "Waiting for symptoms"}
							{triage?.overridden ? " · human override" : ""}
						</div>
					</div>
					{snapshot.symptoms.length > 0 ? (
						<div className="mt-3 flex flex-wrap gap-1.5">
							{snapshot.symptoms.map((x) => (
								<span
									className="rounded-full bg-muted px-2.5 py-1 font-medium text-xs"
									key={x}
								>
									{symptomLabel(x)}
								</span>
							))}
						</div>
					) : null}
					{triage?.aiReasoning ? (
						<p className="mt-3 rounded-2xl bg-muted p-3 text-muted-foreground text-xs leading-relaxed">
							<b className="text-foreground">AI reasoning:</b>{" "}
							{triage.aiReasoning}
						</p>
					) : null}
					{triage && triage.redFlags.length > 0 ? (
						<ul className="mt-2 space-y-1 text-[var(--danger)] text-xs">
							{triage.redFlags.map((r) => (
								<li key={r}>• {r}</li>
							))}
						</ul>
					) : null}
					{!closed && triage?.final ? (
						<div className="mt-4">
							<p className="mb-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
								Override
							</p>
							<div className="flex gap-2">
								{TRIAGE_ORDER.map((c) => (
									<button
										className={cn(
											"flex-1 rounded-xl border px-3 py-2 font-bold text-xs transition-all active:scale-95 disabled:opacity-40",
											TRIAGE[c].soft,
											TRIAGE[c].text,
											TRIAGE[c].border,
										)}
										disabled={triage.final === c}
										key={c}
										onClick={() =>
											run(
												() =>
													overrideTriage({
														sessionId,
														color: c,
														erHeadName: actor,
														role,
													}),
												`Triage set to ${TRIAGE[c].label}`,
											)
										}
										type="button"
									>
										{TRIAGE[c].label}
									</button>
								))}
							</div>
						</div>
					) : null}
				</Panel>

				<Panel
					action={
						snapshot.hospital ? (
							<StatusPill tone={s.assignedBedConfirmed ? "ok" : "warn"}>
								{s.assignedBedConfirmed ? "Bed confirmed" : "Awaiting ER"}
							</StatusPill>
						) : null
					}
					title="Hospital"
				>
					{snapshot.hospital ? (
						<div className="flex items-center gap-3">
							<span className="grid size-11 place-items-center rounded-2xl bg-[#3b82f6]/15 text-[#3b82f6]">
								<Hospital className="size-5" />
							</span>
							<div>
								<p className="font-bold">{snapshot.hospital.name}</p>
								<p className="text-muted-foreground text-xs">
									{snapshot.hospital.availableBeds}/
									{snapshot.hospital.totalBeds} beds free
									{snapshot.doctor ? ` · ${snapshot.doctor.name}` : ""}
								</p>
							</div>
						</div>
					) : snapshot.hospitalRequest ? (
						<p className="rounded-2xl bg-muted p-3.5 text-sm">
							Pre-alert sent to <b>{snapshot.hospitalRequest.hospitalName}</b>.
							Waiting for the ER head.
						</p>
					) : hospitals && hospitals.length > 0 ? (
						<div className="space-y-2">
							{hospitals.slice(0, 3).map((h) => (
								<div
									className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-2.5"
									key={h.hospitalId}
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-semibold text-sm">{h.name}</p>
										<p className="text-muted-foreground text-xs">
											{h.distKm.toFixed(1)} km · {Math.round(h.etaMin)} min ·{" "}
											{h.availableBeds} beds · {h.matched}/{h.required}{" "}
											facilities
										</p>
									</div>
									<ActionButton
										disabled={!canChooseHospital || h.excluded}
										onClick={() =>
											run(
												() =>
													requestHospital({
														sessionId,
														hospitalId: h.hospitalId as Id<"hospitals">,
														actor,
														role,
													}),
												`Pre-alert sent to ${h.name}`,
											)
										}
										variant="outline"
									>
										Pre-alert
									</ActionButton>
								</div>
							))}
							{playAs === "ero" && canChooseHospital ? (
								<p className="text-brand-deep text-xs">
									Your turn: choose a hospital to pre-alert.
								</p>
							) : null}
						</div>
					) : (
						<EmptyNote>
							Ranked hospitals appear once symptoms are known.
						</EmptyNote>
					)}
				</Panel>

				<Panel title="Green corridor">
					{route?.legs.find((l) => l.status === "active") ? (
						<ul className="space-y-1.5">
							{route.legs
								.find((l) => l.status === "active")
								?.signals.map((g) => (
									<li
										className="flex items-center gap-2.5 text-sm"
										key={g.signalId}
									>
										<span
											className={cn(
												"size-2.5 rounded-full",
												g.state === "green"
													? "bg-[var(--triage-green)]"
													: g.pendingApproval
														? "pulse-dot bg-[var(--triage-yellow)]"
														: "bg-muted-foreground/40",
											)}
										/>
										<span className="min-w-0 flex-1 truncate">{g.name}</span>
										<span className="text-muted-foreground text-xs">
											{g.state === "green"
												? "Green"
												: g.pendingApproval
													? "Needs officer"
													: "Normal"}
										</span>
									</li>
								))}
						</ul>
					) : (
						<EmptyNote>
							Junctions are shown once an ambulance is moving.
						</EmptyNote>
					)}
				</Panel>

				{!closed ? (
					<Panel title="End mission">
						<div className="flex flex-wrap items-center gap-2">
							<select
								className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm"
								onChange={(e) => setReason(e.target.value as EndReason)}
								value={reason}
							>
								{END_REASONS.map(([v, label]) => (
									<option key={v} value={v}>
										{label}
									</option>
								))}
							</select>
							<ActionButton
								onClick={() =>
									run(
										() => closeSession({ sessionId, reason, actor, role }),
										"Mission closed",
									)
								}
								variant="danger"
							>
								<Check className="size-4" /> Close
							</ActionButton>
						</div>
					</Panel>
				) : (
					<Panel title="Mission closed">
						<p className="flex items-center gap-2 text-sm">
							<MapPin className="size-4 text-brand-deep" /> Closed:{" "}
							{s.closeReason?.replaceAll("_", " ")}.
						</p>
					</Panel>
				)}
			</div>
		</Reveal>
	);
}
