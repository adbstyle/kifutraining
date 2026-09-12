"use client";

import { TextField } from "@/components/ui";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/uebung-form";

/** Die Spielfeldgrösse einer Junioren-Übung (Story 3 AK 8).
 *
 *  Zwei Masse in Metern, wie das Manual Fussball Jugendliche sie führt — «35 ×
 *  20 Meter». Es tritt an die Stelle des Feldtyps, den nur der Kinderfussball
 *  kennt.
 *
 *  Optional, aber paarweise: wer sie angibt, gibt Länge UND Breite an
 *  (PO 2026-08-30). Die Prüfung sitzt in `parseUebungsInhalt`, die Regel selbst
 *  in den CHECKs `ex_spielfeld_paarweise` / `ex_spielfeld_bereich`.
 *
 *  Layout wie das Paar «Anzahl Kinder» darunter: zwei Zahlenfelder mit einem
 *  Trennzeichen — dort ein Bis-Strich, hier ein Mal-Zeichen, weil es keine
 *  Spanne ist, sondern zwei Kanten. */
export function SpielfeldgroesseField({
  laenge,
  breite,
  onLaengeChange,
  onBreiteChange,
  error,
}: {
  laenge: string;
  breite: string;
  onLaengeChange: (wert: string) => void;
  onBreiteChange: (wert: string) => void;
  error?: string;
}) {
  return (
    <div>
      <p
        className={`type-label-small mb-2 ${error ? "text-error" : "text-on-surface-mittel"}`}
      >
        Spielfeldgrösse (optional)
      </p>
      <div className="flex items-start gap-3 sm:max-w-sm">
        <TextField
          label="Länge (m)"
          type="number"
          inputMode="numeric"
          min={SPIELFELD_MIN}
          max={SPIELFELD_MAX}
          className="flex-1"
          error={!!error}
          value={laenge}
          onChange={(e) => onLaengeChange(e.target.value)}
        />
        <span
          aria-hidden
          className="type-body-large flex h-14 items-center text-on-surface-mittel"
        >
          ×
        </span>
        <TextField
          label="Breite (m)"
          type="number"
          inputMode="numeric"
          min={SPIELFELD_MIN}
          max={SPIELFELD_MAX}
          className="flex-1"
          error={!!error}
          value={breite}
          onChange={(e) => onBreiteChange(e.target.value)}
        />
      </div>
      <p
        className={`type-body-small mt-1.5 ${error ? "text-error" : "text-on-surface-mittel"}`}
      >
        {error ??
          "In Metern, wie im Manual — z. B. 35 × 20. Entweder beide Masse oder keines."}
      </p>
    </div>
  );
}
