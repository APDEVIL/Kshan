import { v } from "convex/values";
import { query } from "./_generated/server";

export const listAmbulances = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("ambulances").collect();
	},
});

export const getAmbulance = query({
	args: { ambulanceId: v.id("ambulances") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.ambulanceId);
	},
});

export const listHospitals = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("hospitals").collect();
	},
});

export const getHospital = query({
	args: { hospitalId: v.id("hospitals") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.hospitalId);
	},
});

export const listDoctorsForHospital = query({
	args: { hospitalId: v.id("hospitals") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("doctors")
			.withIndex("by_hospital", (q) => q.eq("hospitalId", args.hospitalId))
			.collect();
	},
});

export const getDoctor = query({
	args: { doctorId: v.id("doctors") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.doctorId);
	},
});
