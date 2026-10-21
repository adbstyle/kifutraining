// Die Regeln eines Spiels (Epic #448): Termin-Art, Bezeichnung, Richtwert.
//
// Eine Regelquelle für den Kalender der Oberfläche und die KI-Werkzeuge
// «termin_*» — der Fachkern (lib/kern/termine.ts) prüft vorab, die
// Datenebene meldet mit denselben Markern (`SPIEL_MELDUNG`) und Checks
// (`SPIEL_CHECKS`), wenn sie trotzdem abweist (Migration spiele_art).
//
// REIN: keine Imports — `check:kern` lädt diese Datei mit tsx.

/** Ein Termin ist ein Training oder ein Spiel (#459 AK 1); die Art bleibt
 *  (AK 13). Zwilling des Checks `tt_art`. */
export type TerminArt = "training" | "spiel";
export const TERMIN_ARTEN: readonly TerminArt[] = ["training", "spiel"];

export function istTerminArt(x: unknown): x is TerminArt {
  return x === "training" || x === "spiel";
}

/** Zwilling des Checks `tt_spiel_bezeichnung` (#459 AK 10). */
export const BEZEICHNUNG_MAX = 120;

/** Zwilling des Checks `tt_richtwert` (#459 AK 11). */
export const RICHTWERT_MIN = 1;
export const RICHTWERT_MAX = 200;

export const SPIEL_TEXT = {
  bezeichnung: "Bitte eine Bezeichnung angeben.",
  bezeichnungLang: `Die Bezeichnung darf höchstens ${BEZEICHNUNG_MAX} Zeichen lang sein.`,
  richtwert: `Mindest- und Höchstzahl sind ganze Zahlen von ${RICHTWERT_MIN} bis ${RICHTWERT_MAX}.`,
  richtwertReihenfolge: "Die Mindestzahl darf die Höchstzahl nicht übersteigen.",
  /** Im Dialog (#459 AK 1): Die Art ist zu wählen, es gibt keine Vorwahl. */
  artWaehlen: "Bitte wählen, ob der Termin ein Training oder ein Spiel ist.",
  /** KI (#459 AK 19): ein neuer einzelner Termin nennt seine Art. */
  art: "Bitte angeben, ob der Termin ein Training oder ein Spiel ist.",
  /** An einem Spiel: nur, was es dort gibt (AK 14, 16). */
  nurTraining: "Felder und erwartete Spielerzahl gibt es nur bei Trainings.",
  /** Ein Training trägt keine Spielangaben. */
  nurSpiel: "Bezeichnung, Mindest- und Höchstzahl gibt es nur bei Spielen.",
  /** Ein Spiel trägt nie ein Training (#459 AK 14). */
  keinTraining: "Einem Spiel lässt sich kein Training zuordnen.",
  /** Ab- und Anmelden der Trainings an einem Spiel (Meldungen folgen mit #463). */
  istSpiel: "Für ein Spiel gilt diese An- und Abmeldung nicht. Sieh dir das Spiel noch einmal an.",
} as const;

/** Die Sätze zu den Markern der Datenebene — dieselben, die der Fachkern
 *  vorab verwendet. Kein Marker steckt in einem anderen (`check:kern`). */
export const SPIEL_MELDUNG = {
  SPIEL_ANPFIFF_VERGANGEN:
    "Ein Spiel lässt sich nur mit einem Anpfiff erfassen oder verlegen, der noch bevorsteht.",
  TERMIN_ART_FEST:
    "Die Art eines Termins lässt sich nicht ändern. Entferne ihn und lege ihn neu an.",
} as const;

/** Die Checks am Termin, samt Anführungszeichen gesucht (siehe
 *  `TERMIN_CHECKS` in lib/training-bedingungen.ts). */
