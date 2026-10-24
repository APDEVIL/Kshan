import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audit";
import { assertCan } from "./lib";

export type RouteSignal = { signalId: Id<"signals">; posM: number };

async function evt(
	ctx: MutationCtx,
	sessionId: Id<"sessions">,
	actor: string,
	message: string,
): Promise<void> {
	await ctx.db.insert("sessionEvents", {
		sessionId,
		actor,
		message,
		createdAt: Date.now(),
	});
}

export const listSignals = query({
	args: {},
	handler: async (ctx) => await ctx.db.query("signals").collect(),
});

/** Called when a route is saved: junctions on the route wait for officer approval. */
export async function prepareCorridor(
	ctx: MutationCtx,
	sessionId: Id<"sessions">,
	items: RouteSignal[],
): Promise<void> {
	for (const it of items) {
		await ctx.db.patch(it.signalId, {
			pendingApproval: true,
			policeNotified: false,
			approvedBy: undefined,
			activeSessionId: sessionId,
		});
	}
	if (items.length > 0) {
		await evt(
			ctx,
			sessionId,
			"Traffic Control Agent",
			`${items.length} junction(s) on the route. Route shared with outposts, waiting for officer approval of the green corridor.`,
		);
	}
}

/** Reset every junction this route had claimed. */
export async function releaseCorridor(
	ctx: MutationCtx,
	items: RouteSignal[],
	sessionId: Id<"sessions">,
): Promise<void> {
	for (const it of items) {
		const s = await ctx.db.get(it.signalId);
		if (s && s.activeSessionId === sessionId) {
			await ctx.db.patch(it.signalId, {
				state: "red",
				policeNotified: false,
				pendingApproval: false,
				approvedBy: undefined,
				activeSessionId: undefined,
			});
		}
	}
}

/** Per tick: approved junctions turn green 500 m ahead and reset once passed. */
export async function updateCorridor(
	ctx: MutationCtx,
	items: RouteSignal[],
	traveledM: number,
	sessionId: Id<"sessions">,
): Promise<void> {
	for (const it of items) {
		const s = await ctx.db.get(it.signalId);
		if (!s || s.activeSessionId !== sessionId) continue;
		const ahead = it.posM - traveledM;
		if (
			s.policeNotified &&
			ahead <= 500 &&
			ahead > -100 &&
			s.state !== "green"
		) {
			await ctx.db.patch(it.signalId, { state: "green" });
			await evt(
				ctx,
				sessionId,
				"Traffic Control Agent",
				`Signal "${s.name}" is GREEN for the ambulance.`,
			);
		} else if (ahead <= -150 && s.state === "green") {
			await ctx.db.patch(it.signalId, {
				state: "red",
				policeNotified: false,
				pendingApproval: false,
				approvedBy: undefined,
				activeSessionId: undefined,
			});
		}
	}
}

/** Outpost officer (or ERO) approves the green corridor for the active route. */
export const approveCorridor = mutation({
	args: { sessionId: v.id("sessions"), actor: v.string(), role: v.string() },
	handler: async (ctx, args): Promise<{ approved: number }> => {
		assertCan(args.role, "approve_signals");
		const routes = await ctx.db
			.query("routes")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		let approved = 0;
		for (const r of routes.filter((x) => x.status === "active")) {
			for (const it of r.signals) {
				const s = await ctx.db.get(it.signalId);
				if (s && s.activeSessionId === args.sessionId) {
					await ctx.db.patch(it.signalId, {
						pendingApproval: false,
						policeNotified: true,
						approvedBy: args.actor,
					});
					approved++;
				}
			}
		}
		await evt(
			ctx,
			args.sessionId,
			args.actor,
			`Approved green corridor for ${approved} junction(s).`,
		);
		await writeAudit(ctx, {
			sessionId: args.sessionId,
			actor: args.actor,
			role: args.role,
			action: "approve_corridor",
			newValue: String(approved),
		});
		return { approved };
	},
});

export const resetAllSignals = mutation({
	args: {},
	handler: async (ctx) => {
		for (const s of await ctx.db.query("signals").collect()) {
			await ctx.db.patch(s._id, {
				state: "red",
				policeNotified: false,
				pendingApproval: false,
				approvedBy: undefined,
				activeSessionId: undefined,
			});
		}
	},
});

/** DEPRECATED: kept so the old UI compiles. The corridor now follows the route. */
export const updateSignalsForAmbulancePosition = mutation({
	args: {
		sessionId: v.id("sessions"),
		ambulanceLat: v.number(),
		ambulanceLng: v.number(),
	},
	handler: async () => null,
});
