"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { EmptyNote, Panel } from "@/components/shared/Panel";
import { useActiveSession } from "@/hooks/useActiveSession";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

const STATES = ["red", "yellow", "green"] as const;
const DOT: Record<(typeof STATES)[number], string> = {
  red: "bg-[var(--triage-red)]",
  yellow: "bg-[var(--triage-yellow)]",
  green: "bg-[var(--triage-green)]",
};

/** A junction controller you can drive by hand. The ambulance simulation still turns junctions green on approach. */
export function SignalControllerSim() {
  const { snapshot } = useActiveSession();
  const signals = useQuery(api.traffic.listSignals, {});
  const setState = useMutation(api.simulation.setSignalState);
  const city = snapshot?.session.city;
  const shown = (signals ?? []).filter((g) => !city || !g.city || g.city === city).slice(0, 12);

  return (
    <Panel title="Signal controller">
      {signals === undefined ? (
        <EmptyNote>Loading…</EmptyNote>
      ) : shown.length === 0 ? (
        <EmptyNote>No junctions found. Run the demo reset.</EmptyNote>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((g) => (
            <li key={g._id} className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-2">
              <span className={cn("size-3 shrink-0 rounded-full", DOT[g.state])} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
              <span className="flex gap-1">
                {STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    aria-label={`Set ${g.name} to ${st}`}
                    onClick={() =>
                      setState({ signalId: g._id, state: st }).catch((err) =>
                        toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not change the signal"),
                      )
                    }
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform active:scale-90",
                      DOT[st],
                      g.state === st ? "border-foreground" : "border-transparent opacity-40 hover:opacity-80",
                    )}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}