"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { ACTOR_NAME, type RoleKey } from "@/lib/roles";

/**
 * Who is acting on this screen, plus a wrapper that shows a toast when the server refuses.
 * `role` comes from the URL, so /driver always acts as the driver.
 */
export function useAct(fallback: RoleKey = "ero") {
	const { role } = useRole();
	const acting: RoleKey = role ?? fallback;

	const run = useCallback(
		async (fn: () => Promise<unknown>, success?: string) => {
			try {
				await fn();
				if (success) toast.success(success);
				return true;
			} catch (err) {
				const raw = err instanceof Error ? err.message : "Something went wrong";
				// Convex wraps server errors, keep only the useful sentence.
				const msg =
					raw.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0] ?? raw;
				toast.error(msg);
				return false;
			}
		},
		[],
	);

	return { role: acting, actor: ACTOR_NAME[acting], run };
}
