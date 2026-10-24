import type { Metadata, Viewport } from "next";
import {
	JetBrains_Mono,
	Noto_Sans_Devanagari,
	Noto_Sans_Kannada,
	Plus_Jakarta_Sans,
} from "next/font/google";
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
// Kannada and Devanagari so the call transcript renders properly when the caller speaks Kannada or Hindi.
const kannada = Noto_Sans_Kannada({
	subsets: ["kannada"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-kannada",
	display: "swap",
});
const devanagari = Noto_Sans_Devanagari({
	subsets: ["devanagari"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-devanagari",
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
			className={cn(
				"h-full",
				jakarta.variable,
				kannada.variable,
				devanagari.variable,
				jetbrains.variable,
			)}
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
