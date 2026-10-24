"use client";

import { usePathname } from "next/navigation";
import {
	NAV_BY_KEY,
	type NavItem,
	type RoleKey,
	roleOfView,
	type ViewKey,
	viewFromPath,
} from "@/lib/roles";

export interface RoleInfo {
	view: ViewKey | null;
	/** The acting role for role screens. null on the audit and lab screens. */
	role: RoleKey | null;
	nav: NavItem | null;
}

/** Which screen (and so which role) the user is on, taken from the URL. */
export function useRole(): RoleInfo {
	const pathname = usePathname();
	const view = viewFromPath(pathname);
	return {
		view,
		role: view ? roleOfView(view) : null,
		nav: view ? NAV_BY_KEY[view] : null,
	};
}
