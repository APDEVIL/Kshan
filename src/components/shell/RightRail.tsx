"use client";

import { useQuery } from "convex/react";
import { Activity, Bot, UserCheck } from "lucide-react";
import Link from "next/link";
import { GlowCard } from "@/components/effects/GlowCard";
import { EventTimeline } from "@/components/panels/EventTimeline";
import { StatusStepper } from "@/components/panels/StatusStepper";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { LiveDot } from "@/components/shared/LiveDot";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useRole } from "@/hooks/useRole";
import { api } from "@/lib/convex";
import { shortId } from "@/lib/format";
import { NAV_BY_KEY } from "@/lib/roles";
import { sessionStatusMeta } from "@/lib/status";
import { describeTriageSource } from "@/lib/triage";

/** Dark right-hand panel: who you are, mission progress, AI versus human decision, and the live feed. */
export function RightRail() {
	const { nav, role } = useRole();
	const { playAs } = useSessionContext();
	const { sessionId, snapshot, viewerRole } = useActiveSession();
	const events = useQuery(
		api.views.getSessionFeed,
		sessionId ? { sessionId, role: viewerRole, limit: 60 } : "skip",
	);

	const Icon = nav?.icon ?? Activity;
	const triage = snapshot?.triage ?? null;
	const source = describeTriageSource(triage?.setBy);
	const meta = snapshot ? sessionStatusMeta(snapshot.session.status) : null;

	return (
		<aside className="hidden w-[22rem] shrink-0 xl:block">
			<GlowCard
				className="flex h-full flex-col gap-5 overflow-hidden rounded-[2rem] p-5"
				tone="dark"
			>
				{/* who am I */}
				<div className="flex items-center gap-3">
					<span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground ring-4 ring-brand/25">
						<Icon className="size-6" />
					</span>
					<div className="min-w-0">
						<p className="truncate font-bold text-lg leading-tight">
							{nav?.label ?? "Kshan"}
						</p>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							<span className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-0.5 font-semibold text-[11px] text-brand">
								<LiveDot className="size-2" />
								{role ? "Live view" : "Live"}
							</span>
							{playAs ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-triage-yellow/20 px-2.5 py-0.5 font-semibold text-[11px] text-triage-yellow">
									<UserCheck className="size-3" />
									You play: {NAV_BY_KEY[playAs].label}
								</span>
							) : null}
						</div>
					</div>
				</div>

				{/* mission */}
				<section className="rounded-3xl bg-rail-2 p-4">
					<div className="flex items-baseline justify-between">
						<h2 className="font-bold text-rail-muted text-xs uppercase tracking-wider">
							Mission
						</h2>
						{snapshot ? (
							<span className="font-mono text-[11px] text-rail-muted">
								#{shortId(snapshot.session._id)} ·{" "}
								{snapshot.session.city ?? "–"}
							</span>
						) : null}
					</div>
					{snapshot && meta ? (
						<>
							<p className="mt-2 mb-4 font-semibold text-base">{meta.label}</p>
							<StatusStepper status={snapshot.session.status} />
						</>
					) : (
						<p className="mt-2 text-rail-muted text-sm">
							No active session.{" "}
							<Link
								className="font-semibold text-brand underline-offset-2 hover:underline"
								href="/"
							>
								Start a demo
							</Link>
						</p>
					)}
				</section>

				{/* human in the loop */}
				{triage ? (
					<section className="rounded-3xl bg-rail-2 p-4">
						<h2 className="mb-3 font-bold text-rail-muted text-xs uppercase tracking-wider">
							Human in the loop
						</h2>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<p className="mb-1.5 flex items-center gap-1 text-[11px] text-rail-muted">
									<Bot className="size-3.5" /> AI suggested
								</p>
								<TriageBadge color={triage.ai} />
							</div>
							<div>
								<p className="mb-1.5 flex items-center gap-1 text-[11px] text-rail-muted">
									<UserCheck className="size-3.5" /> Final decision
								</p>
								<TriageBadge color={triage.final} />
							</div>
						</div>
						<p className="mt-3 text-[11px] text-rail-muted leading-snug">
							{triage.final
								? `Set by ${source.label}${triage.overridden ? ". A human overrode the AI." : "."}`
								: "Waiting for triage."}
						</p>
					</section>
				) : null}

				{/* live feed */}
				<section className="flex min-h-0 flex-1 flex-col">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-bold text-rail-muted text-xs uppercase tracking-wider">
							Live feed
						</h2>
						<LiveDot className="size-2" />
					</div>
					<div className="k-scroll -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
						<EventTimeline
							emptyText="Events appear here as the emergency unfolds."
							events={sessionId ? events : []}
						/>
					</div>
				</section>
			</GlowCard>
		</aside>
	);
}
