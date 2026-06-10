"use client";

import { Minus, Plus } from "lucide-react";
import { DAUER_SCHRITT, formatDuration } from "@/lib/training";

/* Dauer-Eingabe je Zuordnung in 5-Minuten-Schritten (Story #11 AC1/AC2).
   Ohne erfasste Dauer ein „+ Dauer"-Knopf; mit Dauer ein −/Wert/+-Stepper.
   Die Dauer wird allein über Minus geleert: unterschreitet sie die kleinste
   Stufe, fällt sie auf den Leerzustand zurück (kein separater Entfernen-Knopf,
   der sich sonst mit dem „Übung entfernen“ verwechseln liesse). Kontrolliert;
   persistiert über den Aufrufer. */
export function DurationStepper({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}) {
  if (value == null) {
    return (
      <button
        type="button"
        onClick={() => onChange(DAUER_SCHRITT)}
        disabled={disabled}
        className="focus-ring inline-flex items-center gap-1 rounded-full border-[1.5px] border-outline px-3 py-1 type-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-60"
      >
        <Plus size={14} strokeWidth={2.5} aria-hidden />
        Dauer
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="Dauer verringern"
        onClick={() => onChange(value - DAUER_SCHRITT < DAUER_SCHRITT ? null : value - DAUER_SCHRITT)}
        disabled={disabled}
        className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-outline text-on-surface transition-colors hover:bg-on-surface/8 disabled:opacity-60"
      >
        <Minus size={14} strokeWidth={2.5} aria-hidden />
      </button>
      <span className="min-w-[3.5rem] text-center type-label-large tabular-nums text-on-surface">
        {formatDuration(value)}
      </span>
      <button
        type="button"
        aria-label="Dauer erhöhen"
        onClick={() => onChange(value + DAUER_SCHRITT)}
        disabled={disabled}
        className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-outline text-on-surface transition-colors hover:bg-on-surface/8 disabled:opacity-60"
      >
        <Plus size={14} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
