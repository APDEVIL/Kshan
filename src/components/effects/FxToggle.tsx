"use client";

import { Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyFx, readFx } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Turns the ambulance cursor and the flashing light bar on or off. */
export function FxToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readFx());
  }, []);

  const flip = () => {
    const next = !on;
    setOn(next);
    applyFx(next);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={on}
      aria-label={`Ambulance effects ${on ? "on" : "off"}`}
      title={`Ambulance cursor and siren lights: ${on ? "on" : "off"}. Click to turn ${on ? "off" : "on"}`}
      onClick={flip}
      className={cn("rounded-full", on && "border-brand text-brand-deep", className)}
    >
      <Siren className="size-4" />
    </Button>
  );
}