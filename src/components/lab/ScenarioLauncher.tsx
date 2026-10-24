"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GlowCard } from "@/components/effects/GlowCard";
import { Reveal } from "@/components/effects/Reveal";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { api } from "@/lib/convex";
import { ROLE_NAV, type RoleKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

/** Pick a scripted emergency and the role you want to play. The crew plays everything else. */
export function ScenarioLauncher({ redirect = false }: { redirect?: boolean }) {
	const scenarios = useQuery(api.scenario.listScenarios, {});
	const start = useMutation(api.scenario.startScenario);
	const { setSessionId, playAs, setPlayAs } = useSessionContext();
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);

	const run = async (key: string) => {
		setBusy(key);
		try {
			const res = await start({
				scenario: key,
				autoPlay: true,
				...(playAs ? { playAs } : {}),
			});
			setSessionId(res.sessionId);
			toast.success("Emergency call started");
			if (redirect) {
				const target = ROLE_NAV.find((n) => n.role === (playAs ?? "ero"));
				router.push(target?.href ?? "/ero");
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not start the scenario",
			);
		} finally {
			setBusy(null);
		}
	};

	return (
		<Reveal className="grid gap-3 lg:grid-cols-2">
			<GlowCard className="rounded-[2rem] p-6" data-reveal>
				<h2 className="font-bold text-lg">1. Choose your role</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					You act as this role. The simulated crew plays the others.
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<RoleChip
						active={playAs === null}
						label="Just watch"
						onClick={() => setPlayAs(null)}
					/>
					{ROLE_NAV.map((n) => (
						<RoleChip
							active={playAs === n.role}
							key={n.key}
							label={n.label}
							onClick={() => setPlayAs(n.role as RoleKey)}
						/>
					))}
				</div>
			</GlowCard>

			<GlowCard className="rounded-[2rem] p-6" data-reveal>
				<h2 className="font-bold text-lg">2. Start an emergency</h2>
				<div className="mt-4 space-y-2">
					{scenarios === undefined ? (
						<p className="text-muted-foreground text-sm">Loading scenarios…</p>
					) : (
						scenarios.map((s) => (
							<button
								className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left font-medium text-sm transition-colors hover:border-brand disabled:opacity-60"
								disabled={busy !== null}
								key={s.key}
								onClick={() => run(s.key)}
								type="button"
							>
								<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
									{busy === s.key ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Play className="size-4" />
									)}
								</span>
								<span className="min-w-0 flex-1 truncate">{s.label}</span>
							</button>
						))
					)}
				</div>
			</GlowCard>
		</Reveal>
	);
}

function RoleChip({
	active,
	onClick,
	label,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			className={cn(
				"rounded-full border px-3.5 py-2 font-medium text-sm transition-colors",
				active
					? "border-transparent bg-brand text-brand-foreground"
					: "border-border bg-card text-muted-foreground hover:text-foreground",
			)}
			onClick={onClick}
			type="button"
		>
			{label}
		</button>
	);
}
