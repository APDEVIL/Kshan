import { CONSCIOUSNESS, VITAL_META, VITAL_TONE_CLASS, vitalTone, type Consciousness, type VitalKey } from "@/lib/clinical";
import { cn } from "@/lib/utils";

export interface VitalsValue {
  heartRate?: number | undefined;
  systolic?: number | undefined;
  diastolic?: number | undefined;
  spo2?: number | undefined;
  consciousness?: Consciousness | undefined;
}

const KEYS: VitalKey[] = ["heartRate", "systolic", "diastolic", "spo2"];

/** Four vital signs, coloured by how worrying each is, plus the consciousness level. */
export function VitalsGrid({ vitals }: { vitals: VitalsValue | null | undefined }) {
  if (!vitals) return <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>;
  const cons = vitals.consciousness ? CONSCIOUSNESS[vitals.consciousness] : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KEYS.map((k) => {
          const value = vitals[k];
          const tone = vitalTone(k, value);
          return (
            <div key={k} className={cn("rounded-2xl p-3", VITAL_TONE_CLASS[tone].soft)}>
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{VITAL_META[k].label}</p>
              <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", VITAL_TONE_CLASS[tone].text)}>
                {value ?? "–"}
                <span className="ml-1 text-xs font-medium text-muted-foreground">{VITAL_META[k].unit}</span>
              </p>
            </div>
          );
        })}
      </div>
      {cons ? (
        <p className={cn("inline-block rounded-full px-3 py-1 text-xs font-semibold", VITAL_TONE_CLASS[cons.tone].soft, VITAL_TONE_CLASS[cons.tone].text)}>
          {cons.label}
        </p>
      ) : null}
    </div>
  );
}