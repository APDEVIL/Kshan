"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Compass, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { useActiveSession } from "@/hooks/useActiveSession";
import { useRole } from "@/hooks/useRole";
import { api, type Snapshot } from "@/lib/convex";
import { NAV_BY_KEY, type RoleKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Step {
  text: string;
  /** True when it is the visitor's turn to act, false while the demo crew works. */
  yourTurn: boolean;
  done?: boolean;
}

const PICKED = ["patient_picked_up", "awaiting_hospital_accept", "en_route_to_hospital", "at_hospital"];

function stepFor(role: RoleKey, snap: Snapshot | null | undefined, pendingJunctions: number): Step {
  if (!snap) return { text: "Start an emergency from the home screen to begin.", yourTurn: false };
  const s = snap.session;
  if (s.status === "closed") {
    return { text: "Mission complete. Open Audit & Metrics to see who decided what, AI or human.", yourTurn: false, done: true };
  }
  const picked = PICKED.includes(s.status);

  switch (role) {
    case "ero":
      if (!s.assignedAmbulanceId) {
        return s.vetoDeadline !== undefined
          ? { text: "The AI will dispatch an ambulance in a few seconds. Veto it, or press Dispatch now.", yourTurn: true }
          : { text: "Listening to the call. Dispatch starts once symptoms are known.", yourTurn: false };
      }
      if (!s.assignedHospitalId && !snap.hospitalRequest) {
        return { text: "Choose a hospital and press Pre-alert.", yourTurn: true };
      }
      if (snap.hospitalRequest) return { text: "Pre-alert sent. Waiting for the ER head to accept.", yourTurn: false };
      return { text: "Watch the ambulance on the map. You can override the triage colour or end the mission.", yourTurn: false };

    case "driver":
      if (snap.offer) return { text: "A job is offered. Press Accept before the timer runs out.", yourTurn: true };
      if (!snap.ambulance) return { text: "Waiting for a job offer…", yourTurn: false };
      if (snap.ambulance.status === "with_patient") {
        return s.assignedHospitalId
          ? { text: "Patient is on board and the hospital is ready. Press Depart for hospital.", yourTurn: true }
          : { text: "Patient is on board. Waiting for the hospital to accept.", yourTurn: false };
      }
      if (snap.ambulance.status === "sanitizing") return { text: "Handover done. Press Mark ambulance free.", yourTurn: true };
      return { text: "Drive to the patient. The route, ETA and green junctions update live.", yourTurn: false };

    case "helper":
      if (picked && !snap.vitals) {
        return { text: "Patient is on board. Enter the vitals (try Cardiac sample) and press Send to ER.", yourTurn: true };
      }
      if (picked && !s.assignedHospitalId && !snap.hospitalRequest) {
        return { text: "Pick a hospital from the list to pre-alert it.", yourTurn: true };
      }
      if (picked) return { text: "Vitals are with the ER. Waiting for the drive to the hospital.", yourTurn: false };
      return { text: "The ambulance is on the way. The vitals form unlocks when the patient is on board.", yourTurn: false };

    case "er_head":
      if (snap.hospitalRequest) return { text: "A patient is incoming. Accept the pre-alert before the timer ends.", yourTurn: true };
      if (snap.hospital && !s.assignedBedConfirmed) return { text: "Confirm that a bed is ready.", yourTurn: true };
      if (snap.hospital && !snap.doctor) return { text: "Assign an emergency doctor.", yourTurn: true };
      if (snap.hospital) return { text: "All set. Review the vitals and triage as the patient arrives.", yourTurn: false };
      return { text: "Waiting for a pre-alert…", yourTurn: false };

    case "outpost":
      return pendingJunctions > 0
        ? { text: `${pendingJunctions} junction(s) need your approval. Press Approve green corridor.`, yourTurn: true }
        : { text: "Waiting for an ambulance route. Junctions turn green as it approaches.", yourTurn: false };

    case "doctor":
      if (!snap.vitals) return { text: "Waiting for vitals from the ambulance…", yourTurn: false };
      return {
        text: "Review the vitals. Link the patient by phone, open their history (consent or break-glass), or override triage.",
        yourTurn: true,
      };
  }
}

/** Floating coach card for the guided walkthrough. Shows only when a role was picked on the home screen. */
export function TourGuide() {
  const { playAs, setPlayAs, sessionId } = useSessionContext();
  const { view } = useRole();
  const { snapshot } = useActiveSession();
  const route = useQuery(api.views.getRouteForSession, sessionId && playAs === "outpost" ? { sessionId } : "skip");
  const [open, setOpen] = useState(true);

  if (!playAs) return null;

  const pending = route?.legs.find((l) => l.status === "active")?.signals.filter((g) => g.pendingApproval).length ?? 0;
  const step = stepFor(playAs, snapshot, pending);
  const nav = NAV_BY_KEY[playAs];
  const onMyScreen = view === playAs;

  return (
    <div className="fixed bottom-5 left-4 z-40 w-[min(24rem,calc(100vw-2rem))] lg:left-[18rem]">
      <div className="bento overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-2 bg-brand px-4 py-2.5 text-brand-foreground">
          <Compass className="size-4" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold tracking-wide uppercase">You play: {nav.label}</p>
          <button type="button" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)}>
            <ChevronDown className={cn("size-4 transition-transform", !open && "rotate-180")} />
          </button>
          <button type="button" aria-label="End the guided tour" onClick={() => setPlayAs(null)}>
            <X className="size-4" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 p-4">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={step.text}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm leading-snug font-medium"
                  >
                    {step.text}
                  </motion.p>
                </AnimatePresence>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      step.done ? "bg-muted text-muted-foreground" : step.yourTurn ? "bg-brand/20 text-brand-deep" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? "Finished" : step.yourTurn ? "Your turn" : "Crew is working"}
                  </span>
                  {!onMyScreen ? (
                    <Link href={nav.href} className="rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-background">
                      Open {nav.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}