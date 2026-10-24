"use client";

import { useQuery } from "convex/react";
import { Hammer } from "lucide-react";
import { GlowCard } from "@/components/effects/GlowCard";
import { Reveal } from "@/components/effects/Reveal";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useRole } from "@/hooks/useRole";
import { api } from "@/lib/convex";
import { describeTriageSource } from "@/lib/triage";

/** Temporary body for each role screen until its dashboard lands in the next batch. Proves the live data path. */
export function RolePlaceholder() {
	const { nav } = useRole();
	const { sessionId, snapshot, viewerRole } = useActiveSession();
	const transcript = useQuery(
		api.views.getTranscriptFeed,
		sessionId ? { sessionId } : "skip",
	);
	const Icon = nav?.icon ?? Hammer;

	return (
		<Reveal className="grid gap-3 lg:grid-cols-2">
			<GlowCard className="rounded-[2rem] p-6" data-reveal>
				<span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
					<Icon className="size-6" />
				</span>
				<h2 className="mt-4 font-bold text-xl">{nav?.label} dashboard</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					The shell, live feed and role redaction are wired. This screen&apos;s
					controls arrive in the next batch.
				</p>
				<p className="mt-4 text-muted-foreground text-xs">
					Viewing as{" "}
					<span className="font-semibold text-foreground">{viewerRole}</span>
				</p>
			</GlowCard>

			<GlowCard className="rounded-[2rem] p-6" data-reveal>
				<h3 className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
					Live snapshot
				</h3>
				{snapshot ? (
					<dl className="mt-3 space-y-2 text-sm">
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Status</dt>
							<dd className="font-semibold">{snapshot.session.status}</dd>
						</div>
						<div className="flex items-center justify-between gap-4">
							<dt className="text-muted-foreground">Triage</dt>
							<dd className="flex items-center gap-2">
								{snapshot.triage ? (
									<>
										<TriageBadge color={snapshot.triage.final} />
										<span className="text-muted-foreground text-xs">
											{describeTriageSource(snapshot.triage.setBy).label}
										</span>
									</>
								) : (
									<span className="text-muted-foreground">
										hidden or pending
									</span>
								)}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Transcript lines</dt>
							<dd className="font-semibold">{transcript?.length ?? 0}</dd>
						</div>
					</dl>
				) : (
					<p className="mt-3 text-muted-foreground text-sm">
						No active session. Start one from the home screen.
					</p>
				)}
			</GlowCard>
		</Reveal>
	);
}
