import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
	return (
		<input
			className={cn(
				"flex h-10 w-full rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] text-sm",
				"font-mono placeholder:text-[var(--color-text-faint)]",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			type={type}
			{...props}
		/>
	);
});
Input.displayName = "Input";

export { Input };
