// UI countdowns. KEEP IN SYNC with convex/dispatch.ts (VETO_MS, OFFER_MS, HOSPITAL_MS)
// and convex/routing.ts (DEMO_SPEED_MULTIPLIER).

export const TIMING = {
	vetoMs: 10_000, // ERO window to cancel an auto-dispatch
	offerMs: 30_000, // driver must accept a job within this time
	hospitalMs: 20_000, // ER head must answer a pre-alert within this time
	demoSpeedMultiplier: 8, // ambulance runs 8x faster than real time
	chunkMs: 4500, // length of each microphone chunk sent for transcription
} as const;
