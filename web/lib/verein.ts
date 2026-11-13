// Die Regeln des Vereins (Epic Vereine #575, Story #577): Grenzen und die
// Sätze zu den Markern der Datenebene.
//
// Eine Regelquelle für Oberfläche und KI-Werkzeuge: Die Datenebene meldet
// mit denselben Markern (VEREIN_MELDUNG), und `fachlicheMeldung`
// (lib/training-bedingungen.ts) übersetzt sie in diese Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { SPIELER_MAX, spielerName } from "@/lib/spieler";

/** Zwilling der Grenze im Trigger `spieler_vorher` (Marker `VEREIN_VOLL`): So
 *  viele Spieler:innen führt ein Verein höchstens — mit denen ohne Team, den
 *  Schnuppernden und Doppeleinträgen. Sie wirkt nur auf neue Einträge. */
export const VEREIN_SPIELER_MAX = 1000;
/** Zwilling der Grenze im Trigger `teams_vorher` (Marker `VEREIN_TEAMS_VOLL`). */
export const VEREIN_TEAMS_MAX = 30;

/** Die Sätze zu den Markern der Datenebene (Migrationen vereine_fundament und
 *  spieler_ueber_zuordnung). `VEREIN_VOLL` (Verein) und `SPIELERLISTE_VOLL`
 *  (Team, lib/spieler.ts) bleiben getrennt: Wer abgewiesen wird, erfährt, welche
 *  Grenze erreicht ist (Story #577 AK 7). Kein Marker nennt den Verein einer
 *  anderen Person. Kein Marker steckt in einem anderen (`check:kern`). */
export const VEREIN_MELDUNG = {
  /** Netz: Ein Team entsteht nie ohne Verein. */
  VEREIN_FEHLT: "Ein Team gehört immer zu einem Verein.",
  /** Netz: Ein Team wechselt den Verein nie. */
  VEREIN_FEST: "Ein Team bleibt in seinem Verein.",
  VEREIN_VOLL: `Der Verein hat schon ${VEREIN_SPIELER_MAX} Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.`,
  VEREIN_TEAMS_VOLL: `Der Verein hat schon ${VEREIN_TEAMS_MAX} Teams. Ein weiteres kommt erst dazu, wenn es weniger sind.`,
  TEAM_NUR_VERWALTUNG: "Neue Teams legt die Vereinsverwaltung an.",
  /** Netz; die Anwendung zeigt den Status `letzte_verwaltung` mit demselben Satz. */
  LETZTE_VERWALTUNG:
    "Du bist das letzte Mitglied der Vereinsverwaltung. Nimm zuerst eine weitere Person in die Verwaltung auf. " +
    "Du kannst den Verein auch im Bereich «Verein» löschen.",
  /** Netz; nennt den anderen Verein nie. */
  ANDERER_VEREIN:
    "Diese Person gehört schon einem Verein an. Aufnehmen lässt sie sich erst, wenn sie ihn verlassen hat.",
  /** Netz der `verein_*`-RPCs (Story #579): Wer nicht zur Verwaltung dieses
   *  Vereins gehört, erfährt nur dies — nie, ob es ihn gibt. */
  VEREIN_NICHT_GEFUNDEN: "Verein nicht gefunden.",
  NUR_IN_DER_ANWENDUNG: "Das geht nur in der Anwendung, nicht über einen KI-Assistenten.",
} as const;

// ── Spieler:innen einem Team zuordnen (Story #579) ──────────────────────────

/** Eine Spieler:in, wie die Abweisung sie nennt (`verein_spieler_zuordnen`). */
export type SpielerKurz = { id: string; vorname: string; nachname: string; jahrgang: number };

/** Die Abweisung einer Zuordnung ohne jede Änderung (AP §4.3): wer dem Team
 *  schon zugeordnet ist, wer mit gleichen Angaben schon dort steht, wer in
 *  einem Team schnuppert (mit dessen Namen) und um wie viele die Grenze des
 *  Teams überschritten würde. */
export type ZuordnenAbweisung = {
  bereits: SpielerKurz[];
  gleich: SpielerKurz[];
  schnuppert: (SpielerKurz & { team: string })[];
  ueber_grenze: number;
};

