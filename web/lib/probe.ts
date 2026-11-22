// Schnuppertraining (Epic #554, Story #555, umbenannt mit Story #584): Regeln
// und Texte des Schnupperns für Oberfläche, privaten Link und KI-Werkzeuge —
// eine Quelle, wortgleich. Intern heisst es weiter `probe`, in der Oberfläche
// und in der KI «Schnuppern» (Epic Vereine, F-Begriff).
//
// Eine schnuppernde Spieler:in ist an Trainings zuerst nicht angemeldet und
// meldet sich an; über den Link nur, solange besuchte und künftig angemeldete
// Schnuppertrainings samt dieser Anmeldung die Anzahl des Teams nicht
// übersteigen. Spiele gelten für sie nicht. Schnuppern geht nur in genau einem
// Team. Die Regeln selbst stehen in der Datenebene
// (20261029110000_probetraining.sql); hier stehen ihre Zwillinge und Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

import { infoTextBereinigt, infoTextLaenge } from "./info-text";

/** Zwilling des Checks `team_probetraining_anzahl`. */
export const PROBE_ANZAHL_MIN = 1;
export const PROBE_ANZAHL_MAX = 20;
/** Zwilling des Checks `team_probetraining_info` (#556 AK 2). */
export const PROBE_INFO_MAX = 2000;

/** Der Stand einer schnuppernden Spieler:in (`probe_stand`). `anzahl` ist leer, solange
 *  das Team keine festgelegt hat; `moeglich` wird nie kleiner als null. */
export type ProbeStand = {
  anzahl: number | null;
  besucht: number;
  angemeldet: number;
  moeglich: number;
};

/** Die Schnuppertraining-Einstellung des Teams; `anzahl` leer = nicht konfiguriert,
 *  `info` leer = kein Info-Schreiben (#556). */
export type Probetraining = { anzahl: number | null; info: string | null };

export const PROBE_TEXT = {
  titel: "Schnuppertraining",
  /** AK 4: unter dem Titel steht, für wen es gedacht ist. */
  karte:
    "Für Spieler:innen, die den Verein ausprobieren. Sie melden sich über ihren Link selbst für Trainings an, höchstens für so viele, wie das Team festlegt. Spiele sehen sie nicht.",
  leerTitel: "Noch kein Schnuppertraining",
  leer: "Lege fest, wie viele Trainings eine Spieler:in zum Schnuppern besuchen darf. Danach kannst du das Schnuppern bei Spieler:innen einschalten.",
  konfigurieren: "Schnuppertraining konfigurieren",
  bearbeiten: "Schnuppertraining bearbeiten",
  dialog: "Gilt für alle schnuppernden Spieler:innen des Teams.",
  anzahl: "Anzahl Schnuppertrainings",
  anzahlHinweis: `${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX} · zählt besuchte und angemeldete Trainings`,
  anzahlProblem: `Gib eine ganze Zahl von ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX} ein.`,
  imProbeModus: "Schnuppert",
  niemand: "Noch niemand. Das Schnuppern schaltest du bei einer Spieler:in im Dialog «Spieler:in ändern» ein.",
  festgelegt: "Schnuppertraining gespeichert.",
  /** Die Checkbox im Dialog «Spieler:in ändern». */
  checkbox: "Schnuppert",
  /** Ohne festgelegte Anzahl lässt sich nichts einschalten (AK 4, 18). */
  anzahlFehlt: "Lege zuerst in der Karte «Schnuppertraining» fest, wie viele Trainings eine Spieler:in zum Schnuppern besuchen darf.",
  einschalten: "Schnuppern einschalten",
  /** Wer weiteren Teams zugeordnet ist, schnuppert nicht (Vereine AP §5.3, AK 6). */
  mehrereTeams: "Diese Spieler:in ist weiteren Teams zugeordnet und macht darum regulär in deinem Team mit.",
  /** Beim Einschalten und beim Zuordnen zum Schnuppern (AK 7). */
  keinWeiteresTeam: "Solange die Spieler:in schnuppert, lässt sie sich keinem weiteren Team zuordnen.",
  /** Netz-Marker `SPIELER_SCHNUPPERT` — ohne Teamnamen, der Normalfall nennt das Team. */
  schnuppertAnderswo:
    "Diese Spieler:in schnuppert in einem anderen Team. Dort beendet zuerst ein Mitglied das Schnuppern, oder sie wird aus dem Team genommen.",
  /** Marker `SCHNUPPERN_NUR_EINZELN`. */
  nurEinzeln: "Zum Schnuppern lässt sich nur eine Spieler:in zuordnen.",
  /** Am privaten Link: nach Ablauf der Anzahl (AK 12). */
  vergeben: "Schnuppertrainings vergeben",
  /** Die Abweisung am Link, wenn die Anzahl erreicht ist (AK 12). */
  voll: "Alle Schnuppertrainings sind vergeben. Meldest du von einem anderen Training ab, wird ein Platz frei. Für weitere Trainings wende dich an das Team.",
  imProbeModusZahl: (n: number) => (n === 1 ? "1 Spieler:in schnuppert" : `${n} Spieler:innen schnuppern`),
  nichtAngemeldet: "Nicht angemeldet",
  // ── Info-Schreiben (#556) ──
  info: "Info-Schreiben",
  infoFeld: "Info-Schreiben (optional)",
  /** AK 3: wer es sieht — fest hinter dem ⓘ. */
  infoWer: "Das sehen alle schnuppernden Spieler:innen und ihre Eltern am privaten Link unter «Infos».",
  infoUnter: "Nur Text. Webadressen werden im Link anklickbar.",
  infoZuLang: `Das Info-Schreiben darf höchstens ${PROBE_INFO_MAX} Zeichen lang sein.`,
  infoKeines: "Keines",
  /** Am privaten Link (AK 4). */
  linkInfoTitel: "Infos zum Schnuppertraining",
  /** Unter der Spielerliste, sobald jemand schnuppert. */
  listeHinweis:
    "«Schnuppern 1/4»: 1 von 4 Schnuppertrainings besucht. Für welche Trainings jemand angemeldet ist, steht am jeweiligen Training. Schnuppernde Spieler:innen zählen bei den Angemeldeten eines Trainings nur, wenn sie angemeldet sind.",
} as const;

