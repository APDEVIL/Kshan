"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			position="top-right"
			theme="dark"
			toastOptions={{
				classNames: {
					toast:
						"group toast bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border-bright)] shadow-xl rounded-lg font-sans",
					description: "text-[var(--color-text-dim)]",
					actionButton: "bg-[var(--color-cyan)] text-[#04141f]",
					cancelButton:
						"bg-[var(--color-surface)] text-[var(--color-text-dim)]",
					success: "!border-[var(--color-green)]/50",
					error: "!border-[var(--color-red)]/50",
					warning: "!border-[var(--color-amber)]/50",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
