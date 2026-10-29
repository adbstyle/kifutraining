// Probetraining (Epic #554, Story #555): Regeln und Texte des Probe-Modus für
// Oberfläche, privaten Link und KI-Werkzeuge — eine Quelle, wortgleich.
//
// Eine Spieler:in im Probe-Modus ist an Trainings zuerst nicht angemeldet und
// meldet sich an; über den Link nur, solange besuchte und künftig angemeldete
// Probetrainings samt dieser Anmeldung die Anzahl des Teams nicht übersteigen.
// Spiele gelten für sie nicht. Die Regeln selbst stehen in der Datenebene
// (20261029110000_probetraining.sql); hier stehen ihre Zwillinge und Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

/** Zwilling des Checks `team_probetraining_anzahl`. */
export const PROBE_ANZAHL_MIN = 1;
export const PROBE_ANZAHL_MAX = 20;
/** Zwilling des Checks `team_probetraining_info` (#556 AK 2). */
export const PROBE_INFO_MAX = 2000;

/** Der Stand einer Probe-Spieler:in (`probe_stand`). `anzahl` ist leer, solange
 *  das Team keine festgelegt hat; `moeglich` wird nie kleiner als null. */
export type ProbeStand = {
  anzahl: number | null;
  besucht: number;
  angemeldet: number;
  moeglich: number;
};

/** Die Probetraining-Einstellung des Teams; `anzahl` leer = nicht konfiguriert,
 *  `info` leer = kein Info-Schreiben (#556). */
export type Probetraining = { anzahl: number | null; info: string | null };

