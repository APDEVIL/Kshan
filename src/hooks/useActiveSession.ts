"use client";

import { useQuery } from "convex/react";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { useRole } from "@/hooks/useRole";
import { api } from "@/lib/convex";

/**
 * The live snapshot of the session this screen follows, redacted for the current role.
 * Several components can call this at once. Convex shares one subscription between identical queries.
 */
export function useActiveSession() {
	const { sessionId } = useSessionContext();
	const { role } = useRole();
	const viewerRole = role ?? "ero";
	const snapshot = useQuery(
		api.views.getSessionSnapshot,
		sessionId ? { sessionId, role: viewerRole } : "skip",
	);
	return {
		sessionId,
		snapshot,
		viewerRole,
		loading: sessionId !== null && snapshot === undefined,
	};
}
