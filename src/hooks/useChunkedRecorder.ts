"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickMime(): string {
	const options = [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/mp4",
		"audio/ogg;codecs=opus",
	];
	for (const m of options) {
		if (
			typeof MediaRecorder !== "undefined" &&
			MediaRecorder.isTypeSupported(m)
		)
			return m;
	}
	return "";
}

export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Could not read the audio chunk"));
		reader.onload = () => {
			const url = String(reader.result ?? "");
			resolve(url.slice(url.indexOf(",") + 1));
		};
		reader.readAsDataURL(blob);
	});
}

/**
 * Records the microphone in short, standalone files. Each chunk gets its own MediaRecorder,
 * because slices of one long recording cannot be decoded on their own by Whisper.
 */
export function useChunkedRecorder({
	chunkMs,
	onChunk,
}: {
	chunkMs: number;
	onChunk: (blob: Blob, mimeType: string) => void;
}) {
	const [recording, setRecording] = useState(false);
	const [level, setLevel] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const streamRef = useRef<MediaStream | null>(null);
	const runningRef = useRef(false);
	const timerRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const onChunkRef = useRef(onChunk);
	useEffect(() => {
		onChunkRef.current = onChunk;
	}, [onChunk]);

	const recordOne = useCallback(
		(stream: MediaStream, mime: string) => {
			if (!runningRef.current) return;
			const rec = new MediaRecorder(
				stream,
				mime ? { mimeType: mime } : undefined,
			);
			const parts: Blob[] = [];
			rec.ondataavailable = (e) => {
				if (e.data.size > 0) parts.push(e.data);
			};
			rec.onstop = () => {
				const type = rec.mimeType || mime || "audio/webm";
				const blob = new Blob(parts, { type });
				if (blob.size > 1500) onChunkRef.current(blob, type); // tiny blobs are silence
				recordOne(stream, mime);
			};
			rec.start();
			timerRef.current = window.setTimeout(() => {
				if (rec.state !== "inactive") rec.stop();
			}, chunkMs);
		},
		[chunkMs],
	);

	const stop = useCallback(() => {
		runningRef.current = false;
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		streamRef.current?.getTracks().forEach((t) => {
			t.stop();
		});
		streamRef.current = null;
		void ctxRef.current?.close();
		ctxRef.current = null;
		setLevel(0);
		setRecording(false);
	}, []);

	const start = useCallback(async () => {
		setError(null);
		if (!navigator.mediaDevices?.getUserMedia) {
			setError(
				"This browser cannot use the microphone. Use Chrome on localhost or HTTPS.",
			);
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			});
			streamRef.current = stream;
			runningRef.current = true;
			setRecording(true);

			const audioCtx = new AudioContext();
			ctxRef.current = audioCtx;
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			audioCtx.createMediaStreamSource(stream).connect(analyser);
			const data = new Uint8Array(analyser.frequencyBinCount);
			const loop = () => {
				analyser.getByteFrequencyData(data);
				let sum = 0;
				for (const v of data) sum += v;
				setLevel(Math.min(1, sum / data.length / 90));
				rafRef.current = requestAnimationFrame(loop);
			};
			loop();

			recordOne(stream, pickMime());
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Microphone permission was denied.",
			);
			stop();
		}
	}, [recordOne, stop]);

	useEffect(() => stop, [stop]);

	return { recording, level, error, start, stop };
}
