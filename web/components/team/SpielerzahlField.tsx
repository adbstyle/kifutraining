"use client";

import { TextField } from "@/components/ui";
import { SPIELERZAHL_MAX, SPIELERZAHL_MIN, TERMIN_TEXT } from "@/lib/termin";

/** Die erwartete Spielerzahl eines Termins (#390) — ein Zahlenfeld des Kits.
 *  Was sie zählt (PO 7), ist ein fester Hinweis und steht darum hinter dem ⓘ;
 *  unter dem Feld steht nur ein Fehler. Leer heisst unbekannt.
 *  Kontrolliert: Die Zahl bleibt Text, solange
 *  getippt wird; geprüft wird beim Speichern (`spielerzahlProblem`). */
export function SpielerzahlField({
  wert,
  onChange,
  fehler,
  disabled,
}: {
  wert: string;
  onChange: (wert: string) => void;
  fehler?: string;
  disabled?: boolean;
}) {
  return (
    <TextField
      label="Erwartete Spielerzahl (optional)"
      type="number"
      inputMode="numeric"
      min={SPIELERZAHL_MIN}
      max={SPIELERZAHL_MAX}
      value={wert}
      disabled={disabled}
      error={!!fehler}
      info={TERMIN_TEXT.spielerzahlZaehlt}
      supportingText={fehler}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
