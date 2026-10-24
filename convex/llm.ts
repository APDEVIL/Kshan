// Shared LLM helpers. Plain fetch, works in both Convex runtimes.
// Gemini first (free tier), Groq Llama as fallback. Models can be overridden with env vars:
//   GEMINI_MODEL, GROQ_LLM_MODEL
// Model names and free limits change often. Verify them in each console.

const geminiModel = () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

// Groq retires chat models often, so ask Groq which models this key can use
// instead of hard-coding one. Override with GROQ_LLM_MODEL if you want a specific one.
const GROQ_PREFERENCE = [
	"llama-3.3-70b-versatile",
	"llama-3.1-8b-instant",
	"openai/gpt-oss-20b",
	"openai/gpt-oss-120b",
	"qwen/qwen3-32b",
	"meta-llama/llama-4-scout-17b-16e-instruct",
];
let cachedGroqModel: string | null = null;

async function resolveGroqModel(key: string): Promise<string> {
	if (process.env.GROQ_LLM_MODEL) return process.env.GROQ_LLM_MODEL;
	if (cachedGroqModel) return cachedGroqModel;
	const res = await fetchRetry(
		"https://api.groq.com/openai/v1/models",
		{ headers: { Authorization: `Bearer ${key}` } },
		2,
	);
	const data = (await res.json()) as { data?: { id: string }[] };
	const ids = (data.data ?? []).map((m) => m.id);
	const pick =
		GROQ_PREFERENCE.find((p) => ids.includes(p)) ??
		ids.find(
			(id) => !/whisper|tts|guard|safeguard|orpheus|compound|embed/i.test(id),
		);
	if (!pick)
		throw new Error("No usable Groq chat model found for this API key");
	cachedGroqModel = pick;
	return pick;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** fetch with retry on network errors, 429 and 5xx. 4xx (other than 429) fails fast. */
async function fetchRetry(
	url: string,
	init: RequestInit,
	tries = 3,
): Promise<Response> {
	let last: unknown = new Error("request failed");
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url, init);
			if (res.ok) return res;
			const body = await res.text();
			const err = new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
			if (res.status !== 429 && res.status < 500)
				throw Object.assign(err, { fatal: true });
			last = err;
		} catch (e) {
			if (e instanceof Error && (e as Error & { fatal?: boolean }).fatal)
				throw e;
			last = e;
		}
		await sleep(600 * (i + 1) * (i + 1));
	}
	throw last instanceof Error ? last : new Error("request failed");
}

function parseJson(text: string): unknown {
	const cleaned = text.replace(/```json|```/g, "").trim();
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	return JSON.parse(
		start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned,
	);
}

async function geminiJson(prompt: string): Promise<unknown> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error("GEMINI_API_KEY is not set");
	const res = await fetchRetry(
		`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", "x-goog-api-key": key },
			body: JSON.stringify({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
				},
			}),
		},
	);
	const data = (await res.json()) as {
		candidates?: { content?: { parts?: { text?: string }[] } }[];
	};
	const text = (data.candidates?.[0]?.content?.parts ?? [])
		.map((p) => p.text ?? "")
		.join("");
	return parseJson(text);
}

async function groqJson(prompt: string): Promise<unknown> {
	const key = process.env.GROQ_API_KEY;
	if (!key) throw new Error("GROQ_API_KEY is not set");
	const res = await fetchRetry(
		"https://api.groq.com/openai/v1/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key}`,
			},
			body: JSON.stringify({
				model: await resolveGroqModel(key),
				temperature: 0.1,
				response_format: { type: "json_object" },
				messages: [{ role: "user", content: prompt }],
			}),
		},
	);
	const data = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	return parseJson(data.choices?.[0]?.message?.content ?? "");
}

/** JSON answer from the LLM. Tries Gemini, then Groq. Returns null if both fail. */
export async function llmJson(prompt: string): Promise<unknown | null> {
	try {
		return await geminiJson(prompt);
	} catch (err) {
		console.error("Gemini failed, trying Groq:", err);
	}
	try {
		return await groqJson(prompt);
	} catch (err) {
		console.error("Groq LLM failed too:", err);
	}
	return null;
}
