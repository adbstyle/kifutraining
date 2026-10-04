"use client";

import { FeldGruppe, TextField } from "@/components/ui";
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
 *  Layout wie das Paar «Anzahl Spieler:innen» darunter: zwei Zahlenfelder mit einem
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
    <FeldGruppe name="Spielfeldgrösse (optional)" fehler={error}>
      <div className="flex items-end gap-3 sm:max-w-sm">
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
          className="type-body-large flex h-9 items-center text-on-surface-mittel"
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
    </FeldGruppe>
  );
}
