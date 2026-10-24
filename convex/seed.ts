import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { AMBULANCES, DOCTORS, HOSPITALS, PATIENTS, SIGNALS } from "./demoData";

async function clearTable(ctx: MutationCtx, table: TableNames): Promise<void> {
	const rows = await ctx.db.query(table).collect();
	for (const r of rows) await ctx.db.delete(r._id);
}

async function insertFleet(
	ctx: MutationCtx,
): Promise<{ hospitals: number; ambulances: number; signals: number }> {
	const hospitalIds = new Map<string, Id<"hospitals">>();
	for (const h of HOSPITALS) {
		const id = await ctx.db.insert("hospitals", {
			...h,
			acceptingEmergencies: true,
		});
		hospitalIds.set(h.name, id);
	}
	for (const [hospitalName, docs] of Object.entries(DOCTORS)) {
		const hospitalId = hospitalIds.get(hospitalName);
		if (!hospitalId) continue;
		for (const d of docs) {
			await ctx.db.insert("doctors", {
				hospitalId,
				name: d.name,
				specialty: d.specialty,
				available: true,
			});
		}
	}
	for (const a of AMBULANCES) {
		await ctx.db.insert("ambulances", { ...a, status: "idle" });
	}
	for (const s of SIGNALS) {
		await ctx.db.insert("signals", {
			...s,
			state: "red",
			policeNotified: false,
		});
	}
	return {
		hospitals: HOSPITALS.length,
		ambulances: AMBULANCES.length,
		signals: SIGNALS.length,
	};
}

async function insertPatients(ctx: MutationCtx): Promise<number> {
	const now = Date.now();
	for (const p of PATIENTS) {
		const { records, ...profile } = p;
		const patientId = await ctx.db.insert("patients", {
			...profile,
			createdAt: now,
		});
		for (const r of records) {
			await ctx.db.insert("medicalRecords", {
				patientId,
				visitDate: now - r.daysAgo * 24 * 60 * 60 * 1000,
				diagnosis: r.diagnosis,
				notes: r.notes,
			});
		}
	}
	return PATIENTS.length;
}

/** First-time setup. Does nothing if data already exists. */
export const seedAll = mutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db.query("hospitals").first();
		if (existing)
			return {
				skipped: true,
				reason: "Data already seeded. Use seed:reseedAll to reset.",
			};
		const fleet = await insertFleet(ctx);
		const hasPatients = await ctx.db.query("patients").first();
		const patients = hasPatients ? 0 : await insertPatients(ctx);
		return { skipped: false, ...fleet, patients };
	},
});

export const seedPatients = mutation({
	args: {},
	handler: async (ctx) => {
		if (await ctx.db.query("patients").first()) return { skipped: true };
		return { skipped: false, count: await insertPatients(ctx) };
	},
});

/** Full demo reset: wipes sessions and live data, restores fleet, beds and signals. */
export const reseedAll = mutation({
	args: {},
	handler: async (ctx) => {
		const tables: TableNames[] = [
			"sessions",
			"sessionEvents",
			"auditLog",
			"dispatchOffers",
			"hospitalRequests",
			"routes",
			"vitalsLog",
			"transcriptChunks",
			"ambulances",
			"hospitals",
			"doctors",
			"signals",
		];
		for (const t of tables) await clearTable(ctx, t);
		const fleet = await insertFleet(ctx);
		const hasPatients = await ctx.db.query("patients").first();
		const patients = hasPatients ? 0 : await insertPatients(ctx);
		return { ...fleet, patients };
	},
});