export const SPIEL_CHECKS: [string, string][] = [
  ['"tt_spiel_bezeichnung"', SPIEL_TEXT.bezeichnungLang],
  ['"tt_richtwert"', SPIEL_TEXT.richtwert],
  ['"tt_spiel_ohne_training"', SPIEL_TEXT.keinTraining],
];

/** Länge wie Postgres `char_length`: in Code Points. */
function laenge(s: string): number {
  return [...s].length;
}

/** Die Bezeichnung eines Spiels (#459 AK 2, 10): Pflicht, 1 bis 120 Zeichen
 *  nach dem Kürzen. Die gespeicherte Form ist die gekürzte. */
export function bezeichnungProblem(b: string | null | undefined): { feld: "bezeichnung"; text: string } | null {
  const t = (b ?? "").trim();
  if (t === "") return { feld: "bezeichnung", text: SPIEL_TEXT.bezeichnung };
  if (laenge(t) > BEZEICHNUNG_MAX) return { feld: "bezeichnung", text: SPIEL_TEXT.bezeichnungLang };
  return null;
}

/** Mindest- und Höchstzahl je für sich (#459 AK 5, 11): `null` heisst nicht
 *  festgelegt, sonst eine ganze Zahl von 1 bis 200; beide gesetzt, darf die
 *  Mindestzahl die Höchstzahl nicht übersteigen. */
export function richtwertProblem(
  min: unknown,
  max: unknown,
): { feld: "mindestzahl" | "hoechstzahl"; text: string } | null {
  const gueltig = (n: unknown) =>
    n === null || (typeof n === "number" && Number.isInteger(n) && n >= RICHTWERT_MIN && n <= RICHTWERT_MAX);
  if (!gueltig(min)) return { feld: "mindestzahl", text: SPIEL_TEXT.richtwert };
  if (!gueltig(max)) return { feld: "hoechstzahl", text: SPIEL_TEXT.richtwert };
  if (typeof min === "number" && typeof max === "number" && min > max)
    return { feld: "mindestzahl", text: SPIEL_TEXT.richtwertReihenfolge };
  return null;
}

/** Der Richtwert zum Anzeigen: «9 bis 12», «mindestens 9», «höchstens 12»;
 *  `null` ohne Richtwert (#459 AK 9). */
export function richtwertText(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min}` : `${min} bis ${max}`;
  if (min !== null) return `mindestens ${min}`;
  if (max !== null) return `höchstens ${max}`;
  return null;
}

/** Wie eine Spielerzahl zum Richtwert steht (#463 AK 7, 28, 29; #487 AK 11):
 *  unter der Mindestzahl, genau die Mindestzahl (nur knapp erreicht — auch
 *  wenn die Höchstzahl gleich gross ist), im Richtwert oder über der
 *  Höchstzahl. Bewertet wird nur gegen festgelegte Grenzen; ohne Richtwert
 *  `null`. Der KI-Assistent bekommt nur die Zahlen, nie diese Bewertung. */
export type RichtwertStufe = "unter" | "knapp" | "im" | "ueber";

export function richtwertStufe(zahl: number, min: number | null, max: number | null): RichtwertStufe | null {
  if (min === null && max === null) return null;
  if (min !== null && zahl < min) return "unter";
  if (min !== null && zahl === min) return "knapp";
  if (max !== null && zahl > max) return "ueber";
  return "im";
}

/** Die Bewertung in Worten, zur Zahl dazu (Farbe trägt sie nie allein). */
export function richtwertStufeText(zahl: number, min: number | null, max: number | null): string | null {
  const stufe = richtwertStufe(zahl, min, max);
  if (stufe === "unter" && min !== null) {
    const fehlen = min - zahl;
    return `noch ${fehlen} bis Mindestzahl ${min}`;
  }
  if (stufe === "knapp") return `Mindestzahl ${min} knapp erreicht`;
  if (stufe === "ueber") return `${zahl - (max ?? 0)} über Höchstzahl ${max}`;
  if (stufe === "im") return "im Richtwert";
  return null;
}
