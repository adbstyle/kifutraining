"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DateField, HinzufuegenFeld, IconButton, Select, TextField, TimeField } from "@/components/ui";
import {
  ANREISEARTEN,
  ANREISE_TEXT,
  BEZEICHNUNG_MAX,
  TREFFPUNKTE_MAX,
  TREFFPUNKT_ORT_MAX,
  istAnreise,
  meldefristVorlauf,
  meldefristZeitpunkt,
  treffpunkteNormal,
  type Anreise,
  type Treffpunkt,
  RICHTWERT_MAX,
  RICHTWERT_MIN,
  SPIEL_TEXT,
  bezeichnungProblem,
  meldefristProblem,
  richtwertProblem,
} from "@/lib/spiel";
import { zahlOderNull } from "@/lib/termin";

/** Ein Treffpunkt im Dialog (#465), solange getippt wird als Text. */
export type TreffpunktZeileEingabe = { key: string; anreise: Anreise | ""; datum: string; zeit: string; ort: string };

/** Was ein Spiel im Dialog trägt (#459, #463, #465): Bezeichnung, Richtwert,
 *  Meldefrist (Datum und Uhrzeit) und Treffpunkte, solange getippt wird als
 *  Text. */
export type SpielEingabe = {
  bezeichnung: string;
  min: string;
  max: string;
  fristDatum: string;
  fristZeit: string;
  treffpunkte: TreffpunktZeileEingabe[];
};

export const SPIEL_LEER: SpielEingabe = { bezeichnung: "", min: "", max: "", fristDatum: "", fristZeit: "", treffpunkte: [] };

/** Die Eingabe gespeicherter Treffpunkte. */
export function treffpunkteEingabe(liste: readonly Treffpunkt[] | undefined): TreffpunktZeileEingabe[] {
  return (liste ?? []).map((t) => ({
    key: crypto.randomUUID(),
    anreise: t.anreise,
    datum: t.zeitpunkt.slice(0, 10),
    zeit: t.zeitpunkt.slice(11, 16),
    ort: t.ort ?? "",
  }));
}

/** Ein Wanduhr-Zeitpunkt, der seinen Abstand zum Anpfiff behält, wenn das
 *  Spiel im Dialog verlegt wird (#463 PC 3, #465 PC 2); unverändert, wenn
 *  er unvollständig ist. */
function mitAnpfiff(datum: string, zeit: string, alt: string, neu: string): { datum: string; zeit: string } {
  if (!datum || !zeit) return { datum, zeit };
  const v = meldefristVorlauf(alt.slice(0, 10), alt.slice(11), `${datum}T${zeit}`);
  if (v === null) return { datum, zeit };
  const z = meldefristZeitpunkt(neu.slice(0, 10), neu.slice(11), v);
  return { datum: z.slice(0, 10), zeit: z.slice(11, 16) };
}

/** Die Eingabe einer gespeicherten Frist `YYYY-MM-DDTHH:MM`. */
export function fristEingabe(frist: string | null | undefined): Pick<SpielEingabe, "fristDatum" | "fristZeit"> {
  return frist ? { fristDatum: frist.slice(0, 10), fristZeit: frist.slice(11, 16) } : { fristDatum: "", fristZeit: "" };
}

/** Was die Meldefrist bedeutet — ein fester Hinweis hinter dem ⓘ (#463 AK 9, 10). */
const MELDEFRIST_INFO = "Bis dann melden Eltern über ihren Link. Ohne Frist melden sie bis zum Anpfiff. Mitglieder melden immer bis zum Anpfiff.";

type Feld = "bezeichnung" | "mindestzahl" | "hoechstzahl" | "meldefrist" | "treffpunkte";

/** Was der Richtwert bedeutet — ein fester Hinweis hinter dem ⓘ. */
const RICHTWERT_INFO = "Wie viele Spieler:innen das Team für dieses Spiel anstrebt. Mindest- und Höchstzahl begrenzen keine Anmeldungen.";

