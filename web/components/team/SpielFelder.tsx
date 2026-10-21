"use client";

import { useState } from "react";
import { TextField } from "@/components/ui";
import { BEZEICHNUNG_MAX, RICHTWERT_MAX, RICHTWERT_MIN, bezeichnungProblem, richtwertProblem } from "@/lib/spiel";
import { zahlOderNull } from "@/lib/termin";

/** Was ein Spiel im Dialog trägt (#459): Bezeichnung und Richtwert, solange
 *  getippt wird als Text. */
export type SpielEingabe = { bezeichnung: string; min: string; max: string };

export const SPIEL_LEER: SpielEingabe = { bezeichnung: "", min: "", max: "" };

/** Was der Richtwert bedeutet — ein fester Hinweis hinter dem ⓘ. */
const RICHTWERT_INFO = "Wie viele Spieler:innen das Team für dieses Spiel anstrebt. Mindest- und Höchstzahl begrenzen keine Anmeldungen.";

/** Bezeichnung und Richtwert eines Spiels samt Prüfung beim Speichern —
 *  dieselben Regeln wie der Fachkern (lib/spiel.ts). */
export function useSpielAngaben(start: SpielEingabe = SPIEL_LEER) {
  const [wert, setWert] = useState<SpielEingabe>(start);
  const [problem, setProblem] = useState<{ feld: "bezeichnung" | "mindestzahl" | "hoechstzahl"; text: string } | null>(null);
  return {
    wert,
    setze: (w: Partial<SpielEingabe>) => setWert((x) => ({ ...x, ...w })),
    zuruecksetzen: (w: SpielEingabe = SPIEL_LEER) => {
      setWert(w);
      setProblem(null);
    },
    /** Geprüft und in der gespeicherten Form, sonst `null` (Fehler am Feld). */
    pruefe(): { bezeichnung: string; richtwertMin: number | null; richtwertMax: number | null } | null {
      const min = zahlOderNull(wert.min);
      const max = zahlOderNull(wert.max);
      const p = bezeichnungProblem(wert.bezeichnung) ?? richtwertProblem(min, max);
      setProblem(p);
      return p ? null : { bezeichnung: wert.bezeichnung.trim(), richtwertMin: min, richtwertMax: max };
    },
    problem,
  };
}

type Angaben = ReturnType<typeof useSpielAngaben>;
type Feld = "bezeichnung" | "mindestzahl" | "hoechstzahl";
const fehlerVon = (a: Angaben, k: Feld) => (a.problem?.feld === k ? a.problem.text : undefined);

/** Die Bezeichnung eines Spiels (Pflicht) — gleich nach der Art. */
export function BezeichnungFeld({ angaben, disabled }: { angaben: Angaben; disabled?: boolean }) {
  return (
    <TextField
      label="Bezeichnung"
      maxLength={BEZEICHNUNG_MAX}
      value={angaben.wert.bezeichnung}
      disabled={disabled}
      onChange={(e) => angaben.setze({ bezeichnung: e.target.value })}
      error={!!fehlerVon(angaben, "bezeichnung")}
      supportingText={fehlerVon(angaben, "bezeichnung")}
    />
  );
}

/** Mindest- und Höchstzahl (frei), nebeneinander. */
export function RichtwertFelder({ angaben, disabled }: { angaben: Angaben; disabled?: boolean }) {
  const { wert, setze } = angaben;
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <TextField
        label="Mindestzahl (optional)"
        className="flex-1"
        type="number"
        inputMode="numeric"
        min={RICHTWERT_MIN}
        max={RICHTWERT_MAX}
        value={wert.min}
        disabled={disabled}
        onChange={(e) => setze({ min: e.target.value })}
        info={RICHTWERT_INFO}
        error={!!fehlerVon(angaben, "mindestzahl")}
        supportingText={fehlerVon(angaben, "mindestzahl")}
      />
      <TextField
        label="Höchstzahl (optional)"
        className="flex-1"
        type="number"
        inputMode="numeric"
        min={RICHTWERT_MIN}
        max={RICHTWERT_MAX}
        value={wert.max}
        disabled={disabled}
        onChange={(e) => setze({ max: e.target.value })}
        error={!!fehlerVon(angaben, "hoechstzahl")}
        supportingText={fehlerVon(angaben, "hoechstzahl")}
      />
    </div>
  );
}
