"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
	const convex = useMemo(() => {
		const url = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!url) {
			throw new Error(
				"NEXT_PUBLIC_CONVEX_URL is not set. Add it in Vercel > Settings > Environment Variables.",
			);
		}
		return new ConvexReactClient(url);
	}, []);

	return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}