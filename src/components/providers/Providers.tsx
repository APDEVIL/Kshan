"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { BackgroundBlobs } from "@/components/effects/BackgroundBlobs";
import { CursorSpotlight } from "@/components/effects/CursorSpotlight";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider, useTheme } from "@/components/providers/ThemeProvider";

function ThemedToaster() {
	const { theme } = useTheme();
	return <Toaster theme={theme === "dark" ? "dark" : "light"} position="top-right" closeButton richColors />;
}

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ConvexClientProvider>
			<ThemeProvider>
				<SessionProvider>
					<BackgroundBlobs />
					<CursorSpotlight />
					<div className="relative z-10">{children}</div>
					<ThemedToaster />
				</SessionProvider>
			</ThemeProvider>
		</ConvexClientProvider>
	);
}
