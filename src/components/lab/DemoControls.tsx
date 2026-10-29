"use client";

import { useMutation } from "convex/react";
import { Gauge, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton, Panel } from "@/components/shared/Panel";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { useActiveSession } from "@/hooks/useActiveSession";
import { api } from "@/lib/convex";
import { TIMING } from "@/lib/timing";

const SPEEDS = [1, 4, 8, 15, 30];

/** Demo-day controls: ambulance speed and a full reset between audiences. */
export function DemoControls() {
  const { snapshot } = useActiveSession();
  const { setSessionId } = useSessionContext();
  const setSpeed = useMutation(api.ambulanceSim.setSimSpeed);
  const reseed = useMutation(api.seed.reseedAll);
  const [confirming, setConfirming] = useState(false);
  const ambulanceId = snapshot?.ambulance?._id;
  const current = snapshot?.ambulance?.simMultiplier ?? snapshot?.route?.multiplier ?? TIMING.demoSpeedMultiplier;

  return (
    <Panel title="Demo controls">
      <div className="space-y-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Gauge className="size-4" /> Ambulance speed (now {current}x)
          </p>
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!ambulanceId}
                onClick={() =>
                  ambulanceId &&
                  setSpeed({ ambulanceId, multiplier: m })
                    .then(() => toast.success(`Speed set to ${m}x`))
                    .catch((err) => toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not change speed"))
                }
                className={
                  current === m
                    ? "rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-brand-foreground"
                    : "rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:border-brand disabled:opacity-40"
                }
              >
                {m}x
              </button>
            ))}
          </div>
          {!ambulanceId ? <p className="mt-2 text-xs text-muted-foreground">Available once an ambulance is assigned.</p> : null}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Reset everything for the next audience</p>
          {confirming ? (
            <div className="flex gap-2">
              <ActionButton
                variant="danger"
                onClick={() =>
                  reseed({})
                    .then(() => {
                      setSessionId(null);
                      setConfirming(false);
                      toast.success("Demo reset. All ambulances are free.");
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message.split("\n")[0] : "Reset failed"))
                }
              >
                <RotateCcw className="size-4" /> Yes, wipe all emergencies
              </ActionButton>
              <ActionButton variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </ActionButton>
            </div>
          ) : (
            <ActionButton variant="outline" onClick={() => setConfirming(true)}>
              <RotateCcw className="size-4" /> Reset demo
            </ActionButton>
          )}
        </div>
      </div>
    </Panel>
  );
}