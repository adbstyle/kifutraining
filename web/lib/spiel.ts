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
  nurSpiel: "Bezeichnung, Mindest- und Höchstzahl, Meldefrist und Treffpunkte gibt es nur bei Spielen.",
  /** Ein Spiel trägt nie ein Training (#459 AK 14). */
  keinTraining: "Einem Spiel lässt sich kein Training zuordnen.",
  /** Ab- und Anmelden der Trainings an einem Spiel — ein veralteter Weg. */
  istSpiel: "Für ein Spiel gilt diese An- und Abmeldung nicht. Sieh dir das Spiel noch einmal an.",
  meldefrist: "Die Meldefrist liegt vor dem Anpfiff, höchstens ein Jahr davor.",
  meldefristFormat: "Bitte die Meldefrist mit Datum und Uhrzeit angeben.",
} as const;

// Treffpunkte (#465): Auswahl, Grenzen und Sätze — vor den Markern, die
// sie nennen. Die Regeln dazu stehen unten.

/** Die feste Auswahl der Anreisearten (AK 3). Zwilling des Checks
 *  `stp_anreise`; die Reihenfolge ist die der Auswahl. */
export type Anreise = "vor_ort" | "oev" | "auto" | "velo" | "car";
export const ANREISEARTEN: readonly Anreise[] = ["vor_ort", "oev", "auto", "velo", "car"];
export const ANREISE_TEXT: Record<Anreise, string> = {
  vor_ort: "vor Ort",
  oev: "öV",
  auto: "Auto",
  velo: "Velo",
  car: "Car oder Vereinsbus",
};

export function istAnreise(x: unknown): x is Anreise {
  return typeof x === "string" && (ANREISEARTEN as readonly string[]).includes(x);
}

/** Je Anreiseart einer, also höchstens fünf (AK 6); Ort höchstens 100
 *  Zeichen (AK 7). Zwillinge der Checks `stp_*`. */
export const TREFFPUNKTE_MAX = 5;
export const TREFFPUNKT_ORT_MAX = 100;
/** Höchstens ein Jahr vor oder nach dem Anpfiff (Check `stp_vorlauf`). */
export const TREFFPUNKT_ABSTAND_MAX_MIN = 525_600;

export const TREFFPUNKT_TEXT = {
  anreise: "Bitte für jeden Treffpunkt eine Anreiseart wählen: vor Ort, öV, Auto, Velo oder Car oder Vereinsbus.",
  zeitpunkt: "Bitte für jeden Treffpunkt Datum und Uhrzeit angeben.",
  zeitpunktWeit: "Ein Treffpunkt liegt höchstens ein Jahr vor oder nach dem Anpfiff.",
  ort: "Bitte für jeden Treffpunkt ausser vor Ort einen Ort angeben.",
  ortLang: `Der Ort eines Treffpunkts darf höchstens ${TREFFPUNKT_ORT_MAX} Zeichen lang sein.`,
  ortVorOrt: "Der Treffpunkt vor Ort hat keinen eigenen Ort: Es gilt der Ort des Spiels.",
  doppelt: "Je Anreiseart gibt es höchstens einen Treffpunkt.",
  zuViele: `Ein Spiel hat höchstens ${TREFFPUNKTE_MAX} Treffpunkte.`,
} as const;

/** Die Sätze zu den Markern der Datenebene — dieselben, die der Fachkern
 *  vorab verwendet. Kein Marker steckt in einem anderen (`check:kern`). */
export const SPIEL_MELDUNG = {
  SPIEL_ANPFIFF_VERGANGEN:
    "Ein Spiel lässt sich nur mit einem Anpfiff erfassen oder verlegen, der noch bevorsteht.",
  TERMIN_ART_FEST:
    "Die Art eines Termins lässt sich nicht ändern. Entferne ihn und lege ihn neu an.",
  TREFFPUNKTE_NUR_SPIEL: SPIEL_TEXT.nurSpiel,
} as const;

/** Die Checks am Termin, samt Anführungszeichen gesucht (siehe
 *  `TERMIN_CHECKS` in lib/training-bedingungen.ts). */
