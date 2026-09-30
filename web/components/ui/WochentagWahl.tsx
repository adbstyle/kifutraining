"use client";

import { useId } from "react";
import { FilterChip } from "./Chip";
import { WOCHENTAGE, WOCHENTAG_KURZ, WOCHENTAG_LANG, type Wochentag } from "@/lib/serie";

/* Wochentage einer Terminserie wählen (#324 AK 2). Sieben feste Werte —
   sichtbar nebeneinander statt in einem Menü (die MultiSelect öffnet ein
   Panel), Montag zuerst wie im Schweizer Kalender. Die Chips sind
   Ein/Aus-Schalter (`aria-pressed`); das Kürzel steht sichtbar, der volle
   Name für Screenreader; eine Fehlermeldung hängt per `aria-describedby`
   am Fieldset. */
export function WochentagWahl({
  wert,
  onChange,
  error,
}: {
  wert: readonly Wochentag[];
  onChange: (w: Wochentag[]) => void;
  error?: string;
}) {
  const fehlerId = useId();
  return (
    <fieldset aria-describedby={error ? fehlerId : undefined}>
      <legend className="mb-2 type-body-small text-on-surface-mittel">Wochentage</legend>
      <div className="flex flex-wrap gap-2">
        {WOCHENTAGE.map((w) => (
          <FilterChip
            key={w}
            selected={wert.includes(w)}
            onClick={() => onChange(wert.includes(w) ? wert.filter((x) => x !== w) : [...wert, w].sort())}
          >
            <span aria-hidden>{WOCHENTAG_KURZ[w]}</span>
            <span className="sr-only">{WOCHENTAG_LANG[w]}</span>
          </FilterChip>
        ))}
      </div>
      {error && <p id={fehlerId} role="alert" className="mt-1 type-body-small text-error">{error}</p>}
    </fieldset>
  );
}
