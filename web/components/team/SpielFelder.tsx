"use client";

import { useState } from "react";
import { DateField, TextField, TimeField } from "@/components/ui";
import {
  BEZEICHNUNG_MAX,
  RICHTWERT_MAX,
  RICHTWERT_MIN,
  SPIEL_TEXT,
  bezeichnungProblem,
  meldefristProblem,
  richtwertProblem,
} from "@/lib/spiel";
import { zahlOderNull } from "@/lib/termin";

/** Was ein Spiel im Dialog trägt (#459, #463): Bezeichnung, Richtwert und
 *  Meldefrist (Datum und Uhrzeit), solange getippt wird als Text. */
export type SpielEingabe = { bezeichnung: string; min: string; max: string; fristDatum: string; fristZeit: string };

export const SPIEL_LEER: SpielEingabe = { bezeichnung: "", min: "", max: "", fristDatum: "", fristZeit: "" };

/** Die Eingabe einer gespeicherten Frist `YYYY-MM-DDTHH:MM`. */
export function fristEingabe(frist: string | null | undefined): Pick<SpielEingabe, "fristDatum" | "fristZeit"> {
  return frist ? { fristDatum: frist.slice(0, 10), fristZeit: frist.slice(11, 16) } : { fristDatum: "", fristZeit: "" };
}

/** Was die Meldefrist bedeutet — ein fester Hinweis hinter dem ⓘ (#463 AK 9, 10). */
const MELDEFRIST_INFO = "Bis dann melden Eltern über ihren Link. Ohne Frist melden sie bis zum Anpfiff. Mitglieder melden immer bis zum Anpfiff.";

type Feld = "bezeichnung" | "mindestzahl" | "hoechstzahl" | "meldefrist";

/** Was der Richtwert bedeutet — ein fester Hinweis hinter dem ⓘ. */
const RICHTWERT_INFO = "Wie viele Spieler:innen das Team für dieses Spiel anstrebt. Mindest- und Höchstzahl begrenzen keine Anmeldungen.";

/** Bezeichnung und Richtwert eines Spiels samt Prüfung beim Speichern —
 *  dieselben Regeln wie der Fachkern (lib/spiel.ts). */
export function useSpielAngaben(start: SpielEingabe = SPIEL_LEER) {
  const [wert, setWert] = useState<SpielEingabe>(start);
  const [problem, setProblem] = useState<{ feld: Feld; text: string } | null>(null);
  return {
    wert,
    setze: (w: Partial<SpielEingabe>) => setWert((x) => ({ ...x, ...w })),
    zuruecksetzen: (w: SpielEingabe = SPIEL_LEER) => {
      setWert(w);
      setProblem(null);
    },
    /** Geprüft und in der gespeicherten Form, sonst `null` (Fehler am Feld).
     *  Die Frist prüft sich gegen Datum und Anpfiff des Spiels. */
    pruefe(
      datum: string,
      beginn: string,
    ): { bezeichnung: string; richtwertMin: number | null; richtwertMax: number | null; meldefrist: string | null } | null {
      const min = zahlOderNull(wert.min);
      const max = zahlOderNull(wert.max);
      const halb = !!wert.fristDatum !== !!wert.fristZeit;
      const frist = wert.fristDatum && wert.fristZeit ? `${wert.fristDatum}T${wert.fristZeit}` : null;
      const p =
        bezeichnungProblem(wert.bezeichnung) ??
        richtwertProblem(min, max) ??
        (halb ? { feld: "meldefrist" as const, text: SPIEL_TEXT.meldefristFormat } : null) ??
        (frist && datum && beginn ? meldefristProblem(datum, beginn, frist) : null);
      setProblem(p);
      return p ? null : { bezeichnung: wert.bezeichnung.trim(), richtwertMin: min, richtwertMax: max, meldefrist: frist };
    },
    problem,
  };
}

type Angaben = ReturnType<typeof useSpielAngaben>;
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

/** Die Meldefrist der Eltern (#463 AK 8): Datum und Uhrzeit, beide frei,
 *  nur zusammen. */
export function MeldefristFelder({ angaben, disabled }: { angaben: Angaben; disabled?: boolean }) {
  const { wert, setze } = angaben;
  const fehler = fehlerVon(angaben, "meldefrist");
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <DateField
        label="Meldefrist für Eltern (optional)"
        className="flex-1"
        value={wert.fristDatum}
        disabled={disabled}
        onChange={(e) => setze({ fristDatum: e.target.value })}
        info={MELDEFRIST_INFO}
        error={!!fehler}
        supportingText={fehler}
      />
      <TimeField
        label="Uhrzeit"
        className="flex-1"
        value={wert.fristZeit}
        disabled={disabled}
        onChange={(e) => setze({ fristZeit: e.target.value })}
        error={!!fehler}
      />
    </div>
  );
}
