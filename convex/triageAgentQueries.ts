import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getSessionForTriage = internalQuery({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.sessionId);
	},
});

export const getLatestVitals = internalQuery({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("vitalsLog")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("desc")
			.collect();
	},
});

export const getDoctorsForHospital = internalQuery({
	args: { hospitalId: v.id("hospitals") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("doctors")
			.withIndex("by_hospital", (q) => q.eq("hospitalId", args.hospitalId))
			.collect();
	},
});