/** Bezeichnung, Richtwert, Meldefrist und Treffpunkte eines Spiels samt
 *  Prüfung beim Speichern — dieselben Regeln wie der Fachkern
 *  (lib/spiel.ts). `datum`/`beginn` sind der Anpfiff im Dialog: Wird er
 *  verlegt, rücken Meldefrist und Treffpunkte im selben Abstand mit, wie
 *  beim Speichern auch (#463 PC 3, #465 PC 2). */
export function useSpielAngaben(datum: string, beginn: string) {
  const [wert, setWert] = useState<SpielEingabe>(SPIEL_LEER);
  const [problem, setProblem] = useState<{ feld: Feld; index?: number | null; text: string } | null>(null);
  const anpfiff = datum && beginn ? `${datum}T${beginn.slice(0, 5)}` : null;
  const bisher = useRef<string | null>(null);
  useEffect(() => {
    if (!anpfiff) return;
    const alt = bisher.current;
    bisher.current = anpfiff;
    if (!alt || alt === anpfiff) return;
    setWert((w) => {
      const frist = mitAnpfiff(w.fristDatum, w.fristZeit, alt, anpfiff);
      return {
        ...w,
        fristDatum: frist.datum,
        fristZeit: frist.zeit,
        treffpunkte: w.treffpunkte.map((t) => ({ ...t, ...mitAnpfiff(t.datum, t.zeit, alt, anpfiff) })),
      };
    });
  }, [anpfiff]);
  return {
    wert,
    setze: (w: Partial<SpielEingabe>) => setWert((x) => ({ ...x, ...w })),
    /** Beim Öffnen: Ab dem Anpfiff des Spiels, das der Dialog zeigt
     *  (`YYYY-MM-DDTHH:MM`), rückt alles mit; der Stand eines anderen nie. */
    zuruecksetzen: (w: SpielEingabe = SPIEL_LEER, anpfiffStart: string | null = null) => {
      bisher.current = anpfiffStart;
      setWert(w);
      setProblem(null);
    },
    /** Geprüft und in der gespeicherten Form, sonst `null` (Fehler am Feld).
     *  Die Frist prüft sich gegen Datum und Anpfiff des Spiels. */
    pruefe(): {
      bezeichnung: string;
      richtwertMin: number | null;
      richtwertMax: number | null;
      meldefrist: string | null;
      treffpunkte: Treffpunkt[];
    } | null {
      const min = zahlOderNull(wert.min);
      const max = zahlOderNull(wert.max);
      const halb = !!wert.fristDatum !== !!wert.fristZeit;
      const frist = wert.fristDatum && wert.fristZeit ? `${wert.fristDatum}T${wert.fristZeit}` : null;
      const eingabe = wert.treffpunkte.map((t) => ({
        anreise: t.anreise,
        zeitpunkt: t.datum && t.zeit ? `${t.datum}T${t.zeit}` : "",
        ort: t.anreise === "vor_ort" ? null : t.ort,
      }));
      // Ohne gültigen Anpfiff meldet das Feld «Anpfiff» den Fehler, nicht jede Zeile.
      const tp = datum && beginn ? treffpunkteNormal(eingabe, datum, beginn) : null;
      const p =
        bezeichnungProblem(wert.bezeichnung) ??
        richtwertProblem(min, max) ??
        (halb ? { feld: "meldefrist" as const, text: SPIEL_TEXT.meldefristFormat } : null) ??
        (frist && datum && beginn ? meldefristProblem(datum, beginn, frist) : null) ??
        (tp && !tp.ok ? tp.problem : null);
      setProblem(p);
      if (p) return null;
      return {
        bezeichnung: wert.bezeichnung.trim(),
        richtwertMin: min,
        richtwertMax: max,
        meldefrist: frist,
        treffpunkte: eingabe.flatMap((t) =>
          istAnreise(t.anreise) ? [{ anreise: t.anreise, zeitpunkt: t.zeitpunkt, ort: t.ort?.trim() || null }] : [],
        ),
      };
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

/** Was Treffpunkte sind — ein fester Hinweis hinter dem ⓘ (#465). */
const TREFFPUNKTE_INFO =
  "Wann sich das Team vor Ort und wann und wo es sich je Anreiseart trifft, je Anreiseart einmal. Die Eltern sehen die Treffpunkte über ihren Link. Wird das Spiel verlegt, behalten sie ihren Abstand zum Anpfiff.";

/* Die Treffpunkte eines Spiels (#465 AK 1–7): je Treffpunkt ein umrandeter
   Block wie die Felder des Platzes (FelderField) — Anreiseart, Datum und
   Uhrzeit, ausser vor Ort ein Ort. Das Datum steht mit dem Spieltag vor;
   ein anderer Tag ist erlaubt (AK 5). Jede Anreiseart lässt sich nur einmal
   wählen; nach fünf ist keine mehr frei (AK 6). Ein neuer Treffpunkt
   startet ohne Anreiseart (AK 2: Sie ist zu wählen). */
export function TreffpunkteFelder({
  angaben,
  spieltag,
  disabled,
}: {
  angaben: Angaben;
  /** Das Datum des Spiels im Dialog — Vorgabe für einen neuen Treffpunkt. */
  spieltag: string;
  disabled?: boolean;
}) {
  const zeilen = angaben.wert.treffpunkte;
  const setze = (z: TreffpunktZeileEingabe[]) => angaben.setze({ treffpunkte: z });
  const aendere = (key: string, teil: Partial<TreffpunktZeileEingabe>) =>
    setze(zeilen.map((z) => (z.key === key ? { ...z, ...teil } : z)));
  const problem = angaben.problem?.feld === "treffpunkte" ? angaben.problem : null;
  const fehlerAn = (i: number) => (problem && problem.index === i ? problem.text : undefined);

  return (
    <div role="group" aria-label="Treffpunkte" className="flex flex-col gap-3">
      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-3">
          {zeilen.map((z, i) => {
            const titel = z.anreise ? `Treffpunkt ${ANREISE_TEXT[z.anreise]}` : `Treffpunkt ${i + 1}`;
            const frei = ANREISEARTEN.filter((a) => a === z.anreise || !zeilen.some((x) => x.anreise === a));
            const fehler = fehlerAn(i);
            return (
              <li key={z.key} role="group" aria-label={titel} className="rounded-flaeche border border-linie p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="type-title-small text-on-surface">{titel}</p>
                  <IconButton
                    type="button"
                    icon={X}
                    label={`${titel} entfernen`}
                    disabled={disabled}
                    onClick={() => setze(zeilen.filter((x) => x.key !== z.key))}
                  />
                </div>
                <div className="mt-2 flex flex-col gap-3">
                  <Select
                    label="Anreise"
                    value={z.anreise}
                    options={frei.map((a) => ({ value: a, label: ANREISE_TEXT[a] }))}
                    disabled={disabled}
                    onChange={(v) => aendere(z.key, { anreise: istAnreise(v) ? v : "" })}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <DateField
                      label="Datum"
                      className="flex-1"
                      value={z.datum}
                      disabled={disabled}
                      onChange={(e) => aendere(z.key, { datum: e.target.value })}
                    />
                    <TimeField
                      label="Uhrzeit"
                      className="flex-1"
                      value={z.zeit}
                      disabled={disabled}
                      onChange={(e) => aendere(z.key, { zeit: e.target.value })}
                    />
                  </div>
                  {z.anreise === "vor_ort" ? (
                    <p className="type-body-small px-3.5 text-on-surface-mittel">Es gilt der Ort des Spiels.</p>
                  ) : (
                    <TextField
                      label="Ort"
                      maxLength={TREFFPUNKT_ORT_MAX}
                      value={z.ort}
                      disabled={disabled}
                      onChange={(e) => aendere(z.key, { ort: e.target.value })}
                    />
                  )}
                  {fehler && <p className="type-body-small px-3.5 text-error">{fehler}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {problem && problem.index == null && <p className="type-body-small px-3.5 text-error">{problem.text}</p>}
      <HinzufuegenFeld
        info={TREFFPUNKTE_INFO}
        disabled={disabled || zeilen.length >= TREFFPUNKTE_MAX}
        onClick={() => setze([...zeilen, { key: crypto.randomUUID(), anreise: "", datum: spieltag, zeit: "", ort: "" }])}
      >
        Treffpunkt hinzufügen (optional)
      </HinzufuegenFeld>
    </div>
  );
}
