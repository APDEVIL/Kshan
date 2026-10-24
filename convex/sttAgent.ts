/// <reference types="node" />
"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { llmJson } from "./llm";

const LANG_CODES: Record<string, string> = {
	english: "en",
	hindi: "hi",
	kannada: "kn",
	tamil: "ta",
	telugu: "te",
	malayalam: "ml",
	marathi: "mr",
	bengali: "bn",
	gujarati: "gu",
	punjabi: "pa",
	urdu: "ur",
	odia: "or",
	assamese: "as",
};

// Whisper tends to invent these when a chunk is silence or noise.
const HALLUCINATIONS = [
	"thank you",
	"thanks for watching",
	"thank you for watching",
	"subtitles by",
	"you",
];

const STT_PROMPT =
	"Emergency call to an ambulance helpline in India. Words like ambulance, accident, chest pain, bleeding, unconscious, not breathing, road, hospital.";

/**
 * One audio chunk -> text. The frontend must send each chunk as a COMPLETE,
 * standalone audio file (start a fresh MediaRecorder per chunk). Slices of one
 * long recording are not decodable on their own.
 */
export const transcribeChunk = action({
	args: {
		sessionId: v.id("sessions"),
		seq: v.number(),
		audioBase64: v.string(),
		mimeType: v.string(),
		languageHint: v.optional(v.string()), // ISO-639-1, e.g. "kn". Omit for auto-detect.
		runIntake: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		text: string;
		english: string;
		language: string;
		skipped: boolean;
	}> => {
		const key = process.env.GROQ_API_KEY;
		if (!key)
			throw new Error(
				"GROQ_API_KEY is not set. Run `npx convex env set GROQ_API_KEY <key>`.",
			);

		const ext = args.mimeType.includes("mp4")
			? "mp4"
			: args.mimeType.includes("ogg")
				? "ogg"
				: args.mimeType.includes("wav")
					? "wav"
					: "webm";
		const bytes = Buffer.from(args.audioBase64, "base64");

		type Verbose = {
			text?: string;
			language?: string;
			segments?: { no_speech_prob?: number }[];
		};
		let data: Verbose | null = null;
		let model = process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo";
		for (let attempt = 0; attempt < 3 && !data; attempt++) {
			const form = new FormData();
			form.append(
				"file",
				new Blob([bytes as unknown as BlobPart], { type: args.mimeType }),
				`chunk.${ext}`,
			);
			form.append("model", model);
			form.append("response_format", "verbose_json");
			form.append("temperature", "0");
			form.append("prompt", STT_PROMPT);
			if (args.languageHint) form.append("language", args.languageHint);

			const res = await fetch(
				"https://api.groq.com/openai/v1/audio/transcriptions",
				{
					method: "POST",
					headers: { Authorization: `Bearer ${key}` },
					body: form,
				},
			);
			if (res.ok) {
				data = (await res.json()) as Verbose;
			} else if (res.status === 429 && attempt < 2) {
				await new Promise<void>((r) => setTimeout(r, 1500));
			} else {
				const body = (await res.text()).slice(0, 200);
				if (
					(res.status === 404 || res.status === 400) &&
					/model/i.test(body) &&
					model !== "whisper-large-v3"
				) {
					model = "whisper-large-v3"; // turbo not available for this key, use the full model
				} else {
					throw new Error(`Groq STT failed: HTTP ${res.status} ${body}`);
				}
			}
		}
		if (!data)
			throw new Error("Groq STT rate limited. Try again in a few seconds.");

		const text = (data.text ?? "").trim();
		const segs = data.segments ?? [];
		const avgNoSpeech = segs.length
			? segs.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) / segs.length
			: 0;
		const langName = (data.language ?? "english").toLowerCase();
		const language =
			LANG_CODES[langName] ?? args.languageHint ?? langName.slice(0, 2);

		const looksEmpty =
			text.length < 2 ||
			avgNoSpeech > 0.7 ||
			HALLUCINATIONS.includes(text.toLowerCase().replace(/[.!?]/g, ""));
		if (looksEmpty) return { text: "", english: "", language, skipped: true };

		let english = text;
		if (language !== "en") {
			const out = (await llmJson(
				`Translate this emergency-call speech to plain English. Keep place names as spoken. Return ONLY JSON: {"english": "<translation>"}\n\nSpeech: """${text}"""`,
			)) as { english?: unknown } | null;
			if (out && typeof out.english === "string" && out.english.trim())
				english = out.english.trim();
		}

		await ctx.runMutation(api.sessions.appendTranscriptChunk, {
			sessionId: args.sessionId,
			seq: args.seq,
			text,
			translatedText: english,
			language,
		});

		// Extract symptoms every 2nd chunk to stay inside free-tier LLM limits.
		if (args.runIntake !== false && args.seq % 2 === 1) {
			await ctx.scheduler.runAfter(0, api.intakeAgent.processIntakeTranscript, {
				sessionId: args.sessionId,
			});
		}

		return { text, english, language, skipped: false };
	},
});