/** «A», «A und B», «A, B und C». */
function aufzaehlung(namen: string[]): string {
  return namen.length <= 1 ? (namen[0] ?? "") : `${namen.slice(0, -1).join(", ")} und ${namen.at(-1)}`;
}

/** Bis drei beim Namen, darüber die Zahl. */
function wer(namen: string[]): string {
  return namen.length <= 3 ? aufzaehlung(namen) : `${namen.length} Spieler:innen`;
}

const mitJahrgang = (p: SpielerKurz) => `${spielerName(p)} (${p.jahrgang})`;

/** Der Satz zur Abweisung einer einzelnen oder gesammelten Zuordnung
 *  (#579 AK 4–7, 21, 22): zuerst gleiche Angaben und bestehende Zuordnungen,
 *  dann die Schnuppernden, zuletzt die Grenze des Teams. `gewaehlt`: wie
 *  viele Spieler:innen zur Wahl standen — bei einer ist es eine einzelne
 *  Zuordnung. Wortlaut des Boards (Gleiche Angaben, Grenze gesammelt), das
 *  Übrige im selben Stil. */
export function zuordnenAbweisungText(a: ZuordnenAbweisung, team: string, gewaehlt: number): string {
  const saetze: string[] = [];
  if (a.bereits.length === 1) saetze.push(`${mitJahrgang(a.bereits[0])} ist ${team} schon zugeordnet.`);
  else if (a.bereits.length > 1) saetze.push(`${aufzaehlung(a.bereits.map(mitJahrgang))} sind ${team} schon zugeordnet.`);
  if (a.gleich.length === 1) {
    const p = a.gleich[0];
    saetze.push(`${team} führt schon eine Spieler:in mit gleichen Angaben wie ${spielerName(p)}, ${p.jahrgang}.`);
  } else if (a.gleich.length > 1) {
    saetze.push(`${team} führt schon Spieler:innen mit gleichen Angaben wie ${aufzaehlung(a.gleich.map(mitJahrgang))}.`);
  }
  for (const p of a.schnuppert)
    saetze.push(`${mitJahrgang(p)} schnuppert im Team ${p.team} und lässt sich keinem weiteren Team zuordnen.`);
  if (a.ueber_grenze > 0)
    saetze.push(
      gewaehlt === 1
        ? `${team} umfasst schon ${SPIELER_MAX} oder mehr Spieler:innen. Die Grenze des Teams ist erreicht; eine weitere Spieler:in lässt sich nicht zuordnen.`
        : `Mit allen gewählten wären es ${SPIELER_MAX + a.ueber_grenze} von ${SPIELER_MAX}, ${a.ueber_grenze === 1 ? "eine" : a.ueber_grenze} zu viel.`,
    );
  saetze.push(gewaehlt === 1 ? "Wähle ein anderes Team und versuche es nochmals." : "Ändere die Auswahl und versuche es nochmals.");
  return saetze.join(" ");
}

/** Die Meldung nach dem Zuordnen (#579 AK 23): wer zugeordnet ist und, wenn
 *  das Team vorher keine Spieler:innen hatte, an wie vielen anstehenden
 *  Terminen die erwartete Spielerzahl weggefallen ist. */
export function zugeordnetText(namen: string[], team: string, ersetzt: number): string {
  const zugeordnet = `${wer(namen)} ${namen.length === 1 ? "ist" : "sind"} jetzt dem Team ${team} zugeordnet.`;
  if (ersetzt === 0) return zugeordnet;
  return `${zugeordnet} An ${ersetzt === 1 ? "1 anstehenden Termin" : `${ersetzt} anstehenden Terminen`} ist die erwartete Spielerzahl weggefallen: Die Spielerzahl kommt jetzt aus der Spielerliste.`;
}

/** Der Satz über der Auswahl des Teams im Dialog «Einem Team zuordnen» (Board). */
export function zuordnenEinleitung(namen: string[]): string {
  return `${wer(namen)} ${namen.length === 1 ? "kommt" : "kommen"} ins gewählte Team. Bisherige Teams bleiben bestehen.`;
}
