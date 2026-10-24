import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { distanceKm, FIRST_AID_STEPS, SYMPTOM_TO_FACILITY } from "./lib";
import { llmJson } from "./llm";

// Canonical English codes. All 16 are detectable now (first-aid exists for each).
const KNOWN_SYMPTOMS = Object.keys(SYMPTOM_TO_FACILITY);

// Used only when no LLM is reachable. Works on the ENGLISH transcript.
const SYNONYMS: Record<string, string[]> = {
	"not breathing": [
		"not breathing",
		"stopped breathing",
		"no breathing",
		"isn't breathing",
	],
	unconscious: [
		"unconscious",
		"passed out",
		"fainted",
		"not responding",
		"unresponsive",
	],
	"heavy bleeding": [
		"heavy bleeding",
		"bleeding heavily",
		"lot of blood",
		"bleeding a lot",
	],
	bleeding: ["bleeding", "blood"],
	fracture: [
		"fracture",
		"broken leg",
		"broken arm",
		"leg is broken",
		"arm is broken",
	],
	"chest pain": ["chest pain", "pain in the chest"],
	"heart attack": ["heart attack"],
	drowning: ["drowning", "drowned"],
	burns: ["burn", "burnt", "on fire"],
	seizure: ["seizure", "fits", "convulsion"],
	stroke: ["stroke", "face drooping", "slurred speech"],
	"head injury": [
		"head injury",
		"hit his head",
		"hit her head",
		"head is bleeding",
		"bleeding from his head",
	],
	"spinal injury": ["spine", "back injury", "cannot move his legs"],
	pregnant: ["pregnant", "labour", "labor pains"],
	"snake bite": ["snake", "snakebite"],
	poisoning: ["poison", "swallowed", "overdose"],
};

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

function keywordFallback(text: string): string[] {
	const lower = text.toLowerCase();
	return KNOWN_SYMPTOMS.filter((code) =>
		(SYNONYMS[code] ?? [code]).some((w) => lower.includes(w)),
	);
}

/** Best-effort geocoding of a spoken landmark (OpenStreetMap Nominatim, free, ~1 req/s). */
async function geocode(
	query: string,
): Promise<{ lat: number; lng: number; label: string } | null> {
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: { "User-Agent": "RAKSHA-hackathon-demo/1.0" },
		});
		if (!res.ok) return null;
		const rows = (await res.json()) as {
			lat: string;
			lon: string;
			display_name: string;
		}[];
		if (!rows[0]) return null;
		return {
			lat: Number(rows[0].lat),
			lng: Number(rows[0].lon),
			label: rows[0].display_name,
		};
	} catch {
		return null;
	}
}

export const processIntakeTranscript = action({
	args: {
		sessionId: v.id("sessions"),
		transcript: v.optional(v.string()), // defaults to the session's English transcript
		autoDispatch: v.optional(v.boolean()), // default true
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		extractedSymptoms: string[];
		firstAidGiven: string[];
		locationText: string | null;
	}> => {
		const session: Doc<"sessions"> | null = await ctx.runQuery(
			internal.triageAgentQueries.getSessionForTriage,
			{ sessionId: args.sessionId },
		);
		if (!session) throw new Error("Session not found");

		const text = (
			args.transcript ??
			session.transcriptEnglish ??
			session.transcript ??
			""
		).trim();
		if (!text) {
			return {
				extractedSymptoms: session.extractedSymptoms ?? [],
				firstAidGiven: session.firstAidGiven ?? [],
				locationText: null,
			};
		}

		const prompt = `You are an emergency intake assistant listening to a live ambulance-helpline call. The transcript below is in English (it may be a translation of Hindi, Kannada or another language).

Allowed symptom codes (use ONLY these exact strings):
${KNOWN_SYMPTOMS.map((s) => `- ${s}`).join("\n")}

Transcript so far:
"""
${text}
"""

Return ONLY JSON in this exact shape:
{"symptoms": [codes clearly indicated by the transcript, empty array if none], "locationText": "landmark or address the caller mentioned, or null"}
Do not guess symptoms that are not clearly stated.`;

		const raw = (await llmJson(prompt)) as {
			symptoms?: unknown;
			locationText?: unknown;
		} | null;

		let fromLlm: string[];
		if (raw && Array.isArray(raw.symptoms)) {
			fromLlm = raw.symptoms.filter(
				(s): s is string => typeof s === "string" && KNOWN_SYMPTOMS.includes(s),
			);
		} else {
			fromLlm = keywordFallback(text);
		}
		const locationText =
			raw && typeof raw.locationText === "string" && raw.locationText.trim()
				? raw.locationText.trim()
				: null;

		// Never forget a symptom that was detected earlier in the call.
		const previous = session.extractedSymptoms ?? [];
		const merged = unique([...previous, ...fromLlm]);
		const firstAidGiven = unique(
			merged.flatMap((s) => FIRST_AID_STEPS[s] ?? []),
		);

		await ctx.runMutation(internal.sessions.applyIntakeResult, {
			sessionId: args.sessionId,
			transcript: text,
			extractedSymptoms: merged,
			firstAidGiven,
		});

		// Location from speech, only if nothing better (pin / caller link) is set.
		if (
			locationText &&
			(!session.incidentLocationSource ||
				session.incidentLocationSource === "default")
		) {
			const cityName =
				session.city === "kalaburagi"
					? "Kalaburagi"
					: session.city === "bengaluru"
						? "Bengaluru"
						: "";
			const hit = await geocode(`${locationText} ${cityName}`.trim());
			if (
				hit &&
				distanceKm(
					hit.lat,
					hit.lng,
					session.incidentLat,
					session.incidentLng,
				) <= 60
			) {
				await ctx.runMutation(api.sessions.setLocation, {
					sessionId: args.sessionId,
					lat: hit.lat,
					lng: hit.lng,
					source: "transcript",
					addressGuess: hit.label,
					actor: "Intake Agent",
					role: "system",
				});
			}
		}

		// Triage and dispatch run IN PARALLEL. Dispatch does not wait for the LLM triage,
		// because safety rules already set a floor color inside applyIntakeResult.
		const symptomsChanged = merged.length !== previous.length;
		const canStartDispatch =
			args.autoDispatch !== false &&
			(session.status === "created" ||
				session.status === "first_aid_in_progress") &&
			!session.assignedAmbulanceId &&
			(merged.length > 0 || text.split(/\s+/).length >= 25);

		const jobs: Promise<unknown>[] = [];
		if (symptomsChanged || !session.aiTriageColor) {
			jobs.push(
				ctx.runAction(api.triageAgent.runTriageAgent, {
					sessionId: args.sessionId,
				}),
			);
		}
		if (canStartDispatch) {
			jobs.push(
				ctx.runMutation(api.dispatch.requestDispatch, {
					sessionId: args.sessionId,
					mode: "auto",
					actor: "Intake Agent",
					role: "system",
				}),
			);
		}
		const results = await Promise.allSettled(jobs);
		for (const r of results) {
			if (r.status === "rejected")
				console.error("Intake follow-up failed:", r.reason);
		}

		return { extractedSymptoms: merged, firstAidGiven, locationText };
	},
});
