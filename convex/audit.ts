import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { query } from "./_generated/server";

/** Append one structured audit row. Call from any mutation. */
export async function writeAudit(
	ctx: MutationCtx,
	a: {
		sessionId: Id<"sessions">;
		actor: string;
		role: string;
		action: string;
		field?: string;
		oldValue?: string;
		newValue?: string;
		aiSuggested?: string;
	},
) {
	await ctx.db.insert("auditLog", { ...a, createdAt: Date.now() });
}

export const getAuditLog = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("auditLog")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("asc")
			.collect();
	},
});