export const SPIEL_CHECKS: [string, string][] = [
  ['"tt_spiel_bezeichnung"', SPIEL_TEXT.bezeichnungLang],
  ['"tt_richtwert"', SPIEL_TEXT.richtwert],
  ['"tt_spiel_ohne_training"', SPIEL_TEXT.keinTraining],
  ['"tt_meldefrist"', SPIEL_TEXT.meldefrist],
  // Treffpunkte (#465).
  ['"stp_anreise"', TREFFPUNKT_TEXT.anreise],
  ['"stp_ort"', TREFFPUNKT_TEXT.ort],
  ['"stp_vorlauf"', TREFFPUNKT_TEXT.zeitpunktWeit],
  ['"spiel_treffpunkte_pkey"', TREFFPUNKT_TEXT.doppelt],
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
  if (stufe === "knapp") return `Mindestzahl ${min} genau erreicht`;
  if (stufe === "ueber") return `${zahl - (max ?? 0)} über Höchstzahl ${max}`;
  if (stufe === "im") return `Richtwert ${richtwertText(min, max)}`;
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
  /** Nach der Meldefrist ohne Meldung (#496): kein Speicherwert, der Name. */
  verpasst: "Meldefrist verpasst",
  /** Die Abweisungen — an Oberfläche, Link und KI wortgleich (AK 17, 24). */
  begonnen: "Das Spiel hat begonnen. Gemeldet wird nur bis zum Anpfiff.",
  ausgefallen: "Das Spiel fällt aus. Für es lässt sich niemand an- oder abmelden.",
  giltNicht: "Dieses Spiel gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.",
  fristAbgelaufen: "Die Meldefrist ist abgelaufen. Für eine Änderung wende dich an das Team.",
  nichtGefunden: "Dieses Spiel oder diese Spieler:in gibt es nicht mehr. Sieh dir den Trainingsplan noch einmal an.",
  /** #464 AK 4: an Oberfläche, Link und KI wortgleich. */
  nichtAufgeboten:
    "Die Spieler:in ist für dieses Spiel nicht aufgeboten. Melden lässt sie sich erst wieder, wenn das Team das aufhebt.",
} as const;

// ── Nicht aufbieten (#464) ──────────────────────────────────────────────────

export const AUFGEBOT_TEXT = {
  nichtAufgeboten: "Nicht aufgeboten",
  nichtAufbieten: "Nicht aufbieten",
  aufbieten: "Aufbieten",
  /** Am privaten Link (AK 9). */
  eltern: (name: string) => `${name} ist für dieses Spiel nicht aufgeboten. Fragen dazu ans Team.`,
  /** Mit einer Verlegung verfallen (PC 3). */
  verfallen: "Die Kennzeichnung als nicht aufgeboten gilt nicht mehr.",
} as const;

// ── Nachtrag (#487) ─────────────────────────────────────────────────────────

/** Zählte die Spieler:in beim Anpfiff? Angemeldet und nicht als nicht
 *  aufgeboten gekennzeichnet (#464 AK 7). Zwilling der SQL-Funktion
 *  `spiel_zaehlt`. Anwesend ist, wer zählte und nicht nachgetragen ist, oder
 *  wer nicht zählte und nachgetragen ist (#487 AK 9). */
export function zaehlteBeimAnpfiff(meldung: Meldung, nichtAufgeboten: boolean): boolean {
  return meldung === "angemeldet" && !nichtAufgeboten;
}

export const NACHTRAG_TEXT = {
  nichtErschienen: "Nicht erschienen",
  dochErschienen: "Doch erschienen",
  /** Über der Liste eines begonnenen Spiels (Design PO 2026-10-21). */
  kopf: "Stand beim Anpfiff · nachtragen, wer da war",
  /** Der Menüeintrag, der einen Nachtrag zurücknimmt (AK 3; Epic #490: das
   *  Ziel steht als Lozenge daneben, der Hinweis darunter). */
  zurueck: "Nachtrag zurücknehmen",
  zurueckHinweis: "Zurück zum Stand beim Anpfiff",
} as const;

/** «1 Kennzeichnung als nicht aufgeboten», «2 Kennzeichnungen …». */
function kennzeichnungenText(k: number): string {
  return k === 1 ? "1 Kennzeichnung als nicht aufgeboten" : `${k} Kennzeichnungen als nicht aufgeboten`;
}

/** Die Meldung als kurzer Text. */
export function meldungText(m: Meldung): string {
  return m === null ? MELDUNG_TEXT.ohne : MELDUNG_TEXT[m];
}

