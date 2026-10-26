// Theme helpers. Three themes: light (default), dark, and ambulance (white, red and siren blue).
// Separate from the theme: an "ambulance effects" switch (ambulance cursor + flashing lights), off by default.

export type Theme = "light" | "dark" | "ambulance";

export const THEMES: Theme[] = ["light", "dark", "ambulance"];

export const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  ambulance: "Ambulance",
};

export const THEME_KEY = "kshan-theme";
export const FX_KEY = "kshan-fun";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "ambulance";
}

export function nextTheme(theme: Theme): Theme {
  const i = THEMES.indexOf(theme);
  return THEMES[(i + 1) % THEMES.length] ?? "light";
}

export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // storage can be blocked, fall through to the default
  }
  return "light";
}

/** The theme currently painted on <html>, which is the truth even before React has mounted. */
export function currentTheme(): Theme {
  const cl = document.documentElement.classList;
  if (cl.contains("dark")) return "dark";
  if (cl.contains("ambulance")) return "ambulance";
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("ambulance", theme === "ambulance");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

/** Ambulance cursor and flashing lights. Off by default. */
export function readFx(): boolean {
  try {
    return window.localStorage.getItem(FX_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyFx(on: boolean): void {
  document.documentElement.classList.toggle("k-fun", on);
  try {
    window.localStorage.setItem(FX_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

/**
 * Inline script for <head>, so the right theme and effects setting are applied before first paint
 * (no flash on reload).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="dark"&&t!=="ambulance"){t="light"}var c=document.documentElement.classList;c.toggle("dark",t==="dark");c.toggle("ambulance",t==="ambulance");c.toggle("k-fun",localStorage.getItem("${FX_KEY}")==="1");document.documentElement.style.colorScheme=t==="dark"?"dark":"light"}catch(e){}})();`;