"use client";

import { useState } from "react";
import { spielerzahlProblem, zahlOderNull } from "@/lib/termin";
import { felderProblem, type Felder, type FelderProblem } from "@/lib/termin-felder";
import { felderAusZeilen, zeilenAusFeldern, type FeldZeile } from "./FelderField";

/** Die Angaben zum Platz in einem Termin-Dialog: erwartete Spielerzahl (#390)
 *  und Felder (#389). Einmal für Erstellen und Ändern — Zustand, Zurücksetzen
 *  beim Öffnen, die Prüfung mit den Regeln des Fachkerns und die Props der
 *  beiden Bausteine (`SpielerzahlField`, `FelderField`). */
export function usePlatzAngaben() {
  const [zeilen, setZeilen] = useState<FeldZeile[]>([]);
  const [felderFehler, setFelderFehler] = useState<FelderProblem | null>(null);
  const [spielerzahl, setSpielerzahl] = useState("");
  const [spielerzahlFehler, setSpielerzahlFehler] = useState<string | undefined>();

  /** Auf die Angaben des geöffneten Termins (oder leer) zurücksetzen. */
  function zuruecksetzen(start?: { felder?: Felder | null; spielerzahl?: number | null }) {
    setZeilen(zeilenAusFeldern(start?.felder));
    setFelderFehler(null);
    setSpielerzahl(start?.spielerzahl != null ? String(start.spielerzahl) : "");
    setSpielerzahlFehler(undefined);
  }

  /** Prüfen und die Fehler an die Felder setzen. Die Werte in der
   *  gespeicherten Form, oder `null`, wenn etwas nicht stimmt. */
  function pruefe(): { felder: Felder | null; spielerzahl: number | null } | null {
    const felder = felderAusZeilen(zeilen);
    const zahl = zahlOderNull(spielerzahl);
    const fp = felderProblem(felder);
    const zp = spielerzahlProblem(zahl);
    setFelderFehler(fp);
    setSpielerzahlFehler(zp?.text);
    return fp || zp ? null : { felder, spielerzahl: zahl };
  }

  return {
    zuruecksetzen,
    pruefe,
    spielerzahlProps: { wert: spielerzahl, onChange: setSpielerzahl, fehler: spielerzahlFehler },
    felderProps: { zeilen, onZeilenChange: setZeilen, problem: felderFehler },
  };
}