export const PROBE_TEXT = {
  titel: "Probetraining",
  karte:
    "Probe-Spieler:innen melden sich über ihren Link selbst für Trainings an, höchstens für so viele, wie das Team festlegt. Spiele sehen sie nicht.",
  leerTitel: "Noch kein Probetraining",
  leer: "Lege fest, wie viele Trainings eine Probe-Spieler:in besuchen darf. Danach kannst du den Probe-Modus bei Spieler:innen einschalten.",
  konfigurieren: "Probetraining konfigurieren",
  bearbeiten: "Probetraining bearbeiten",
  dialog: "Gilt für alle Probe-Spieler:innen des Teams.",
  anzahl: "Anzahl Probetrainings",
  anzahlHinweis: `${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX} · zählt besuchte und angemeldete Trainings`,
  anzahlProblem: `Gib eine ganze Zahl von ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX} ein.`,
  imProbeModus: "Im Probe-Modus",
  niemand: "Noch niemand. Den Probe-Modus schaltest du bei einer Spieler:in im Dialog «Spieler:in ändern» ein.",
  festgelegt: "Probetraining gespeichert.",
  /** Die Checkbox im Dialog «Spieler:in ändern». */
  checkbox: "Im Probetraining",
  /** Ohne festgelegte Anzahl lässt sich nichts einschalten (AK 4, 18). */
  anzahlFehlt: "Lege zuerst in der Karte «Probetraining» fest, wie viele Trainings eine Probe-Spieler:in besuchen darf.",
  einschalten: "Probetraining einschalten",
  /** Am privaten Link: nach Ablauf der Anzahl (AK 12). */
  vergeben: "Probetrainings vergeben",
  /** Die Abweisung am Link, wenn die Anzahl erreicht ist (AK 12). */
  voll: "Alle Probetrainings sind vergeben. Meldest du von einem anderen Training ab, wird ein Platz frei. Für weitere Trainings wende dich an das Team.",
  imProbeModusZahl: (n: number) => `${n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`} im Probe-Modus`,
  nichtAngemeldet: "Nicht angemeldet",
  // ── Info-Schreiben (#556) ──
  info: "Info-Schreiben",
  infoFeld: "Info-Schreiben (optional)",
  /** AK 3: wer es sieht — fest hinter dem ⓘ. */
  infoWer: "Das sehen die Eltern aller Probe-Spieler:innen oben in ihrem Link.",
  infoUnter: "Nur Text. Webadressen werden im Link anklickbar.",
  infoZuLang: `Das Info-Schreiben darf höchstens ${PROBE_INFO_MAX} Zeichen lang sein.`,
  infoKeines: "Keines",
  /** Am privaten Link (AK 4). */
  linkInfoTitel: "Infos zum Probetraining",
  /** Unter der Spielerliste, sobald jemand im Probe-Modus ist. */
  listeHinweis:
    "«Probe 1/4»: 1 von 4 Probetrainings besucht. Für welche Trainings jemand angemeldet ist, steht am jeweiligen Training. Probe-Spieler:innen zählen bei den Angemeldeten eines Trainings nur, wenn sie angemeldet sind.",
} as const;

/** Was an einer Anzahl nicht stimmt, sonst `null` (AK 2). */
export function probeAnzahlProblem(n: number | null | undefined): string | null {
  return typeof n === "number" && Number.isInteger(n) && n >= PROBE_ANZAHL_MIN && n <= PROBE_ANZAHL_MAX
    ? null
    : PROBE_TEXT.anzahlProblem;
}

/** Was der Probe-Modus für die Spieler:in bedeutet, vor dem Einschalten (AK 16). */
export function probeEinschaltenText(vorname: string, anzahl: number | null): string {
  const hoechstens = anzahl === null ? "" : `, höchstens für ${anzahl}`;
  return `${vorname} meldet sich selbst für Trainings an${hoechstens}. Spiele sieht ${vorname} nicht.`;
}

/** Was das Ausschalten bewirkt, vorher (AK 19). */
export function probeAusschaltenText(vorname: string): string {
  return `${vorname} ist danach an allen kommenden Trainings angemeldet und sieht Spiele wie alle. Schaltest du das Probetraining später wieder ein, zählt es wieder ab null.`;
}

/** Was das Einschalten verfallen lässt (AK 5): Abmeldungen von Trainings,
 *  Meldungen zu Spielen, Kennzeichnungen als nicht aufgeboten. */
export type ProbeFolgen = { abmeldungen: number; meldungen: number; kennzeichnungen: number };

export function probeFolgenSumme(f: ProbeFolgen): number {
  return f.abmeldungen + f.meldungen + f.kennzeichnungen;
}

function aufzaehlung(teile: string[]): string {
  return teile.length > 1 ? `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}` : (teile[0] ?? "");
}

/** Die Überschrift der Warnung: «Damit verfallen 2 Abmeldungen und 1 Meldung zu einem Spiel». */
export function probeVerfallTitel(f: ProbeFolgen): string {
  const teile = [
    ...(f.abmeldungen > 0 ? [f.abmeldungen === 1 ? "1 Abmeldung von einem Training" : `${f.abmeldungen} Abmeldungen von Trainings`] : []),
    ...(f.meldungen > 0 ? [f.meldungen === 1 ? "1 Meldung zu einem Spiel" : `${f.meldungen} Meldungen zu Spielen`] : []),
    ...(f.kennzeichnungen > 0
      ? [f.kennzeichnungen === 1 ? "1 Kennzeichnung als nicht aufgeboten" : `${f.kennzeichnungen} Kennzeichnungen als nicht aufgeboten`]
      : []),
  ];
  return `Damit ${probeFolgenSumme(f) === 1 ? "verfällt" : "verfallen"} ${aufzaehlung(teile)}`;
}

/** Was danach gilt — in der Warnung unter der Überschrift. */
export function probeVerfallFolge(vorname: string): string {
  return `${vorname} ist danach an allen kommenden Trainings nicht angemeldet.`;
}

/** Der ganze Satz, für die KI und eine Rückfrage. */
export function probeVerfallText(vorname: string, f: ProbeFolgen): string {
  return `${probeVerfallTitel(f)}. ${probeVerfallFolge(vorname)}`;
}

/** Für den KI-Weg, mit dem Weg zur Bestätigung. */
export function probeVerfallBestaetigen(vorname: string, f: ProbeFolgen): string {
  return `${probeVerfallText(vorname, f)} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}

/** Der Marker der Datenebene, dahinter Summe, Abmeldungen, Meldungen,
 *  Kennzeichnungen (`spieler_probe_setzen`). */
export const PROBE_VERFALL_MARKER = "PROBE_VERFALLEN";

export function probeFolgenAusFehler(message: string): ProbeFolgen | null {
  const m = message.match(new RegExp(`${PROBE_VERFALL_MARKER} \\d+ (\\d+) (\\d+) (\\d+)`));
  return m ? { abmeldungen: Number(m[1]), meldungen: Number(m[2]), kennzeichnungen: Number(m[3]) } : null;
}

/** Die Sätze zu den übrigen Markern der Datenebene. */
export const PROBE_MELDUNG = {
  PROBE_ANZAHL_FEHLT: PROBE_TEXT.anzahlFehlt,
  PROBE_ANZAHL_UNGUELTIG: PROBE_TEXT.anzahlProblem,
  PROBE_INFO_ZU_LANG: PROBE_TEXT.infoZuLang,
} as const;

