import type { ReactNode } from "react";
import { PageTransition } from "@/components/effects/PageTransition";

export default function ConsoleTemplate({ children }: { children: ReactNode }) {
	return <PageTransition>{children}</PageTransition>;
}
