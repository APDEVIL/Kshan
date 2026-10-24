"use client";

import Link from "next/link";
import { Reveal } from "@/components/effects/Reveal";
import { ThemeToggle } from "@/components/effects/ThemeToggle";
import { ScenarioLauncher } from "@/components/lab/ScenarioLauncher";
import { Wordmark } from "@/components/shell/Wordmark";
import { BRAND } from "@/lib/brand";

export function HomeScreen() {
	return (
		<div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-6 lg:p-10">
			<header className="flex items-center justify-between">
				<Wordmark />
				<ThemeToggle />
			</header>

			<Reveal className="flex flex-col gap-3 py-6">
				<p
					className="font-bold text-brand-deep text-sm uppercase tracking-wider"
					data-reveal
				>
					{BRAND.native} · {BRAND.tagline}
				</p>
				<h1
					className="max-w-3xl font-extrabold text-4xl leading-tight lg:text-6xl"
					data-reveal
				>
					One emergency call. Every role, in sync.
				</h1>
				<p className="max-w-2xl text-lg text-muted-foreground" data-reveal>
					{BRAND.description} Pick the part you want to play. The rest of the
					crew plays itself.
				</p>
			</Reveal>

			<ScenarioLauncher redirect />

			<p className="text-muted-foreground text-sm">
				Prefer to look around first?{" "}
				<Link
					className="font-semibold text-brand-deep underline-offset-2 hover:underline"
					href="/ero"
				>
					Open the control room
				</Link>
			</p>
		</div>
	);
}
