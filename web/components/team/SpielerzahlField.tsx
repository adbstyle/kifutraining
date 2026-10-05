"use client";

import { TextField } from "@/components/ui";
import { SPIELERZAHL_MAX, SPIELERZAHL_MIN, TERMIN_TEXT } from "@/lib/termin";

/** Die erwartete Spielerzahl eines Termins (#390) — ein Zahlenfeld des Kits.
 *  Der Hinweis sagt, was sie zählt (PO 7); ein Fehler tritt an seine Stelle.
 *  Leer heisst unbekannt. Kontrolliert: Die Zahl bleibt Text, solange
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
      label="Erwartete Spieler:innen (optional)"
      type="number"
      inputMode="numeric"
      min={SPIELERZAHL_MIN}
      max={SPIELERZAHL_MAX}
      value={wert}
      disabled={disabled}
      error={!!fehler}
      supportingText={fehler ?? TERMIN_TEXT.spielerzahlZaehlt}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
