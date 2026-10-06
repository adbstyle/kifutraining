// Die Regeln eines Termins (Team-Kalender #322, #323; vorher Team-Epic
// Stories 7–9 und #198).
//
// Eine Regelquelle für den Kalender der Oberfläche und die KI-Werkzeuge
// «termin_*» und «training_zuordnen» — der Fachkern (lib/kern/termine.ts)
// ruft sie vor jedem Schreiben auf, und die Datenebene meldet mit denselben
// Markern (TERMIN_MELDUNG), wenn sie trotzdem abweist.
//
// REIN: importiert nur lib/termin-felder.ts (ebenfalls rein) — `check:kern`
// lädt diese Datei mit tsx.
import { gleicheFelder, type Felder } from "@/lib/termin-felder";

/** Die Angaben eines Termins, wie der Dialog sie führt. `felder` sind die
 *  Felder des Platzes (#389, lib/termin-felder.ts) — nicht zu verwechseln mit
 *  den Formularfeldern, nach denen dieser Typ heisst. */
export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
  /** `null`: ohne Felder (Platz unbekannt). */
  felder?: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null`: unbekannt. */
  spielerzahl?: number | null;
};

export type TerminFeld = "datum" | "beginn" | "ende" | "ort" | "bemerkung";
export type TerminProblem = { feld: TerminFeld; text: string };

/** Zwillinge der Checks `tt_ort_laenge` und `tt_bemerkung_laenge`. */
export const ORT_MAX = 100;
export const BEMERKUNG_MAX = 500;

/** Die erwartete Spielerzahl (#390, PO 7): ganze Zahl von 1 bis 200 wie der
 *  Kinder-Filter der Übungssuche. Zwilling des Checks `tt_spielerzahl`. */
export const SPIELERZAHL_MIN = 1;
export const SPIELERZAHL_MAX = 200;

export const TERMIN_TEXT = {
  datum: "Bitte ein Datum angeben.",
  uhrzeit: "Bitte eine gültige Uhrzeit angeben.",
  zeitPflicht: "Bitte Beginn und Ende angeben.",
  endeNachBeginn: "Das Ende muss am selben Tag nach dem Beginn liegen.",
  ortLang: `Der Ort darf höchstens ${ORT_MAX} Zeichen lang sein.`,
  bemerkungLang: `Die Bemerkung darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
  grundLang: `Der Grund darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
  verantwortlicheUngueltig: "Bitte nur Mitglieder des Teams als Verantwortliche wählen.",
  spielerzahl: `Die erwartete Spielerzahl ist eine ganze Zahl von ${SPIELERZAHL_MIN} bis ${SPIELERZAHL_MAX}.`,
  /** Was die Zahl zählt (PO 7) — als Hinweis am Feld und im KI-Werkzeug. */
  spielerzahlZaehlt: "Alle erwarteten Kinder einschliesslich Torhüter:innen, ohne Trainer:innen.",
} as const;

/** Leere Eingaben sind „nicht erfasst", nicht „leerer Text". */
export function leerZuNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Gibt es diesen Kalendertag? `YYYY-MM-DD` allein genügt nicht: «2026-02-30»
 *  passt auf das Muster, die `date`-Spalte weist ihn aber ab — über den
 *  KI-Client jederzeit eingebbar. Das Jahr 0000 kennt Postgres ebenfalls nicht. */
export function istKalendertag(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1 || mo < 1 || mo > 12 || t < 1) return false;
  return t <= new Date(Date.UTC(j, mo, 0)).getUTCDate();
}

/** Eine Uhrzeit `HH:MM` innerhalb eines Tages; «24:00» ist kein Beginn. */
export function istUhrzeit(hhmm: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Beginn und Ende als EINE Angabe (Story 5 PC 2): beide da, beide gültig,
 *  das Ende am selben Tag danach (AK 5). */
export function zeitProblem(
  beginnRoh: string | null | undefined,
  endeRoh: string | null | undefined,
): { feld: "beginn" | "ende"; text: string } | null {
  const beginn = leerZuNull(beginnRoh);
  const ende = leerZuNull(endeRoh);
  if (!beginn) return { feld: "beginn", text: TERMIN_TEXT.zeitPflicht };
  if (!ende) return { feld: "ende", text: TERMIN_TEXT.zeitPflicht };
  if (!istUhrzeit(beginn)) return { feld: "beginn", text: TERMIN_TEXT.uhrzeit };
  if (!istUhrzeit(ende)) return { feld: "ende", text: TERMIN_TEXT.uhrzeit };
  if (ende <= beginn) return { feld: "ende", text: TERMIN_TEXT.endeNachBeginn };
  return null;
}

/** Ort und Bemerkung sind frei, aber begrenzt (AK 6). */
export function textProblem(f: {
  ort?: string | null;
  bemerkung?: string | null;
}): { feld: "ort" | "bemerkung"; text: string } | null {
  if ((leerZuNull(f.ort) ?? "").length > ORT_MAX) return { feld: "ort", text: TERMIN_TEXT.ortLang };
  if ((leerZuNull(f.bemerkung) ?? "").length > BEMERKUNG_MAX)
    return { feld: "bemerkung", text: TERMIN_TEXT.bemerkungLang };
  return null;
}

/** Was an einem Termin nicht stimmt, sonst `null`.
 *
 *  Ohne `bisher` ist der Termin neu: Datum, Beginn und Ende sind Pflicht
 *  (AK 2, PO 9). Mit `bisher` wird geändert: Eine Zeit, die sich ändert, muss
 *  danach vollständig sein (AK 8, 10); eine unveränderte, unvollständige Zeit
 *  eines übernommenen Termins bleibt stehen (AK 9). `bisher` trägt `HH:MM`. */
export function terminProblem(
  f: { datum?: string | null; beginn?: string | null; ende?: string | null; ort?: string | null; bemerkung?: string | null },
  bisher?: { beginn: string | null; ende: string | null },
): TerminProblem | null {
  if (!istKalendertag(f.datum ?? "")) return { feld: "datum", text: TERMIN_TEXT.datum };
  const beginn = leerZuNull(f.beginn);
  const ende = leerZuNull(f.ende);
  const zeitGeaendert = !bisher || beginn !== bisher.beginn || ende !== bisher.ende;
  if (zeitGeaendert) {
    const z = zeitProblem(beginn, ende);
    if (z) return z;
  }
  return textProblem(f);
}

/** Die erwartete Spielerzahl (#390 AK 3): `null` heisst unbekannt, sonst eine
 *  ganze Zahl von 1 bis 200. Zwilling des Checks `tt_spielerzahl`; die
 *  Meldung ist an Oberfläche und KI wortgleich (AK 7). */
export function spielerzahlProblem(n: unknown): { feld: "erwartete_spielerzahl"; text: string } | null {
  if (n === null) return null;
  return typeof n === "number" && Number.isInteger(n) && n >= SPIELERZAHL_MIN && n <= SPIELERZAHL_MAX
    ? null
    : { feld: "erwartete_spielerzahl", text: TERMIN_TEXT.spielerzahl };
}

/** Eine getippte Zahl: leer heisst unbekannt (`null`), sonst die Zahl — auch
 *  eine ungültige, damit `spielerzahlProblem` sie meldet. */
export function zahlOderNull(text: string | null | undefined): number | null {
  const t = (text ?? "").trim();
  return t === "" ? null : Number(t);
}

/** Die erwartete Spielerzahl zum Anzeigen: «12 Spieler:innen», «1 Spieler:in». */
export function spielerzahlText(n: number): string {
  return `${n} ${n === 1 ? "Spieler:in" : "Spieler:innen"}`;
}

/** Der Grund eines Ausfalls folgt den Regeln der Bemerkung (#327 AK 4);
 *  Zwilling des Checks `tt_ausfall_grund`. */
export function ausfallProblem(grund: string | null | undefined): { feld: "grund"; text: string } | null {
  return (leerZuNull(grund) ?? "").length > BEMERKUNG_MAX ? { feld: "grund", text: TERMIN_TEXT.grundLang } : null;
}

/** Was sich gegenüber den Startwerten des Dialogs geändert hat — sonst nichts
 *  (PO 17): Der Dialog sendet nur diese Felder, damit eine gleichzeitige
 *  Änderung eines anderen Feldes durch ein anderes Mitglied nicht still mit
 *  dem alten Stand überschrieben wird. Beginn und Ende gehen als Paar (ändert
 *  sich eines, stehen beide drin); ein leerer Text heisst «leeren».
 *  `null`, wenn sich nichts geändert hat — dann braucht es keinen Aufruf.
 *  Gleich sind zwei Texte, wenn sie nach `leerZuNull` gleich sind, zwei
 *  Angaben zu den Feldern, wenn ihre gespeicherte Form gleich ist
 *  (`gleicheFelder`); geänderte Felder gehen als ganze Liste, `null` heisst
 *  «entfernen» — ebenso bei der erwarteten Spielerzahl. */
export function geaenderteFelder(neu: TerminFelder, start: TerminFelder): Partial<TerminFelder> | null {
  const gleich = (a: string | null | undefined, b: string | null | undefined) => leerZuNull(a) === leerZuNull(b);
  const aenderung: Partial<TerminFelder> = {};
  if (neu.datum !== start.datum) aenderung.datum = neu.datum;
  if (!gleich(neu.beginn, start.beginn) || !gleich(neu.ende, start.ende)) {
    aenderung.beginn = neu.beginn ?? "";
    aenderung.ende = neu.ende ?? "";
  }
  if (!gleich(neu.ort, start.ort)) aenderung.ort = neu.ort ?? "";
  if (!gleich(neu.bemerkung, start.bemerkung)) aenderung.bemerkung = neu.bemerkung ?? "";
  if (!gleicheFelder(neu.felder, start.felder)) aenderung.felder = neu.felder ?? null;
  if ((neu.spielerzahl ?? null) !== (start.spielerzahl ?? null)) aenderung.spielerzahl = neu.spielerzahl ?? null;
  return Object.keys(aenderung).length > 0 ? aenderung : null;
}

/** Die Erfolgsmeldungen nach dem Zuordnen eines Trainings — Kalender und
 *  Team-Bestand sagen dasselbe. */
export const ZUORDNEN_ERFOLG = {
  kopie: "Kopie angelegt und dem Termin zugeordnet.",
  direkt: "Training zugeordnet.",
  /** Ein persönliches Training kommt immer als Kopie ins Team (#328 PC 9). */
  persoenlich: "Kopie im Team angelegt und dem Termin zugeordnet.",
} as const;

/** Was die Oberfläche vor dem Zuordnen eines persönlichen Trainings sagt
 *  (#328 AK 6): dass eine Kopie entsteht, dass das Original nicht mitzieht
 *  und wer sie sieht. Am Termin und vom Training aus derselbe Satz. */
export const PERSOENLICH_KOPIE_HINWEIS =
  "Es entsteht eine Kopie im Team. Spätere Änderungen an deinem Original wirken nicht auf sie, " +
  "und alle Mitglieder des Teams sehen und bearbeiten sie.";

/** Die Zeit eines Termins zum Anzeigen: «18:30–20:00», «ab 18:30» für einen
 *  übernommenen Termin ohne Ende, sonst `null` (AK 14, 15). */
export function zeitText(beginn: string | null, ende: string | null): string | null {
  if (beginn && ende) return `${beginn}–${ende}`;
  if (beginn) return `ab ${beginn}`;
  return null;
}

/** Die Sätze zu den Markern der Datenebene (Migration termine_ohne_training)
 *  — dieselben, die der Fachkern vorab verwendet. */
export const TERMIN_MELDUNG = {
  TERMIN_NICHT_GEFUNDEN: "Termin nicht gefunden.",
  TRAINING_NICHT_GEFUNDEN: "Training nicht gefunden.",
  TERMIN_BELEGUNG_GEAENDERT:
    "Am Termin hat sich inzwischen etwas geändert: Ihm wurde ein anderes Training zugeordnet " +
    "oder sein Training gelöst. Sieh ihn dir noch einmal an.",
  TRAINING_EINPLANUNG_GEAENDERT:
    "Das Training wurde inzwischen einem anderen Termin zugeordnet oder von seinem Termin gelöst. " +
    "Wähle noch einmal.",
  TERMIN_TRAINING_FREMDES_TEAM:
    "Einem Termin lassen sich nur Trainings aus dem Bestand seines Teams oder deine persönlichen Trainings zuordnen.",
  PERSOENLICH_NUR_KOPIE: "Ein persönliches Training lässt sich einem Termin nur als Kopie zuordnen.",
  TRAINING_SCHON_EINGEPLANT:
    "Dieses Training ist bereits für einen anstehenden Termin eingeplant. Wähle, ob du es für " +
    "diesen Termin kopierst oder auf ihn verschiebst.",
  NUR_KOPIE_BEI_VERGANGENEM:
    "Ein Training mit vergangenem Termin lässt sich nur kopieren, nicht verschieben.",
  TERMIN_AUSGEFALLEN:
    "Einem ausgefallenen Termin lässt sich kein Training zuordnen. Nimm den Ausfall zuerst zurück.",
  NICHT_AUSGEFALLEN: "Dieser Termin ist nicht ausgefallen.",
  AUSFALL_GEAENDERT:
    "Der Termin ist inzwischen ausgefallen oder sein Ausfall wurde zurückgenommen. Sieh ihn dir noch einmal an.",
  NICHT_MEHR_MITGLIED:
    "Mindestens eine gewählte Person ist nicht mehr Mitglied des Teams. Sieh dir die Mitglieder noch einmal an.",
} as const;

export type TerminMarker = keyof typeof TERMIN_MELDUNG;

/** Marker, die «seit der Auswahl geändert» heissen (PO 17) — der Fachkern
 *  ordnet sie als `konflikt` ein, nicht als Regel. Die Sätze der Serien-Marker
 *  stehen in `SERIE_MELDUNG` (lib/serie.ts); `istVeraltet` (lib/veraltet.ts)
 *  löst beide Tabellen auf. */
export const KONFLIKT_MARKER: readonly string[] = [
  "TERMIN_BELEGUNG_GEAENDERT",
  "TRAINING_EINPLANUNG_GEAENDERT",
  "AUSFALL_GEAENDERT",
  "SERIE_GEAENDERT",
  "SERIE_BELEGUNG_GEAENDERT",
];

/** Ein Zusatz zu jeder Meldung, deren Kopie nicht aufgeräumt werden konnte
 *  (Story 2 PC 9, Story 7 PC 8) — in der Oberfläche und beim Assistenten. */
export function kopieGebliebenText(name: string): string {
  return `Eine unvollständige Kopie «${name}» ist im Team-Bestand geblieben; du kannst sie dort entfernen.`;
}
