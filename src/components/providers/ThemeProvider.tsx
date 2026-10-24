"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { applyTheme, currentTheme, nextTheme, readTheme, storeTheme, type Theme } from "@/lib/theme";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	// The inline script in <head> already put the right class on <html> before first paint.
	// State starts at "light" so server and client markup match, then syncs on mount.
	const [theme, setThemeState] = useState<Theme>("light");

	useEffect(() => {
		setThemeState(readTheme());
	}, []);

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
		applyTheme(next);
		storeTheme(next);
	}, []);

	const toggle = useCallback(() => {
		setTheme(nextTheme(currentTheme()));
	}, [setTheme]);

	const value = useMemo(
		() => ({ theme, setTheme, toggle }),
		[theme, setTheme, toggle],
	);
	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
	return ctx;
}
