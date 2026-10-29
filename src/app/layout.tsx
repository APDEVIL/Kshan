import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource-variable/noto-sans-kannada";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { BRAND } from "@/lib/brand";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { cn } from "@/lib/utils";

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-jakarta",
	display: "swap",
});
const jetbrains = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains",
	display: "swap",
});

export const metadata: Metadata = {
	title: `${BRAND.name} | ${BRAND.native}`,
	description: BRAND.description,
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#eef1ea" },
		{ media: "(prefers-color-scheme: dark)", color: "#0c120e" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={cn("h-full", jakarta.variable, jetbrains.variable)}
			lang="en"
			suppressHydrationWarning
		>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme script, no user input */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
			</head>
			<body className="min-h-dvh font-sans">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}