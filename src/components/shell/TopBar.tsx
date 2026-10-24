"use client";

import { ThemeToggle } from "@/components/effects/ThemeToggle";
import { DispatchTimer } from "@/components/panels/DispatchTimer";
import { StatusPill } from "@/components/shared/StatusPill";
import { Wordmark } from "@/components/shell/Wordmark";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useRole } from "@/hooks/useRole";
import { sessionStatusMeta } from "@/lib/status";

export function TopBar() {
	const { nav } = useRole();
	const { snapshot } = useActiveSession();
	const Icon = nav?.icon;
	const meta = snapshot ? sessionStatusMeta(snapshot.session.status) : null;

	return (
		<header className="bento flex items-center gap-4 rounded-[1.75rem] px-5 py-3">
			<div className="flex min-w-0 items-center gap-3">
				{Icon ? (
					<span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
						<Icon className="size-5" />
					</span>
				) : (
					<Wordmark />
				)}
				<div className="min-w-0">
					<h1 className="truncate font-bold text-lg leading-tight">
						{nav?.label ?? "Kshan"}
					</h1>
					<p className="hidden truncate text-muted-foreground text-xs md:block">
						{nav?.blurb}
					</p>
				</div>
			</div>

			<div className="ml-auto flex items-center gap-3">
				{snapshot ? (
					<DispatchTimer
						className="hidden sm:flex"
						closedAt={snapshot.session.closedAt}
						createdAt={snapshot.session.createdAt}
						dispatchedAt={snapshot.session.dispatchedAt}
					/>
				) : null}
				{meta ? (
					<StatusPill
						pulse={snapshot?.session.status !== "closed"}
						tone={meta.tone}
					>
						{meta.label}
					</StatusPill>
				) : (
					<StatusPill tone="neutral">No active session</StatusPill>
				)}
				<ThemeToggle />
			</div>
		</header>
	);
}
