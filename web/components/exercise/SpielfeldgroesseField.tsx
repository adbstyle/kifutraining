"use client";

import { TextField } from "@/components/ui";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/feldmass";

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
 *  Zwei Felder untereinander, jedes mit eigenem Namen wie jedes andere Feld
 *  der Maske — kein gemeinsamer Name über zwei Teilnamen (PO 2026-10-04).
 *  Ein Fehler betrifft das Paar: Rot sind beide, die Meldung steht unter dem
 *  zweiten. */
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
    <>
      <TextField
        label="Spielfeldlänge (m, optional)"
        type="number"
        inputMode="numeric"
        min={SPIELFELD_MIN}
        max={SPIELFELD_MAX}
        error={!!error}
        value={laenge}
        onChange={(e) => onLaengeChange(e.target.value)}
      />
      <TextField
        label="Spielfeldbreite (m, optional)"
        type="number"
        inputMode="numeric"
        min={SPIELFELD_MIN}
        max={SPIELFELD_MAX}
        error={!!error}
        supportingText={error}
        value={breite}
        onChange={(e) => onBreiteChange(e.target.value)}
      />
    </>
  );
}
