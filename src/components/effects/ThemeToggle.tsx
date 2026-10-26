"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ambulance, Moon, Sun } from "lucide-react";
import { FxToggle } from "@/components/effects/FxToggle";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { nextTheme, THEME_LABEL, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  ambulance: Ambulance,
};

/**
 * Two buttons side by side: the theme cycler (light, dark, ambulance) and the ambulance-effects switch
 * (cursor and flashing lights). The theme icon shows the theme you are in now.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = nextTheme(theme);
  const Icon = ICON[theme];

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${THEME_LABEL[theme]} theme. Switch to ${THEME_LABEL[next]}`}
        title={`${THEME_LABEL[theme]} theme. Click for ${THEME_LABEL[next]}`}
        onClick={toggle}
        className={cn("rounded-full", className)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -70, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 70, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            className="grid place-items-center"
          >
            <Icon className="size-4" />
          </motion.span>
        </AnimatePresence>
      </Button>
      <FxToggle className={className} />
    </span>
  );
}