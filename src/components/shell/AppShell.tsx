import type { ReactNode } from "react";
import { RightRail } from "@/components/shell/RightRail";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { TourGuide } from "@/components/tour/TourGuide";

/** Three-column console: sidebar, working area, dark live panel. Fits one 1920x1080 screen. */
export function AppShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-dvh gap-3 p-3 lg:p-4">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<TopBar />
				<RoleSwitcher className="lg:hidden" />
				<main className="k-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
					{children}
				</main>
			</div>
			<RightRail />
			<TourGuide />
		</div>
	);
}
