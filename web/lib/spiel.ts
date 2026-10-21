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
  /** Ab- und Anmelden der Trainings an einem Spiel — ein veralteter Weg. */
  istSpiel: "Für ein Spiel gilt diese An- und Abmeldung nicht. Sieh dir das Spiel noch einmal an.",
  meldefrist: "Die Meldefrist liegt vor dem Anpfiff, höchstens ein Jahr davor.",
  meldefristFormat: "Bitte die Meldefrist mit Datum und Uhrzeit angeben.",
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

// ── Meldefrist (#463 AK 8, 9; PC 3) ─────────────────────────────────────────

/** Zwilling des Checks `tt_meldefrist`: vor dem Anpfiff, höchstens ein Jahr. */
export const MELDEFRIST_MAX_MIN = 525_600;

/** Minuten einer Wanduhrzeit `YYYY-MM-DDTHH:MM` — ohne Zeitzone gerechnet,
 *  damit eine Zeitumstellung den Abstand nicht verschiebt (wie `timestamp`
 *  in Postgres). `null`, wenn unlesbar. */
function wanduhrMinuten(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(ms) ? null : ms / 60_000;
}

function wanduhrIso(minuten: number): string {
  return new Date(minuten * 60_000).toISOString().slice(0, 16);
}

/** Der Zeitpunkt der Meldefrist als `YYYY-MM-DDTHH:MM`: so viele Minuten vor
 *  dem Anpfiff. Zwilling der SQL-Funktion `spiel_frist`. */
export function meldefristZeitpunkt(datum: string, beginn: string, vorlaufMin: number): string {
  const anpfiff = wanduhrMinuten(`${datum}T${beginn.slice(0, 5)}`) ?? 0;
  return wanduhrIso(anpfiff - vorlaufMin);
}

/** Wie viele Minuten eine Meldefrist vor dem Anpfiff liegt; `null`, wenn
 *  eines von beiden unlesbar ist. */
export function meldefristVorlauf(datum: string, beginn: string, frist: string): number | null {
  const anpfiff = wanduhrMinuten(`${datum}T${(beginn ?? "").slice(0, 5)}`);
  const f = wanduhrMinuten(frist);
  return anpfiff === null || f === null ? null : anpfiff - f;
}

/** Was an einer Meldefrist nicht stimmt (AK 8), sonst `null`: lesbar, vor
 *  dem Anpfiff, höchstens ein Jahr davor. Eine schon vergangene ist erlaubt. */
export function meldefristProblem(datum: string, beginn: string, frist: string): { feld: "meldefrist"; text: string } | null {
  const v = meldefristVorlauf(datum, beginn, frist);
  if (v === null) return { feld: "meldefrist", text: SPIEL_TEXT.meldefristFormat };
  if (v < 1 || v > MELDEFRIST_MAX_MIN) return { feld: "meldefrist", text: SPIEL_TEXT.meldefrist };
  return null;
}

/** Ist die Frist abgelaufen? `jetzt` als `YYYY-MM-DDTHH:MM` am Trainingsort.
 *  Zwilling der SQL-Funktion `spiel_frist_abgelaufen`. */
export function fristAbgelaufen(frist: string | null, jetzt: string): boolean {
  return frist !== null && frist <= jetzt;
}

/** Rückt eine Verlegung die Frist ins Abgelaufene? (#463 AK 13, 26; PO 6) */
export function fristWirdAbgelaufen(
  vorher: { datum: string; beginn: string },
  nachher: { datum: string; beginn: string },
  vorlaufMin: number | null,
  jetzt: string,
): boolean {
  if (vorlaufMin === null) return false;
  return (
    fristAbgelaufen(meldefristZeitpunkt(nachher.datum, nachher.beginn, vorlaufMin), jetzt) &&
    !fristAbgelaufen(meldefristZeitpunkt(vorher.datum, vorher.beginn, vorlaufMin), jetzt)
  );
}

// ── Meldungen (#463) ────────────────────────────────────────────────────────

/** Die Meldung einer Spieler:in für ein Spiel; `null`: ohne Meldung (AK 1). */
export type Meldung = "angemeldet" | "abgemeldet" | null;

export const MELDUNG_TEXT = {
  ohne: "Ohne Meldung",
  angemeldet: "Angemeldet",
  abgemeldet: "Abgemeldet",
  /** Die Abweisungen — an Oberfläche, Link und KI wortgleich (AK 17, 24). */
  begonnen: "Das Spiel hat begonnen. Gemeldet wird nur bis zum Anpfiff.",
  ausgefallen: "Das Spiel fällt aus. Für es lässt sich niemand an- oder abmelden.",
  giltNicht: "Dieses Spiel gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.",
  fristAbgelaufen: "Die Meldefrist ist abgelaufen. Für eine Änderung wende dich an das Team.",
  nichtGefunden: "Dieses Spiel oder diese Spieler:in gibt es nicht mehr. Sieh dir den Trainingsplan noch einmal an.",
} as const;

/** Die Meldung als kurzer Text. */
export function meldungText(m: Meldung): string {
  return m === null ? MELDUNG_TEXT.ohne : MELDUNG_TEXT[m];
}

/** Ein Wanduhr-Zeitpunkt `YYYY-MM-DDTHH:MM` als «Do., 29.10., 20:00». */
export function zeitpunktKurz(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const tag = Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `${tag}, ${iso.slice(11, 16)}`;
}

/** Warum eine Meldung abgewiesen wurde, mit dem aktuellen Stand (AK 17). */
export type MeldeGrund = "nicht_gefunden" | "verlegt" | "ausgefallen" | "begonnen" | "gilt_nicht" | "frist_abgelaufen";
export type MeldeStand = { datum: string; beginn: string; ende: string; ausgefallen: boolean; frist?: string | null };

export function meldungAbweisungText(grund: MeldeGrund, stand?: MeldeStand): string {
  if (grund === "verlegt" && stand)
    return `Das Spiel wurde inzwischen verlegt, neu auf ${zeitpunktKurz(`${stand.datum}T${stand.beginn}`)}. Sieh es dir noch einmal an.`;
  if (grund === "ausgefallen") return MELDUNG_TEXT.ausgefallen;
  if (grund === "begonnen") return MELDUNG_TEXT.begonnen;
  if (grund === "gilt_nicht") return MELDUNG_TEXT.giltNicht;
  if (grund === "frist_abgelaufen") return MELDUNG_TEXT.fristAbgelaufen;
  return MELDUNG_TEXT.nichtGefunden;
}

// ── Verlegen und Entfernen (#463 AK 13, 23, 26, 27) ─────────────────────────

/** Was eine Verlegung eines Spiels mit seinen Meldungen und seiner Frist tut. */
export function spielVerfallText(meldungen: number, fristAbgelaufen: boolean): string {
  const teile: string[] = [];
  if (meldungen === 1) teile.push("Damit verfällt 1 Meldung: Die Spieler:in ist wieder ohne Meldung.");
  else if (meldungen > 1) teile.push(`Damit verfallen ${meldungen} Meldungen: Diese Spieler:innen sind wieder ohne Meldung.`);
  if (fristAbgelaufen) teile.push("Die Meldefrist ist danach schon abgelaufen; Eltern können nicht mehr melden.");
  return teile.join(" ");
}

/** Was beim Entfernen eines Spiels verschwindet (AK 27). */
export function spielEntfernenText(meldungen: number): string {
  if (meldungen === 0) return "";
  return meldungen === 1 ? "Damit verschwindet 1 Meldung." : `Damit verschwinden ${meldungen} Meldungen.`;
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung. */
export function spielBestaetigen(text: string): string {
  return `${text} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}
