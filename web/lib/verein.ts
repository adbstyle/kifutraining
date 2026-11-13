// Die Regeln des Vereins (Epic Vereine #575, Story #577): Grenzen und die
// Sätze zu den Markern der Datenebene.
//
// Eine Regelquelle für Oberfläche und KI-Werkzeuge: Die Datenebene meldet
// mit denselben Markern (VEREIN_MELDUNG), und `fachlicheMeldung`
// (lib/training-bedingungen.ts) übersetzt sie in diese Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

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
  NUR_IN_DER_ANWENDUNG: "Das geht nur in der Anwendung, nicht über einen KI-Assistenten.",
} as const;
