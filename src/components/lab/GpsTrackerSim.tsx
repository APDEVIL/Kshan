"use client";

import { useMutation } from "convex/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { ActionButton, EmptyNote, Panel } from "@/components/shared/Panel";
import { useActiveSession } from "@/hooks/useActiveSession";
import { api } from "@/lib/convex";

const STEP_M = 150;
const DEG_PER_M = 1 / 111_320;

/** Moves the emergency location, like a phone sharing its GPS or a driver adjusting the pin. */
export function GpsTrackerSim() {
  const { sessionId, snapshot } = useActiveSession();
  const setLocation = useMutation(api.sessions.setLocation);
  const s = snapshot?.session;
  const amb = snapshot?.ambulance;

  const move = async (dNorthM: number, dEastM: number) => {
    if (!sessionId || !s) return;
    const lat = s.incidentLat + dNorthM * DEG_PER_M;
    const lng = s.incidentLng + (dEastM * DEG_PER_M) / Math.cos((s.incidentLat * Math.PI) / 180);
    try {
      await setLocation({ sessionId, lat, lng, source: "driver", actor: "GPS tracker", role: "driver" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not move the pin");
    }
  };

  const useMyLocation = () => {
    if (!sessionId) return;
    if (!navigator.geolocation) {
      toast.error("This browser has no location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          sessionId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "caller_link",
          actor: "Caller phone",
          role: "caller",
        })
          .then(() => toast.success("Caller location shared"))
          .catch((err) => toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not share location"));
      },
      () => toast.error("Location permission was denied."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <Panel title="GPS tracker">
      {!s ? (
        <EmptyNote>Start an emergency first.</EmptyNote>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-muted p-3">
              <dt className="text-muted-foreground">Incident</dt>
              <dd className="mt-0.5 font-mono font-semibold">
                {s.incidentLat.toFixed(4)}, {s.incidentLng.toFixed(4)}
              </dd>
              <dd className="mt-0.5 text-muted-foreground">source: {s.incidentLocationSource ?? "default"}</dd>
            </div>
            <div className="rounded-2xl bg-muted p-3">
              <dt className="text-muted-foreground">Ambulance</dt>
              <dd className="mt-0.5 font-mono font-semibold">{amb ? `${amb.lat.toFixed(4)}, ${amb.lng.toFixed(4)}` : "not assigned"}</dd>
              <dd className="mt-0.5 text-muted-foreground">{amb?.vehicleNumber ?? ""}</dd>
            </div>
          </dl>

          <div className="mx-auto grid w-40 grid-cols-3 gap-1.5">
            <span />
            <PadButton label="North" onClick={() => move(STEP_M, 0)}>
              <ArrowUp className="size-4" />
            </PadButton>
            <span />
            <PadButton label="West" onClick={() => move(0, -STEP_M)}>
              <ArrowLeft className="size-4" />
            </PadButton>
            <span className="grid place-items-center text-[10px] text-muted-foreground">{STEP_M} m</span>
            <PadButton label="East" onClick={() => move(0, STEP_M)}>
              <ArrowRight className="size-4" />
            </PadButton>
            <span />
            <PadButton label="South" onClick={() => move(-STEP_M, 0)}>
              <ArrowDown className="size-4" />
            </PadButton>
            <span />
          </div>

          <ActionButton variant="outline" onClick={useMyLocation}>
            <LocateFixed className="size-4" /> Share my real location
          </ActionButton>
          <p className="text-xs text-muted-foreground">Moving the pin before dispatch changes which ambulance is nearest.</p>
        </div>
      )}
    </Panel>
  );
}

function PadButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-xl border border-border bg-card transition-all hover:border-brand active:scale-90"
    >
      {children}
    </button>
  );
}