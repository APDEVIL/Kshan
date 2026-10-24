"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Bot, Timer, UserCheck } from "lucide-react";
import { useState } from "react";
import { AnimatedNumber } from "@/components/effects/AnimatedNumber";
import { Reveal } from "@/components/effects/Reveal";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { EmptyNote, Panel } from "@/components/shared/Panel";
import { StatusPill } from "@/components/shared/StatusPill";
import { TriageBadge } from "@/components/shared/TriageBadge";
import { api, type Id } from "@/lib/convex";
import { formatClock, formatDuration, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AuditDashboard() {
  const sessions = useQuery(api.views.listRecentSessions, { limit: 30 });
  const { sessionId, setSessionId } = useSessionContext();
  const [picked, setPicked] = useState<Id<"sessions"> | null>(null);
  const focus = picked ?? sessionId;
  const log = useQuery(api.audit.getAuditLog, focus ? { sessionId: focus } : "skip");

  const first = log?.[0];
  const last = log?.[log.length - 1];

  const dispatched = (sessions ?? []).filter((s) => s.callToDispatchSec !== null);
  const avg = dispatched.length ? dispatched.reduce((sum, s) => sum + (s.callToDispatchSec ?? 0), 0) / dispatched.length : 0;
  const triaged = (sessions ?? []).filter((s) => s.finalColor);
  const overrides = triaged.filter((s) => s.overridden).length;
  const agreement = triaged.length ? Math.round(((triaged.length - overrides) / triaged.length) * 100) : 100;

  return (
    <Reveal className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Panel title="Emergencies">
            <p className="text-4xl font-extrabold">
              <AnimatedNumber value={sessions?.length ?? 0} />
            </p>
          </Panel>
          <Panel title="Avg call → dispatch">
            <p className="flex items-baseline gap-1 text-4xl font-extrabold">
              <AnimatedNumber value={avg} decimals={1} />
              <span className="text-base font-semibold text-muted-foreground">s</span>
            </p>
          </Panel>
          <Panel title="AI and human agree">
            <p className="flex items-baseline gap-1 text-4xl font-extrabold">
              <AnimatedNumber value={agreement} />
              <span className="text-base font-semibold text-muted-foreground">%</span>
            </p>
          </Panel>
        </div>

        <Panel title="Recent emergencies">
          {sessions === undefined ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : sessions.length === 0 ? (
            <EmptyNote>No emergencies yet.</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(s._id);
                      setSessionId(s._id);
                    }}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors",
                      focus === s._id ? "bg-brand-soft" : "bg-muted hover:bg-muted/70",
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{formatClock(s.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {s.symptoms.length ? s.symptoms.map(titleCase).join(", ") : "No symptoms yet"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TriageBadge color={s.aiColor ?? null} size="sm" />
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <TriageBadge color={s.finalColor ?? null} size="sm" />
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer className="size-3.5" /> {s.callToDispatchSec !== null ? `${s.callToDispatchSec}s` : "–"}
                    </span>
                    <StatusPill tone={s.status === "closed" ? "neutral" : "ok"}>{s.status === "closed" ? "Closed" : "Live"}</StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Decision trail" className="max-h-[44rem]">
        <div className="k-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {!focus ? (
            <EmptyNote>Select an emergency to see who decided what.</EmptyNote>
          ) : log === undefined ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : log.length === 0 ? (
            <EmptyNote>No audit entries.</EmptyNote>
          ) : (
            <ol className="space-y-2">
              {log.map((a) => {
                const human = !["system", "AI", "Safety Rules"].includes(a.actor) && a.role !== "system";
                return (
                  <li key={a._id} className="flex gap-3 rounded-2xl bg-muted px-3.5 py-2.5">
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", human ? "bg-brand/20 text-brand-deep" : "bg-[var(--info)]/15 text-[var(--info)]")}>
                      {human ? <UserCheck className="size-4" /> : <Bot className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{titleCase(a.action.replaceAll("_", " "))}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.actor} ({a.role})
                        {a.oldValue || a.newValue ? ` · ${a.oldValue ?? "–"} → ${a.newValue ?? "–"}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{formatClock(a.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {first && last ? (
          <p className="mt-2 text-xs text-muted-foreground">Total time: {formatDuration((last.createdAt - first.createdAt) / 1000)}</p>
        ) : null}
      </Panel>
    </Reveal>
  );
}