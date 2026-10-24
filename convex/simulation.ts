// Controls for the Simulation Lab. These stand in for real hardware (a junction controller).
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** A simulated junction controller: set a signal to red, yellow or green by hand. */
export const setSignalState = mutation({
  args: {
    signalId: v.id("signals"),
    state: v.union(v.literal("red"), v.literal("yellow"), v.literal("green")),
  },
  handler: async (ctx, args): Promise<void> => {
    const s = await ctx.db.get(args.signalId);
    if (!s) throw new Error("Signal not found");
    await ctx.db.patch(args.signalId, { state: args.state });
  },
});