/** Die CHECKs, samt Anführungszeichen gesucht (wie `SPIELER_CHECKS`). */
export const PROBE_CHECKS: [string, string][] = [
  ['"team_probetraining_anzahl"', PROBE_TEXT.anzahlProblem],
  ['"team_probetraining_info"', PROBE_TEXT.infoZuLang],
];

/** Das Info-Schreiben, wie die Datenebene es speichert: Zeilenenden als \n,
 *  Leerraum am Anfang und Ende weg, leer = keines (Zwilling von
 *  `team_probetraining_festlegen`). */
export function probeInfoBereinigt(text: string | null | undefined): string | null {
  const t = (text ?? "").replace(/\r\n/g, "\n").replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "");
  return t === "" ? null : t;
}

/** Zeichen wie `char_length`: Codepunkte, nicht UTF-16-Einheiten. */
export function probeInfoLaenge(text: string | null | undefined): number {
  return [...(probeInfoBereinigt(text) ?? "")].length;
}

/** Was am Info-Schreiben nicht stimmt, sonst `null` (AK 2). */
export function probeInfoProblem(text: string | null | undefined): string | null {
  return probeInfoLaenge(text) > PROBE_INFO_MAX ? PROBE_TEXT.infoZuLang : null;
}

/** Die Plakette in der Spielerliste: «Probe 1/4» — besuchte von der Anzahl
 *  (PO 2026-10-29); ohne Anzahl nur «Probe». */
export function probeKurz(s: ProbeStand | null): string {
  return s?.anzahl ? `Probe ${s.besucht}/${s.anzahl}` : "Probe";
}

/** Dasselbe ausgeschrieben, für die Vorlesehilfe. */
export function probeLang(s: ProbeStand | null): string {
  return s?.anzahl ? `Probe: ${s.besucht} von ${s.anzahl} Probetrainings besucht` : "Im Probe-Modus";
}

/** Eine Anmeldung durch ein Mitglied oder die KI über der Anzahl (Zusatzentscheid
 *  PO 2026-10-29): ein kurzer Hinweis, an Oberfläche und KI wortgleich. */
export function ueberAnzahl(s: ProbeStand | null | undefined): boolean {
  return !!s && s.anzahl !== null && s.besucht + s.angemeldet > s.anzahl;
}

export function ueberAnzahlText(name: string, s: ProbeStand): string {
  return `${name} ist damit über der Anzahl Probetrainings: ${s.besucht} besucht und ${s.angemeldet} angemeldet, vorgesehen sind ${s.anzahl}.`;
}

// ── Am privaten Link (AK 9, 11, 12) ─────────────────────────────────────────

export function linkProbeKopf(vorname: string): string {
  return `${vorname} ist im Probetraining. Melde ${vorname} für die Trainings an, an denen ${vorname} teilnimmt, und bis zum Beginn wieder ab.`;
}

/** «1 Probetraining», «4 Probetrainings». */
function probetrainings(n: number): string {
  return n === 1 ? "1 Probetraining" : `${n} Probetrainings`;
}

/** Was vergeben ist: «Das Probetraining», «Alle 4 Probetrainings» (ohne «Alle 1»). */
function alleVergeben(n: number | null): string {
  return n === 1 ? "Das Probetraining ist vergeben" : `Alle ${n} Probetrainings sind vergeben`;
}

export function linkProbeZaehler(s: ProbeStand): string {
  if (s.anzahl === null) return `${s.besucht} besucht · ${s.angemeldet} angemeldet`;
  return s.moeglich > 0
    ? `Noch ${s.moeglich} von ${probetrainings(s.anzahl)} möglich`
    : alleVergeben(s.anzahl);
}

export function linkProbeStand(s: ProbeStand): string {
  return `${s.besucht} besucht · ${s.angemeldet} angemeldet`;
}

/** Ist die Anzahl erreicht, steht das über den Trainings (AK 12). */
export function linkProbeVoll(vorname: string, s: ProbeStand): string {
  // Ist alles schon besucht, gibt es nichts abzumelden.
  const frei = s.angemeldet > 0 ? ` Meldest du ${vorname} von einem Training ab, wird der Platz wieder frei.` : "";
  return `${alleVergeben(s.anzahl)}.${frei} Für weitere Trainings wende dich an das Team.`;
}
