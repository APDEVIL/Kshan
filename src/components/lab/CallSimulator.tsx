"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Mic, MicOff, PhoneCall, PhoneOff, Send } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ActionButton, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { blobToBase64, useChunkedRecorder } from "@/hooks/useChunkedRecorder";
import { api, type Id } from "@/lib/convex";
import { LANGUAGES } from "@/lib/format";
import { CITY_VIEW, type CityKey } from "@/lib/mapStyle";
import { TIMING } from "@/lib/timing";
import { cn } from "@/lib/utils";

/**
 * A caller's phone. Speak into the microphone and every few seconds of speech is transcribed,
 * translated, and turned into symptoms, triage and an ambulance dispatch.
 */
export function CallSimulator() {
	const { sessionId, setSessionId } = useSessionContext();
	const createSession = useMutation(api.sessions.createSession);
	const transcribe = useAction(api.sttAgent.transcribeChunk);
	const appendChunk = useMutation(api.sessions.appendTranscriptChunk);
	const runIntake = useAction(api.intakeAgent.processIntakeTranscript);
	const lines = useQuery(
		api.views.getTranscriptFeed,
		sessionId ? { sessionId, role: "ero" } : "skip",
	);

	const [city, setCity] = useState<CityKey>("bengaluru");
	const [lang, setLang] = useState("en");
	const [callId, setCallId] = useState<Id<"sessions"> | null>(null);
	const [pending, setPending] = useState(0);
	const [typed, setTyped] = useState("");
	const seq = useRef(0);

	const onChunk = async (blob: Blob, mimeType: string) => {
		if (!callId) return;
		const mySeq = seq.current++;
		setPending((n) => n + 1);
		try {
			const audioBase64 = await blobToBase64(blob);
			await transcribe({
				sessionId: callId,
				seq: mySeq,
				audioBase64,
				mimeType,
				...(lang !== "auto" ? { languageHint: lang } : {}),
			});
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message.split("\n")[0]
					: "Transcription failed",
			);
		} finally {
			setPending((n) => n - 1);
		}
	};

	const rec = useChunkedRecorder({ chunkMs: TIMING.chunkMs, onChunk });

	const startCall = async () => {
		try {
			const view = CITY_VIEW[city];
			const id = await createSession({
				source: "call",
				callerPhone: "+91 98765 43210",
				incidentLat: view.center[1],
				incidentLng: view.center[0],
				city,
				language: lang,
				locationSource: "default",
			});
			seq.current = 0;
			setCallId(id);
			setSessionId(id);
			await rec.start();
			toast.success("Call connected. Describe the emergency.");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not start the call",
			);
		}
	};

	const endCall = () => {
		rec.stop();
		setCallId(null);
	};

	const sendTyped = async () => {
		const text = typed.trim();
		if (!text || !callId) return;
		setTyped("");
		try {
			const mySeq = seq.current++;
			await appendChunk({
				sessionId: callId,
				seq: mySeq,
				text,
				translatedText: text,
				language: lang === "auto" ? "en" : lang,
			});
			await runIntake({ sessionId: callId });
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message.split("\n")[0]
					: "Could not send the line",
			);
		}
	};

	const live = callId !== null;

	return (
		<Panel
			action={
				<StatusPill pulse={live} tone={live ? "ok" : "neutral"}>
					{live ? "On call" : "Idle"}
				</StatusPill>
			}
			title="Caller phone"
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
				<div className="space-y-3">
					<label className="block font-semibold text-muted-foreground text-xs">
						City
						<select
							className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-foreground text-sm"
							disabled={live}
							onChange={(e) => setCity(e.target.value as CityKey)}
							value={city}
						>
							{Object.entries(CITY_VIEW).map(([k, v]) => (
								<option key={k} value={k}>
									{v.label}
								</option>
							))}
						</select>
					</label>
					<label className="block font-semibold text-muted-foreground text-xs">
						Caller language
						<select
							className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-foreground text-sm"
							disabled={live}
							onChange={(e) => setLang(e.target.value)}
							value={lang}
						>
							<option value="auto">Auto-detect</option>
							{LANGUAGES.map((l) => (
								<option key={l.code} value={l.code}>
									{l.name} · {l.native}
								</option>
							))}
						</select>
					</label>

					{live ? (
						<ActionButton className="w-full" onClick={endCall} variant="danger">
							<PhoneOff className="size-4" /> Hang up
						</ActionButton>
					) : (
						<ActionButton className="w-full" onClick={startCall}>
							<PhoneCall className="size-4" /> Call 108
						</ActionButton>
					)}

					<div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
						{rec.recording ? (
							<Mic className="size-5 text-brand-deep" />
						) : (
							<MicOff className="size-5 text-muted-foreground" />
						)}
						<div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
							<div
								className={cn(
									"h-full rounded-full bg-brand transition-[width] duration-75",
								)}
								style={{ width: `${rec.level * 100}%` }}
							/>
						</div>
						<span className="text-[11px] text-muted-foreground">
							{pending > 0
								? "Transcribing…"
								: rec.recording
									? "Listening"
									: "Mic off"}
						</span>
					</div>
					{rec.error ? (
						<p className="text-[var(--danger)] text-xs">{rec.error}</p>
					) : null}
					<p className="text-muted-foreground text-xs">
						Speak clearly in short sentences. Every{" "}
						{Math.round(TIMING.chunkMs / 1000)} seconds are sent for
						transcription.
					</p>
				</div>

				<div className="flex min-h-0 flex-col gap-2">
					<div className="k-scroll h-56 space-y-2 overflow-y-auto rounded-2xl bg-muted p-3">
						{!lines || lines.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Transcript appears here as you speak.
							</p>
						) : (
							lines.map((c) => (
								<div
									className="rounded-xl bg-card px-3 py-2 text-sm"
									key={c._id}
								>
									{c.text}
									{c.translatedText && c.translatedText !== c.text ? (
										<p className="mt-0.5 text-muted-foreground text-xs">
											EN: {c.translatedText}
										</p>
									) : null}
								</div>
							))
						)}
					</div>
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							void sendTyped();
						}}
					>
						<input
							className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-50"
							disabled={!live}
							onChange={(e) => setTyped(e.target.value)}
							placeholder="Mic not working? Type what the caller says…"
							value={typed}
						/>
						<ActionButton disabled={!live || typed.trim() === ""} type="submit">
							<Send className="size-4" />
						</ActionButton>
					</form>
				</div>
			</div>
		</Panel>
	);
}
