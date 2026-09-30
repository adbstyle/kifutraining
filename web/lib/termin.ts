// Die Regeln eines Termins (Team-Kalender #322, #323; vorher Team-Epic
// Stories 7–9 und #198).
//
// Eine Regelquelle für den Kalender der Oberfläche und die KI-Werkzeuge
// «termin_*» und «training_zuordnen» — der Fachkern (lib/kern/termine.ts)
// ruft sie vor jedem Schreiben auf, und die Datenebene meldet mit denselben
// Markern (TERMIN_MELDUNG), wenn sie trotzdem abweist.
//
// REIN: keine Importe — `check:kern` lädt diese Datei mit tsx.

export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

export type TerminFeld = "datum" | "beginn" | "ende" | "ort" | "bemerkung";
export type TerminProblem = { feld: TerminFeld; text: string };

/** Zwillinge der Checks `tt_ort_laenge` und `tt_bemerkung_laenge`. */
export const ORT_MAX = 100;
export const BEMERKUNG_MAX = 500;

export const TERMIN_TEXT = {
  datum: "Bitte ein Datum angeben.",
  uhrzeit: "Bitte eine gültige Uhrzeit angeben.",
  zeitPflicht: "Bitte Beginn und Ende angeben.",
  endeNachBeginn: "Das Ende muss am selben Tag nach dem Beginn liegen.",
  ortLang: `Der Ort darf höchstens ${ORT_MAX} Zeichen lang sein.`,
  bemerkungLang: `Die Bemerkung darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
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
): TerminProblem | null {
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
}): TerminProblem | null {
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
    "Einem Termin lassen sich nur Trainings aus dem Bestand seines Teams zuordnen.",
  TRAINING_SCHON_EINGEPLANT:
    "Dieses Training ist bereits für einen anstehenden Termin eingeplant. Wähle, ob du es für " +
    "diesen Termin kopierst oder auf ihn verschiebst.",
  NUR_KOPIE_BEI_VERGANGENEM:
    "Ein Training mit vergangenem Termin lässt sich nur kopieren, nicht verschieben.",
} as const;

export type TerminMarker = keyof typeof TERMIN_MELDUNG;

/** Marker, die «seit der Auswahl geändert» heissen (PO 17) — der Fachkern
 *  ordnet sie als `konflikt` ein, nicht als Regel. Teil B ergänzt die der
 *  Serien. */
export const KONFLIKT_MARKER: readonly string[] = [
  "TERMIN_BELEGUNG_GEAENDERT",
  "TRAINING_EINPLANUNG_GEAENDERT",
];

/** Sagt die Meldung «seit deiner Auswahl hat sich etwas geändert» (PO 17) oder
 *  «gibt es nicht mehr»? Dann trägt die Auswahl veraltete Angaben, und ein
 *  erneuter Versuch scheiterte immer wieder — die Oberfläche schliesst den
 *  Dialog und meldet per Snackbar. Gebaut aus `KONFLIKT_MARKER` (spätere
 *  Serien-Marker kommen automatisch dazu) und den beiden «nicht gefunden»-
 *  Sätzen. Eine Meldung kann einen Zusatz tragen (Kopie geblieben), darum
 *  Präfix-Vergleich. */
export function istVeraltet(meldung: string | undefined): boolean {
  if (!meldung) return false;
  const saetze: Record<string, string> = TERMIN_MELDUNG;
  return [...KONFLIKT_MARKER, "TERMIN_NICHT_GEFUNDEN", "TRAINING_NICHT_GEFUNDEN"].some((m) => {
    const satz = saetze[m];
    return !!satz && meldung.startsWith(satz);
  });
}

/** Ein Zusatz zu jeder Meldung, deren Kopie nicht aufgeräumt werden konnte
 *  (Story 2 PC 9, Story 7 PC 8) — in der Oberfläche und beim Assistenten. */
export function kopieGebliebenText(name: string): string {
  return `Eine unvollständige Kopie «${name}» ist im Team-Bestand geblieben; du kannst sie dort entfernen.`;
}
