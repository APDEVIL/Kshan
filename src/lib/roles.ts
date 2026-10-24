// Who can open which screen. Permissions come from the backend (convex/lib.ts), so UI and server agree.
import {
	Ambulance,
	ClipboardList,
	FlaskConical,
	Headset,
	HeartPulse,
	Hospital,
	type LucideIcon,
	Stethoscope,
	TrafficCone,
} from "lucide-react";
import type { Action, Role } from "../../convex/lib";
import { can } from "../../convex/lib";

export type RoleKey = Extract<
	Role,
	"ero" | "driver" | "helper" | "er_head" | "doctor" | "outpost"
>;
export type ViewKey = RoleKey | "audit" | "lab";

export interface NavItem {
	key: ViewKey;
	label: string;
	href: string;
	icon: LucideIcon;
	blurb: string;
	device: "desktop" | "phone";
	group: "roles" | "tools";
	role?: RoleKey;
}

export const NAV: NavItem[] = [
	{
		key: "ero",
		label: "Control Room",
		href: "/ero",
		icon: Headset,
		blurb: "Emergency Response Officer: triage, dispatch and green corridor.",
		device: "desktop",
		group: "roles",
		role: "ero",
	},
	{
		key: "driver",
		label: "Ambulance Driver",
		href: "/driver",
		icon: Ambulance,
		blurb: "Accept the job, follow the route, hand over the patient.",
		device: "phone",
		group: "roles",
		role: "driver",
	},
	{
		key: "helper",
		label: "Ambulance Helper",
		href: "/helper",
		icon: HeartPulse,
		blurb: "Record vitals, identify the patient, pick the hospital.",
		device: "phone",
		group: "roles",
		role: "helper",
	},
	{
		key: "er_head",
		label: "ER Head",
		href: "/erhead",
		icon: Hospital,
		blurb: "Accept the pre-alert, confirm the bed, assign the doctor.",
		device: "desktop",
		group: "roles",
		role: "er_head",
	},
	{
		key: "doctor",
		label: "Emergency Doctor",
		href: "/doctor",
		icon: Stethoscope,
		blurb: "See the patient early: vitals, history, triage.",
		device: "desktop",
		group: "roles",
		role: "doctor",
	},
	{
		key: "outpost",
		label: "Traffic Outpost",
		href: "/outpost",
		icon: TrafficCone,
		blurb: "Approve the green corridor along the ambulance route.",
		device: "desktop",
		group: "roles",
		role: "outpost",
	},
	{
		key: "audit",
		label: "Audit & Metrics",
		href: "/audit",
		icon: ClipboardList,
		blurb: "AI suggestion versus human decision, plus response times.",
		device: "desktop",
		group: "tools",
	},
	{
		key: "lab",
		label: "Simulation Lab",
		href: "/lab",
		icon: FlaskConical,
		blurb: "Run scenarios and drive the simulated hardware.",
		device: "desktop",
		group: "tools",
	},
];

export const ROLE_NAV: NavItem[] = NAV.filter((n) => n.group === "roles");
export const TOOL_NAV: NavItem[] = NAV.filter((n) => n.group === "tools");

export const NAV_BY_KEY = Object.fromEntries(
	NAV.map((n) => [n.key, n]),
) as Record<ViewKey, NavItem>;

/** Name written to the audit log when this role acts without a named person. */
export const ACTOR_NAME: Record<RoleKey, string> = {
	ero: "ERO Desk",
	driver: "Driver",
	helper: "Helper",
	er_head: "ER Head",
	doctor: "ER Doctor",
	outpost: "Outpost Officer",
};

export function viewFromPath(pathname: string): ViewKey | null {
	const hit = NAV.find(
		(n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
	);
	return hit?.key ?? null;
}

export function roleOfView(key: ViewKey): RoleKey | null {
	return NAV_BY_KEY[key].role ?? null;
}

export function isRoleKey(value: string): value is RoleKey {
	return ROLE_NAV.some((n) => n.role === value);
}

/** Use to hide buttons. The server still enforces the same rule. */
export function canRole(role: RoleKey, action: Action): boolean {
	return can(role, action);
}
