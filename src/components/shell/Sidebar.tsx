"use client";

import { motion } from "framer-motion";
import { Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { GlowCard } from "@/components/effects/GlowCard";
import { MagneticButton } from "@/components/effects/MagneticButton";
import { Wordmark } from "@/components/shell/Wordmark";
import { useRole } from "@/hooks/useRole";
import { type NavItem, ROLE_NAV, TOOL_NAV } from "@/lib/roles";
import { cn } from "@/lib/utils";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
	const Icon = item.icon;
	return (
		<Link
			className={cn(
				"group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
				active
					? "bg-brand-soft font-semibold text-foreground"
					: "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
			href={item.href}
		>
			<Icon
				className={cn("size-5 shrink-0", active ? "text-brand-deep" : "")}
			/>
			<span className="truncate">{item.label}</span>
			{item.device === "phone" ? (
				<Smartphone
					aria-label="Phone screen"
					className="ml-auto size-3.5 opacity-40"
				/>
			) : null}
			{active ? (
				<motion.span
					className="absolute top-2 right-0 bottom-2 w-1 rounded-full bg-brand"
					layoutId="nav-bar"
					transition={{ type: "spring", stiffness: 420, damping: 32 }}
				/>
			) : null}
		</Link>
	);
}

export function Sidebar() {
	const { view } = useRole();

	return (
		<aside className="bento hidden w-[15.5rem] shrink-0 flex-col gap-1 overflow-hidden rounded-[2rem] p-3 lg:flex">
			<Link aria-label="Kshan home" className="px-3 pt-3 pb-4" href="/">
				<Wordmark />
			</Link>

			<nav className="k-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
				<p className="px-3 pt-1 pb-1.5 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
					Roles
				</p>
				{ROLE_NAV.map((item) => (
					<NavLink active={view === item.key} item={item} key={item.key} />
				))}

				<div className="my-3 h-px bg-border" />

				<p className="px-3 pb-1.5 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
					Tools
				</p>
				{TOOL_NAV.map((item) => (
					<NavLink active={view === item.key} item={item} key={item.key} />
				))}
			</nav>

			<GlowCard className="mt-2 flex items-end justify-between gap-3 rounded-3xl bg-muted p-4">
				<div>
					<p className="font-bold text-sm leading-tight">Guided demo</p>
					<p className="mt-1 text-muted-foreground text-xs leading-snug">
						Pick a role and walk through a live emergency.
					</p>
				</div>
				<MagneticButton>
					<Link
						aria-label="Start a guided demo"
						className="grid size-11 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-[0_8px_20px_-8px_var(--brand)] transition-transform hover:scale-105"
						href="/"
					>
						<Plus className="size-6" strokeWidth={2.8} />
					</Link>
				</MagneticButton>
			</GlowCard>
		</aside>
	);
}
