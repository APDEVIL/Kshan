"use client";

import { useMutation, useQuery } from "convex/react";
import { Activity, Hospital, Send, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { useAct } from "@/hooks/useAct";
import { useActiveSession } from "@/hooks/useActiveSession";
import {
	CONSCIOUSNESS,
	type Consciousness,
	VITAL_META,
	VITAL_TONE_CLASS,
	type VitalKey,
	vitalTone,
} from "@/lib/clinical";
import { api, type Id } from "@/lib/convex";
import { cn } from "@/lib/utils";

const FIELDS: VitalKey[] = ["heartRate", "systolic", "diastolic", "spo2"];

type Draft = Record<VitalKey, string>;
const EMPTY: Draft = { heartRate: "", systolic: "", diastolic: "", spo2: "" };
const PRESET: Draft = {
	heartRate: "126",
	systolic: "88",
	diastolic: "56",
	spo2: "91",
};

function num(v: string): number | undefined {
	if (v.trim() === "") return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

export function HelperScreen() {
	const { sessionId, snapshot } = useActiveSession();
	const { playAs } = useSessionContext();
	const { role, actor, run } = useAct("helper");
	const record = useMutation(api.sessions.recordVitals);
	const requestHospital = useMutation(api.dispatch.requestHospital);
	const hospitals = useQuery(
		api.dispatch.rankHospitals,
		sessionId ? { sessionId } : "skip",
	);

	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [consciousness, setConsciousness] = useState<Consciousness>("alert");

	const s = snapshot?.session;
	const last = snapshot?.vitals ?? null;
	const picked =
		!!snapshot &&
		[
			"patient_picked_up",
			"awaiting_hospital_accept",
			"en_route_to_hospital",
			"at_hospital",
		].includes(s?.status ?? "");

	const submit = () => {
		if (!sessionId) return;
		const hr = num(draft.heartRate);
		const sys = num(draft.systolic);
		const dia = num(draft.diastolic);
		const sp = num(draft.spo2);
		return run(
			() =>
				record({
					sessionId,
					consciousness,
					recordedBy: actor,
					role,
					...(hr !== undefined ? { heartRate: hr } : {}),
					...(sys !== undefined ? { bloodPressureSystolic: sys } : {}),
					...(dia !== undefined ? { bloodPressureDiastolic: dia } : {}),
					...(sp !== undefined ? { spo2: sp } : {}),
				}),
			"Vitals sent to the ER",
		);
	};

	return (
		<PhoneFrame>
			{!snapshot || !s || !sessionId ? (
				<div className="grid h-full place-items-center text-center">
					<div>
						<Activity className="mx-auto size-10 text-muted-foreground" />
						<p className="mt-3 font-bold">No patient yet</p>
						<p className="mt-1 text-muted-foreground text-sm">
							<Link
								className="font-semibold text-brand-deep underline"
								href="/"
							>
								Start a demo
							</Link>{" "}
							first.
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-3 pt-1">
					<div className="flex items-center justify-between">
						<TriageBadge color={snapshot.triage?.final ?? null} />
						<StatusPill tone={picked ? "ok" : "info"}>
							{picked ? "Patient on board" : "On the way"}
						</StatusPill>
					</div>

					{snapshot.symptoms.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{snapshot.symptoms.map((x) => (
								<span
									className="rounded-full bg-muted px-2.5 py-1 font-medium text-xs"
									key={x}
								>
									{x}
								</span>
							))}
						</div>
					) : null}

					<section className="rounded-3xl bg-muted p-3.5">
						<div className="mb-2 flex items-center justify-between">
							<h3 className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
								Vitals
							</h3>
							<button
								className="flex items-center gap-1 font-semibold text-brand-deep text-xs"
								onClick={() => setDraft(PRESET)}
								type="button"
							>
								<Zap className="size-3.5" /> Cardiac sample
							</button>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{FIELDS.map((k) => {
								const tone = vitalTone(k, num(draft[k]));
								return (
									<label
										className={cn(
											"rounded-2xl p-2.5",
											VITAL_TONE_CLASS[tone].soft,
										)}
										key={k}
									>
										<span className="block font-semibold text-[10px] text-muted-foreground uppercase">
											{VITAL_META[k].label} ({VITAL_META[k].unit})
										</span>
										<input
											className={cn(
												"mt-1 w-full bg-transparent font-bold text-xl outline-none placeholder:font-normal placeholder:text-sm",
												VITAL_TONE_CLASS[tone].text,
											)}
											inputMode="numeric"
											onChange={(e) =>
												setDraft({
													...draft,
													[k]: e.target.value.replace(/[^0-9]/g, ""),
												})
											}
											placeholder={VITAL_META[k].normal}
											value={draft[k]}
										/>
									</label>
								);
							})}
						</div>
						<div className="mt-2 flex gap-1.5">
							{(Object.keys(CONSCIOUSNESS) as Consciousness[]).map((c) => (
								<button
									className={cn(
										"flex-1 rounded-xl border px-1.5 py-2 font-semibold text-[11px]",
										consciousness === c
											? "border-transparent bg-brand text-brand-foreground"
											: "border-border bg-card text-muted-foreground",
									)}
									key={c}
									onClick={() => setConsciousness(c)}
									type="button"
								>
									{CONSCIOUSNESS[c].label}
								</button>
							))}
						</div>
						<ActionButton className="mt-3 w-full" onClick={submit}>
							<Send className="size-4" /> Send to ER
						</ActionButton>
						{playAs === "helper" && picked && !last ? (
							<p className="mt-2 text-center text-brand-deep text-xs">
								Your turn: record the vitals.
							</p>
						) : null}
					</section>

					{last ? (
						<p className="text-center text-muted-foreground text-xs">
							Last sent: HR {last.heartRate ?? "–"} · BP {last.systolic ?? "–"}/
							{last.diastolic ?? "–"} · SpO2 {last.spo2 ?? "–"}
						</p>
					) : null}

					<section className="rounded-3xl bg-muted p-3.5">
						<h3 className="mb-2 flex items-center gap-1.5 font-bold text-muted-foreground text-xs uppercase tracking-wider">
							<Hospital className="size-3.5" /> Hospital
						</h3>
						{snapshot.hospital ? (
							<p className="font-semibold text-sm">{snapshot.hospital.name}</p>
						) : snapshot.hospitalRequest ? (
							<p className="text-sm">
								Waiting for {snapshot.hospitalRequest.hospitalName}…
							</p>
						) : (
							<div className="space-y-1.5">
								{(hospitals ?? []).slice(0, 3).map((h) => (
									<button
										className="flex w-full items-center justify-between rounded-2xl bg-card px-3 py-2 text-left text-sm disabled:opacity-40"
										disabled={h.excluded}
										key={h.hospitalId}
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
										type="button"
									>
										<span className="min-w-0 truncate font-medium">
											{h.name}
										</span>
										<span className="ml-2 shrink-0 text-muted-foreground text-xs">
											{Math.round(h.etaMin)} min
										</span>
									</button>
								))}
								{hospitals && hospitals.length === 0 ? (
									<p className="text-muted-foreground text-xs">
										Ranked after symptoms are known.
									</p>
								) : null}
							</div>
						)}
					</section>
				</div>
			)}
		</PhoneFrame>
	);
}
