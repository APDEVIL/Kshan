// Product identity. Swap logoSrc once public/logo.png exists.

export const BRAND = {
	name: "Kshan",
	native: "क्षण", // "a moment"
	tagline: "Every moment counts",
	description:
		"AI-coordinated ambulance dispatch, triage and hospital readiness.",
	logoSrc: "/logo.png",
} as const;

// Mirrors the CSS tokens in globals.css (used where a hex is needed, e.g. the map).
export const BRAND_COLORS = {
	lime: "#7ac70c",
	limeDeep: "#4f8f00",
	limeSoft: "#e9f7cf",
	ink: "#17261c",
	inkSoft: "#22352a",
	paper: "#f3f5f0",
} as const;
