// Small formatting helpers shared by all screens.

export function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

/** 125 -> "2m 05s", 42 -> "42s". */
export function formatDuration(
	totalSeconds: number | null | undefined,
): string {
	if (
		totalSeconds === null ||
		totalSeconds === undefined ||
		!Number.isFinite(totalSeconds)
	)
		return "–";
	const s = Math.max(0, Math.round(totalSeconds));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return m === 0 ? `${r}s` : `${m}m ${String(r).padStart(2, "0")}s`;
}

/** ETA for people: "Arrived", "<1 min", "7 min". */
export function formatEta(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined) return "–";
	if (seconds <= 0) return "Arrived";
	if (seconds < 60) return "<1 min";
	return `${Math.round(seconds / 60)} min`;
}

/** Milliseconds as seconds with one decimal: 16040 -> "16.0 s". */
export function formatSecondsTenths(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return "–";
	return `${(ms / 1000).toFixed(1)} s`;
}

export function formatClock(ms: number): string {
	return new Date(ms).toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

export function timeAgo(ms: number, now: number = Date.now()): string {
	const s = Math.max(0, Math.round((now - ms) / 1000));
	if (s < 5) return "just now";
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

export function formatKm(km: number): string {
	return `${km.toFixed(1)} km`;
}

export function formatMeters(m: number): string {
	return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function titleCase(s: string): string {
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "en_route_to_hospital" -> "En route to hospital". */
export function snakeToWords(s: string): string {
	const words = s.replace(/_/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function initials(name: string): string {
	const parts = name
		.replace(/^dr\.?\s+/i, "")
		.trim()
		.split(/\s+/);
	return parts
		.slice(0, 2)
		.map((p) => p.charAt(0).toUpperCase())
		.join("");
}

/** Drivers do not need full phone numbers: "9845011223" -> "98••••223". */
export function maskPhone(phone?: string | null): string {
	if (!phone) return "–";
	const d = phone.replace(/\D/g, "");
	if (d.length < 6) return "••••";
	return `${d.slice(0, 2)}••••${d.slice(-3)}`;
}

export function shortId(id: string, n = 6): string {
	return id.slice(-n).toUpperCase();
}

export function pluralize(
	count: number,
	one: string,
	many: string = `${one}s`,
): string {
	return count === 1 ? one : many;
}

/* ---------------- languages ---------------- */

export interface LanguageOption {
	code: string; // what the backend stores
	name: string; // English name
	native: string; // shown in the UI
	speechLang: string; // BCP-47 for the browser Web Speech API
}

export const LANGUAGES: LanguageOption[] = [
	{ code: "en", name: "English", native: "English", speechLang: "en-IN" },
	{ code: "hi", name: "Hindi", native: "हिन्दी", speechLang: "hi-IN" },
	{ code: "kn", name: "Kannada", native: "ಕನ್ನಡ", speechLang: "kn-IN" },
	{ code: "ta", name: "Tamil", native: "தமிழ்", speechLang: "ta-IN" },
	{ code: "te", name: "Telugu", native: "తెలుగు", speechLang: "te-IN" },
	{ code: "ml", name: "Malayalam", native: "മലയാളം", speechLang: "ml-IN" },
	{ code: "mr", name: "Marathi", native: "मराठी", speechLang: "mr-IN" },
	{ code: "bn", name: "Bengali", native: "বাংলা", speechLang: "bn-IN" },
	{ code: "gu", name: "Gujarati", native: "ગુજરાતી", speechLang: "gu-IN" },
	{ code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", speechLang: "pa-IN" },
	{ code: "ur", name: "Urdu", native: "اردو", speechLang: "ur-IN" },
];

export function languageLabel(code?: string | null): string {
	if (!code) return "Unknown";
	const hit = LANGUAGES.find((l) => l.code === code);
	return hit ? hit.native : code.toUpperCase();
}
