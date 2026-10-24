import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { llmJson } from "./llm";

// The LLM only SUGGESTS. internal.sessions.applyTriageResult raises the color to the
// rule-based safety floor (not breathing, unresponsive, SpO2 < 90 ...) and never
// overwrites a human override.
export const runTriageAgent = action({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args): Promise<{ color: string; reasoning: string }> => {
		const session: Doc<"sessions"> | null = await ctx.runQuery(
			internal.triageAgentQueries.getSessionForTriage,
			{ sessionId: args.sessionId },
		);
		if (!session) throw new Error("Session not found");

		const vitalsList: Doc<"vitalsLog">[] = await ctx.runQuery(
			internal.triageAgentQueries.getLatestVitals,
			{
				sessionId: args.sessionId,
			},
		);
		const vit = vitalsList[0] ?? null;

		const doctors: Doc<"doctors">[] = session.assignedHospitalId
			? await ctx.runQuery(internal.triageAgentQueries.getDoctorsForHospital, {
					hospitalId: session.assignedHospitalId,
				})
			: [];

		const prompt = `You are an emergency triage assistant supporting (not replacing) the clinicians. Propose a triage color and explain in 1-2 short sentences a doctor can sanity-check.

Colors:
- red = immediate life threat, needs care within minutes
- yellow = urgent, can wait briefly
- green = non-critical

Call transcript (English): "${session.transcriptEnglish ?? session.transcript ?? "Not available"}"
Detected symptoms: ${(session.extractedSymptoms ?? []).join(", ") || "none recorded"}
Safety rules already triggered: ${(session.redFlagReasons ?? []).join("; ") || "none"}
Latest vitals: ${
			vit
				? `HR ${vit.heartRate ?? "?"} bpm, BP ${vit.bloodPressureSystolic ?? "?"}/${vit.bloodPressureDiastolic ?? "?"}, SpO2 ${vit.spo2 ?? "?"}%, consciousness ${vit.consciousness ?? "?"}`
				: "not recorded yet"
		}
Doctor specialties at the receiving hospital: ${doctors.map((d) => d.specialty).join(", ") || "not known yet"}

Return ONLY JSON: {"color": "red" | "yellow" | "green", "reasoning": "short explanation", "preferredSpecialty": "specialty or null"}`;

		const raw = (await llmJson(prompt)) as {
			color?: unknown;
			reasoning?: unknown;
			preferredSpecialty?: unknown;
		} | null;

		let color: "red" | "yellow" | "green" = "yellow";
		let reasoning =
			"AI unavailable. Safety rules applied. Please assess manually.";
		let preferredSpecialty: string | null = null;

		if (raw) {
			if (
				raw.color === "red" ||
				raw.color === "yellow" ||
				raw.color === "green"
			)
				color = raw.color;
			if (typeof raw.reasoning === "string" && raw.reasoning.trim())
				reasoning = raw.reasoning.trim();
			if (typeof raw.preferredSpecialty === "string")
				preferredSpecialty = raw.preferredSpecialty;
		}

		const wanted = preferredSpecialty?.toLowerCase();
		const matchedDoctor =
			doctors.find(
				(d) =>
					wanted && d.specialty.toLowerCase().includes(wanted) && d.available,
			) ?? doctors.find((d) => d.available);

		await ctx.runMutation(internal.sessions.applyTriageResult, {
			sessionId: args.sessionId,
			aiTriageColor: color,
			aiTriageReasoning: reasoning,
			assignedDoctorId: matchedDoctor?._id,
		});

		return { color, reasoning };
	},
});
