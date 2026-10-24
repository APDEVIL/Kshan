"use client";

import Link from "next/link";
import { useRole } from "@/hooks/useRole";
import { NAV } from "@/lib/roles";
import { cn } from "@/lib/utils";

/** Compact role switcher for screens too narrow for the sidebar. */
export function RoleSwitcher({ className }: { className?: string }) {
	const { view } = useRole();
	return (
		<nav
			aria-label="Switch role"
			className={cn("k-scroll flex gap-1.5 overflow-x-auto pb-1", className)}
		>
			{NAV.map((item) => {
				const Icon = item.icon;
				const active = view === item.key;
				return (
					<Link
						className={cn(
							"flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 font-medium text-sm transition-colors",
							active
								? "border-transparent bg-brand text-brand-foreground"
								: "border-border bg-card text-muted-foreground hover:text-foreground",
						)}
						href={item.href}
						key={item.key}
					>
						<Icon className="size-4" />
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