/** Hat die Spieler:in die Meldefrist verpasst (#496)? Ohne Meldung, nicht
 *  als nicht aufgeboten gekennzeichnet, und die Meldefrist ist abgelaufen —
 *  auch wer erst danach zum Spiel kam. Ohne Meldefrist nie. Kein eigener
 *  Speicherwert: Sie zählt wie jede ohne Meldung nicht als angemeldet. */
export function meldefristVerpasst(m: Meldung, nichtAufgeboten: boolean, fristAbgelaufen: boolean): boolean {
  return fristAbgelaufen && m === null && !nichtAufgeboten;
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
export type MeldeGrund =
  | "nicht_gefunden"
  | "verlegt"
  | "ausgefallen"
  | "begonnen"
  | "gilt_nicht"
  | "frist_abgelaufen"
  | "nicht_aufgeboten";
export type MeldeStand = { datum: string; beginn: string; ende: string; ausgefallen: boolean; frist?: string | null };

export function meldungAbweisungText(grund: MeldeGrund, stand?: MeldeStand): string {
  if (grund === "verlegt" && stand)
    return `Das Spiel wurde inzwischen verlegt, neu auf ${zeitpunktKurz(`${stand.datum}T${stand.beginn}`)}. Sieh es dir noch einmal an.`;
  if (grund === "ausgefallen") return MELDUNG_TEXT.ausgefallen;
  if (grund === "begonnen") return MELDUNG_TEXT.begonnen;
  if (grund === "gilt_nicht") return MELDUNG_TEXT.giltNicht;
  if (grund === "frist_abgelaufen") return MELDUNG_TEXT.fristAbgelaufen;
  if (grund === "nicht_aufgeboten") return MELDUNG_TEXT.nichtAufgeboten;
  return MELDUNG_TEXT.nichtGefunden;
}

// ── Verlegen und Entfernen (#463 AK 13, 23, 26, 27) ─────────────────────────

/** Was eine Verlegung eines Spiels mit seinen Meldungen, Kennzeichnungen
 *  als nicht aufgeboten (#464 AK 10), Nachträgen (#487 AK 13) und seiner
 *  Frist tut. */
export function spielVerfallText(meldungen: number, fristAbgelaufen: boolean, kennzeichnungen = 0, nachtraege = 0): string {
  const teile: string[] = [];
  if (meldungen === 1) teile.push("Damit verfällt 1 Meldung: Die Spieler:in ist wieder ohne Meldung.");
  else if (meldungen > 1) teile.push(`Damit verfallen ${meldungen} Meldungen: Diese Spieler:innen sind wieder ohne Meldung.`);
  const weitere = [
    ...(kennzeichnungen > 0 ? [kennzeichnungenText(kennzeichnungen)] : []),
    ...(nachtraege > 0 ? [nachtraege === 1 ? "1 Nachtrag zur Anwesenheit" : `${nachtraege} Nachträge zur Anwesenheit`] : []),
  ];
  if (weitere.length > 0)
    teile.push(
      `${meldungen > 0 ? "Ausserdem" : "Damit"} ${kennzeichnungen + nachtraege === 1 ? "verfällt" : "verfallen"} ${weitere.join(" und ")}.`,
    );
  if (fristAbgelaufen) teile.push("Die Meldefrist ist danach schon abgelaufen; Eltern können nicht mehr melden.");
  return teile.join(" ");
}

/** Was beim Entfernen eines Spiels verschwindet (#463 AK 27, #464 AK 10). */
export function spielEntfernenText(meldungen: number, kennzeichnungen = 0): string {
  const teile = [
    ...(meldungen > 0 ? [meldungen === 1 ? "1 Meldung" : `${meldungen} Meldungen`] : []),
    ...(kennzeichnungen > 0 ? [kennzeichnungenText(kennzeichnungen)] : []),
  ];
  if (teile.length === 0) return "";
  return `Damit ${meldungen + kennzeichnungen === 1 ? "verschwindet" : "verschwinden"} ${teile.join(" und ")}.`;
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung. */
export function spielBestaetigen(text: string): string {
  return `${text} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}

// ── Treffpunkte (#465) ──────────────────────────────────────────────────────

/** Ein Treffpunkt, wie man ihn erfasst und sieht: `zeitpunkt` als
 *  Wanduhrzeit `YYYY-MM-DDTHH:MM`, `ort` nur ausser vor Ort. */
export type Treffpunkt = { anreise: Anreise; zeitpunkt: string; ort: string | null };
/** Wie ihn die Datenebene führt: als Abstand zum Anpfiff (PC 2). */
export type TreffpunktZeile = { anreise: Anreise; vorlauf_min: number; ort: string | null };

export type TreffpunktProblem = { feld: "treffpunkte"; index: number | null; text: string };

/** Prüft eine ganze Liste von Treffpunkten zu einem Anpfiff und gibt sie
 *  in der Form der Datenebene zurück — oder das erste Problem (AK 2–7). Der
 *  Ort wird gekürzt gespeichert. Der Zeitpunkt darf nach dem Anpfiff und an
 *  einem anderen Tag liegen (AK 5). */
export function treffpunkteNormal(
  liste: readonly { anreise: unknown; zeitpunkt: unknown; ort?: unknown }[],
  datum: string,
  beginn: string,
): { ok: true; zeilen: TreffpunktZeile[] } | { ok: false; problem: TreffpunktProblem } {
  const p = (index: number | null, text: string) => ({ ok: false as const, problem: { feld: "treffpunkte" as const, index, text } });
  if (liste.length > TREFFPUNKTE_MAX) return p(null, TREFFPUNKT_TEXT.zuViele);
  const anpfiff = wanduhrMinuten(`${datum}T${(beginn ?? "").slice(0, 5)}`);
  const zeilen: TreffpunktZeile[] = [];
  for (const [i, t] of liste.entries()) {
    if (!istAnreise(t.anreise)) return p(i, TREFFPUNKT_TEXT.anreise);
    if (zeilen.some((z) => z.anreise === t.anreise)) return p(i, TREFFPUNKT_TEXT.doppelt);
    const zeit = typeof t.zeitpunkt === "string" ? wanduhrMinuten(t.zeitpunkt) : null;
    if (zeit === null || anpfiff === null) return p(i, TREFFPUNKT_TEXT.zeitpunkt);
    const vorlauf = anpfiff - zeit;
    if (Math.abs(vorlauf) > TREFFPUNKT_ABSTAND_MAX_MIN) return p(i, TREFFPUNKT_TEXT.zeitpunktWeit);
    const ort = typeof t.ort === "string" && t.ort.trim() !== "" ? t.ort.trim() : null;
    if (t.anreise === "vor_ort") {
      if (ort !== null) return p(i, TREFFPUNKT_TEXT.ortVorOrt);
    } else {
      if (ort === null) return p(i, TREFFPUNKT_TEXT.ort);
      if (laenge(ort) > TREFFPUNKT_ORT_MAX) return p(i, TREFFPUNKT_TEXT.ortLang);
    }
    zeilen.push({ anreise: t.anreise, vorlauf_min: vorlauf, ort });
  }
  return { ok: true, zeilen };
}

/** Die Treffpunkte eines Spiels zu seinem aktuellen Anpfiff, frühester
 *  zuerst (PC 2). */
export function treffpunkteZu(zeilen: readonly TreffpunktZeile[], datum: string, beginn: string): Treffpunkt[] {
  return [...zeilen]
    .sort((a, b) => b.vorlauf_min - a.vorlauf_min)
    .map((z) => ({ anreise: z.anreise, zeitpunkt: meldefristZeitpunkt(datum, beginn, z.vorlauf_min), ort: z.ort }));
}

/** Wie ein Treffpunkt angezeigt wird (AK 8; PC 1): Uhrzeit, das Datum nur
 *  ausserhalb des Spieltags; vor Ort mit dem aktuellen Ort des Spiels oder,
 *  solange es keinen hat, nur mit der Zeit. */
export function treffpunktAnzeige(
  t: Treffpunkt,
  spieltag: string,
  spielOrt: string | null,
): { anreise: string; zeit: string; ort: string | null } {
  const tag = t.zeitpunkt.slice(0, 10);
  const zeit = tag === spieltag ? t.zeitpunkt.slice(11, 16) : zeitpunktKurz(t.zeitpunkt);
  return { anreise: ANREISE_TEXT[t.anreise], zeit, ort: t.anreise === "vor_ort" ? spielOrt : t.ort };
}
