// Die Felder eines Termins (Story #389, Epic #388 PO 1–6).
//
// Der Platz eines Termins besteht aus einem oder mehreren GETRENNTEN,
// gleichzeitig nutzbaren Feldern; sie lassen sich nicht zu einer grösseren
// Fläche zusammenlegen (OoS 2). Je Feld:
//   - Länge und Breite der Fläche, die dem Team zur Verfügung steht (auf
//     einem geteilten Platz nur der eigene Teil), in ganzen Metern — nur
//     gemeinsam, wie die Spielfeldgrösse einer Übung (lib/feldmass.ts);
//   - die Tore je Torart: Minitore, 5-m-Tore, 7-m-Tore (Hütchen- und
//     Markierungstore zählen nicht, OoS 3);
//   - der Untergrund aus einer festen Auswahl.
// Jede Angabe ist freiwillig: `null` heisst unbekannt, `0` Tore einer Torart
// heisst ausdrücklich keine (PO 5). Ein Termin ohne Felder (`null`) hat einen
// unbekannten Platz.
//
// Eine Regelquelle für den Termin-Dialog und die KI-Werkzeuge «termin_*»:
// Der Fachkern (lib/kern/termine.ts) prüft mit `felderProblem` vor dem
// Schreiben; die Datenebene prüft dieselbe Regel als Rückhalt
// (`termin_felder_gueltig()`, CHECK `tt_felder`) und meldet mit
// `FELDER_TEXT.ungueltig`.
//
// Gespeichert wird die Form `Feld` unverändert als jsonb
// (`training_termine.felder`); die Schlüssel sind darum snake_case, und die
// KI liest und schreibt dieselbe Form.
//
// REIN: importiert nur lib/feldmass.ts — `check:kern` lädt diese Datei mit tsx.
import { MASS_TEXT, SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/feldmass";

export const TORARTEN = ["minitor", "tor_5m", "tor_7m"] as const;
export type Torart = (typeof TORARTEN)[number];

/** Die Torarten zum Anzeigen — als Feldname und vor der Zahl
 *  («Minitore: 4»), damit nie eine Zahl direkt vor «5-m» steht. */
export const TORART_LABEL: Record<Torart, string> = {
  minitor: "Minitore",
  tor_5m: "5-m-Tore",
  tor_7m: "7-m-Tore",
};

export const UNTERGRUENDE = ["naturrasen", "kunstrasen", "hartplatz", "halle"] as const;
export type Untergrund = (typeof UNTERGRUENDE)[number];

export const UNTERGRUND_LABEL: Record<Untergrund, string> = {
  naturrasen: "Naturrasen",
  kunstrasen: "Kunstrasen",
  hartplatz: "Hartplatz",
  halle: "Halle",
};

export type Feld = {
  laenge_m: number | null;
  breite_m: number | null;
  tore: Record<Torart, number | null>;
  untergrund: Untergrund | null;
};

/** Mindestens ein Feld; `null` (nicht `[]`) heisst «Platz unbekannt». */
export type Felder = Feld[];

/** Ein Feld, wie es von aussen kommt (KI-Werkzeug): Fehlende Angaben sind
 *  unbekannt. Die Werte sind noch ungeprüft. */
export type FeldEingabe = {
  laenge_m?: number | null;
  breite_m?: number | null;
  tore?: Partial<Record<Torart, number | null>> | null;
  untergrund?: string | null;
};

/** Die grösste Zahl Tore, die beide Zwillinge exakt kennen — keine fachliche
 *  Obergrenze (PO 6), nur die der JavaScript-Zahl (2^53 - 1). */
const TORE_MAX = Number.MAX_SAFE_INTEGER;

export const FELDER_TEXT = {
  paarweise: MASS_TEXT.paarweise,
  bereich: MASS_TEXT.bereich,
  tore: "Die Zahl der Tore ist eine ganze Zahl ab 0; leer heisst unbekannt.",
  untergrund: "Bitte einen Untergrund aus der Auswahl wählen: Naturrasen, Kunstrasen, Hartplatz oder Halle.",
  /** Über die Oberfläche unerreichbar — nur eine KI-Eingabe kann die Form verfehlen. */
  form:
    "Ein Feld nennt Länge und Breite in Metern, die Tore je Torart (minitor, tor_5m, tor_7m) und den Untergrund.",
  /** Der Rückhalt der Datenebene (CHECK `tt_felder`), wenn ein Weg die
   *  Vorab-Prüfung umgeht. */
  ungueltig:
    `Die Felder des Termins sind nicht gültig erfasst: Länge und Breite gemeinsam in ganzen Metern von ${SPIELFELD_MIN} bis ${SPIELFELD_MAX}, ` +
    "Tore als ganze Zahl ab 0, der Untergrund aus der Auswahl.",
} as const;

/** Die festen Hinweise der Oberfläche je Angabe eines Felds — sie stehen
 *  hinter dem ⓘ des jeweiligen Eingabefelds (Styleguide, Formularfelder ›
 *  Hinweise). Gegenstück für den KI-Assistenten ist `FELDER_MODELL` in
 *  lib/termin-felder-ausgabe.ts: dieselbe Regel (leer = unbekannt, 0 Tore =
 *  keine), dort in den Worten der Werkzeug-Schnittstelle (null statt leer). */
export const FELD_HINWEIS = {
  /** Zur ganzen Liste, am «Feld hinzufügen». */
  liste:
    "Ein Feld ist eine eigene Fläche, die euch zur Verfügung steht - auf einem geteilten Platz nur euer Teil. " +
    "Mehrere Felder nutzt ihr gleichzeitig; sie lassen sich nicht zu einer grösseren Fläche zusammenlegen.",
  masse: (seite: "Länge" | "Breite") =>
    `${seite} der Fläche, die euch zur Verfügung steht, in ganzen Metern. Leer heisst unbekannt.`,
  tore: (torart: string) => `Wie viele ${torart} auf diesem Feld stehen. Leer heisst unbekannt, 0 heisst keine.`,
} as const;

/** Wo eine Angabe nicht stimmt: das Feld (0-basiert) und die Angabe darin;
 *  `index: null` betrifft die Liste als Ganzes, `teil: null` das Feld als Ganzes. */
export type FeldTeil = "laenge_m" | "breite_m" | `tore.${Torart}` | "untergrund";
export type FelderProblem = { index: number | null; teil: FeldTeil | null; text: string };

const istObjekt = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const genauDieSchluessel = (o: Record<string, unknown>, schluessel: readonly string[]) => {
  const k = Object.keys(o).sort();
  const s = [...schluessel].sort();
  return k.length === s.length && k.every((x, i) => x === s[i]);
};

const istMass = (x: unknown) =>
  typeof x === "number" && Number.isInteger(x) && x >= SPIELFELD_MIN && x <= SPIELFELD_MAX;
const istToranzahl = (x: unknown) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= TORE_MAX;

export const istUntergrund = (x: unknown): x is Untergrund =>
  typeof x === "string" && (UNTERGRUENDE as readonly string[]).includes(x);

/** Was an den Feldern eines Termins nicht stimmt, sonst `null` — die erste
 *  Stelle in Lesereihenfolge. Zwilling von `termin_felder_gueltig()`
 *  (Migration termin_felder): beide nehmen genau dieselben Werte an.
 *  `null` ist gültig (Platz unbekannt), eine leere Liste nicht —
 *  `normalisiereFelder` macht aus `[]` schon `null`. */
export function felderProblem(felder: unknown): FelderProblem | null {
  if (felder === null) return null;
  if (!Array.isArray(felder) || felder.length === 0) return { index: null, teil: null, text: FELDER_TEXT.form };
  for (let index = 0; index < felder.length; index++) {
    const f: unknown = felder[index];
    if (!istObjekt(f) || !genauDieSchluessel(f, ["laenge_m", "breite_m", "tore", "untergrund"]))
      return { index, teil: null, text: FELDER_TEXT.form };
    // Länge und Breite nur gemeinsam (AK 9).
    if ((f.laenge_m === null) !== (f.breite_m === null))
      return { index, teil: f.laenge_m === null ? "laenge_m" : "breite_m", text: FELDER_TEXT.paarweise };
    for (const teil of ["laenge_m", "breite_m"] as const)
      if (f[teil] !== null && !istMass(f[teil])) return { index, teil, text: FELDER_TEXT.bereich };
    if (!istObjekt(f.tore) || !genauDieSchluessel(f.tore, TORARTEN))
      return { index, teil: null, text: FELDER_TEXT.form };
    for (const art of TORARTEN)
      if (f.tore[art] !== null && !istToranzahl(f.tore[art]))
        return { index, teil: `tore.${art}`, text: FELDER_TEXT.tore };
    if (f.untergrund !== null && !istUntergrund(f.untergrund))
      return { index, teil: "untergrund", text: FELDER_TEXT.untergrund };
  }
  return null;
}

/** Der Eingabename einer Stelle für das KI-Werkzeug, etwa «felder[1].tore.minitor». */
export function felderPfad(p: FelderProblem): string {
  if (p.index === null) return "felder";
  return `felder[${p.index}]${p.teil ? `.${p.teil}` : ""}`;
}

/** Felder in die gespeicherte Form bringen: fehlende Angaben werden `null`
 *  (unbekannt), die Schlüssel stehen in fester Reihenfolge, und eine leere
 *  Liste heisst «ohne Felder» (`null`). Geprüft wird hier nichts — das tut
 *  `felderProblem` auf dem Ergebnis; ein Wert ausserhalb der Form bleibt
 *  stehen, damit es ihn meldet — auch keine Liste (etwa eine präparierte
 *  Nutzlast einer Server Action): Sie ergibt die Fachmeldung, keinen
 *  TypeError. */
export function normalisiereFelder(felder: readonly FeldEingabe[] | null | undefined): Felder | null {
  if (felder === null || felder === undefined) return null;
  if (!Array.isArray(felder)) return felder as unknown as Felder;
  if (felder.length === 0) return null;
  return felder.map((f: unknown) => {
    if (!istObjekt(f)) return f as unknown as Feld;
    const tore = f.tore ?? {};
    return {
      laenge_m: f.laenge_m ?? null,
      breite_m: f.breite_m ?? null,
      tore: istObjekt(tore)
        ? { minitor: tore.minitor ?? null, tor_5m: tore.tor_5m ?? null, tor_7m: tore.tor_7m ?? null }
        : tore,
      untergrund: f.untergrund ?? null,
    } as Feld;
  });
}

/** Sind zwei Angaben zu den Feldern dieselben? Verglichen wird die
 *  gespeicherte Form — eine jsonb-Spalte kommt mit anderer Schlüsselfolge
 *  zurück, als sie geschrieben wurde; `undefined`, `null` und `[]` heissen
 *  gleichermassen «ohne Felder». */
export function gleicheFelder(
  a: readonly FeldEingabe[] | null | undefined,
  b: readonly FeldEingabe[] | null | undefined,
): boolean {
  return JSON.stringify(normalisiereFelder(a)) === JSON.stringify(normalisiereFelder(b));
}

// ── Anzeige ──────────────────────────────────────────────────────────────────

const masse = (f: Feld) => (f.laenge_m !== null && f.breite_m !== null ? `${f.laenge_m} × ${f.breite_m} m` : null);

/** Die Tore eines Feldes als Text: «Minitore: 4, 5-m-Tore: keine» — die
 *  Torart vor der Zahl, sonst läse sich «2 5-m-Tore» als «25 m». Unbekannte
 *  Torarten fehlen; `null`, wenn keine bekannt ist. */
export function toreText(tore: Feld["tore"]): string | null {
  const teile = TORARTEN.flatMap((art) => {
    const n = tore[art];
    return n === null ? [] : [`${TORART_LABEL[art]}: ${n === 0 ? "keine" : n}`];
  });
  return teile.length > 0 ? teile.join(", ") : null;
}

/** Der Name eines Feldes in einer Aufzählung: «Feld» allein, «Feld 1» …
 *  ab zwei Feldern. */
export function feldName(index: number, anzahl: number): string {
  return anzahl > 1 ? `Feld ${index + 1}` : "Feld";
}

/** Ein Feld ausführlich — für den geöffneten Termin und die
 *  Durchführen-Ansicht (AK 11, 14): Grösse, Tore, Untergrund; was unbekannt
 *  ist, steht als «unbekannt» da, damit es nicht wie «keine» aussieht. */
export function feldText(f: Feld): string {
  return [
    masse(f) ?? "Grösse unbekannt",
    toreText(f.tore) ?? "Tore unbekannt",
    f.untergrund ? UNTERGRUND_LABEL[f.untergrund] : "Untergrund unbekannt",
  ].join(" · ");
}

/** Die Felder knapp — für die Karte im Trainingsplan (AK 10): ein Feld mit
 *  Grösse und Untergrund, soweit bekannt («30 × 30 m · Kunstrasen»), mehrere
 *  als Zahl («2 Felder»). `null` ohne Felder: Die Karte zeigt dann nichts. */
export function felderKurz(felder: Felder | null): string | null {
  if (!felder || felder.length === 0) return null;
  if (felder.length > 1) return `${felder.length} Felder`;
  const f = felder[0];
  const teile = [masse(f), f.untergrund ? UNTERGRUND_LABEL[f.untergrund] : null].filter(Boolean);
  return teile.length > 0 ? teile.join(" · ") : "1 Feld";
}