/** Was an einer Anzahl nicht stimmt, sonst `null` (AK 2). */
export function probeAnzahlProblem(n: number | null | undefined): string | null {
  return typeof n === "number" && Number.isInteger(n) && n >= PROBE_ANZAHL_MIN && n <= PROBE_ANZAHL_MAX
    ? null
    : PROBE_TEXT.anzahlProblem;
}

/** Was das Schnuppern für die Spieler:in bedeutet, vor dem Einschalten (AK 16). */
export function probeEinschaltenText(vorname: string, anzahl: number | null): string {
  const hoechstens = anzahl === null ? "" : `, höchstens für ${anzahl}`;
  return `${vorname} meldet sich selbst für Trainings an${hoechstens}. Spiele sieht ${vorname} nicht.`;
}

/** Was das Ausschalten bewirkt, vorher (AK 19). */
export function probeAusschaltenText(vorname: string): string {
  return `${vorname} ist danach an allen kommenden Trainings angemeldet und sieht Spiele wie alle. Schaltest du das Schnuppern später wieder ein, zählt es wieder ab null.`;
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
  SCHNUPPERN_MEHRERE_TEAMS: PROBE_TEXT.mehrereTeams,
  SPIELER_SCHNUPPERT: PROBE_TEXT.schnuppertAnderswo,
  SCHNUPPERN_NUR_EINZELN: PROBE_TEXT.nurEinzeln,
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
  return infoTextBereinigt(text);
}

/** Zeichen wie `char_length`: Codepunkte, nicht UTF-16-Einheiten. */
export function probeInfoLaenge(text: string | null | undefined): number {
  return infoTextLaenge(text);
}

/** Was am Info-Schreiben nicht stimmt, sonst `null` (AK 2). */
export function probeInfoProblem(text: string | null | undefined): string | null {
  return probeInfoLaenge(text) > PROBE_INFO_MAX ? PROBE_TEXT.infoZuLang : null;
}

/** Was die Plakette braucht: besuchte von der Anzahl — angemeldete und freie
 *  Plätze gehören nicht hinein (die Verwaltung kennt sie nicht). */
export type SchnupperZahl = Pick<ProbeStand, "anzahl" | "besucht">;

/** Die Plakette in der Spielerliste: «Schnuppern 1/4» — besuchte von der
 *  Anzahl (PO 2026-10-29); ohne Anzahl nur «Schnuppern». */
export function probeKurz(s: SchnupperZahl | null): string {
  return s?.anzahl ? `Schnuppern ${s.besucht}/${s.anzahl}` : "Schnuppern";
}

/** Dasselbe ausgeschrieben, für die Vorlesehilfe. */
export function probeLang(s: SchnupperZahl | null): string {
  return s?.anzahl ? `Schnuppern: ${s.besucht} von ${s.anzahl} Schnuppertrainings besucht` : "Schnuppert";
}

/** Eine Anmeldung durch ein Mitglied oder die KI über der Anzahl (Zusatzentscheid
 *  PO 2026-10-29): ein kurzer Hinweis, an Oberfläche und KI wortgleich. */
export function ueberAnzahl(s: ProbeStand | null | undefined): boolean {
  return !!s && s.anzahl !== null && s.besucht + s.angemeldet > s.anzahl;
}

export function ueberAnzahlText(name: string, s: ProbeStand): string {
  return `${name} ist damit über der Anzahl Schnuppertrainings: ${s.besucht} besucht und ${s.angemeldet} angemeldet, vorgesehen sind ${s.anzahl}.`;
}

// ── Am privaten Link (AK 9, 11, 12) ─────────────────────────────────────────

export function linkProbeKopf(vorname: string): string {
  return `${vorname} schnuppert. Melde ${vorname} für die Trainings an, an denen ${vorname} teilnimmt, und bis zum Beginn wieder ab.`;
}

/** «1 Schnuppertraining», «4 Schnuppertrainings». */
function schnuppertrainings(n: number): string {
  return n === 1 ? "1 Schnuppertraining" : `${n} Schnuppertrainings`;
}

/** Was vergeben ist: «Das Schnuppertraining», «Alle 4 Schnuppertrainings» (ohne «Alle 1»). */
function alleVergeben(n: number | null): string {
  return n === 1 ? "Das Schnuppertraining ist vergeben" : `Alle ${n} Schnuppertrainings sind vergeben`;
}

export function linkProbeZaehler(s: ProbeStand): string {
  if (s.anzahl === null) return `${s.besucht} besucht · ${s.angemeldet} angemeldet`;
  // Die Kopfzeile knapp wie im Entwurf: «Alle 4 Schnuppertrainings vergeben».
  if (s.moeglich > 0) return `Noch ${s.moeglich} von ${schnuppertrainings(s.anzahl)} möglich`;
  return s.anzahl === 1 ? "Das Schnuppertraining ist vergeben" : `Alle ${s.anzahl} Schnuppertrainings vergeben`;
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
