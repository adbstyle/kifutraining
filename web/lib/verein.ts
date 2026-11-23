// Die Regeln des Vereins (Epic Vereine #575, Story #577): Grenzen und die
// Sätze zu den Markern der Datenebene.
//
// Eine Regelquelle für Oberfläche und KI-Werkzeuge: Die Datenebene meldet
// mit denselben Markern (VEREIN_MELDUNG), und `fachlicheMeldung`
// (lib/training-bedingungen.ts) übersetzt sie in diese Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { PROBE_TEXT } from "@/lib/probe";
import { SPIELER_MAX, aufzaehlung, bereinigeName, imTeam, spielerName } from "@/lib/spieler";

/** Zwilling der Grenze im Trigger `spieler_vorher` (Marker `VEREIN_VOLL`): So
 *  viele Spieler:innen führt ein Verein höchstens — mit denen ohne Team, den
 *  Schnuppernden und Doppeleinträgen. Sie wirkt nur auf neue Einträge. */
export const VEREIN_SPIELER_MAX = 1000;
/** Zwilling der Grenze im Trigger `teams_vorher` (Marker `VEREIN_TEAMS_VOLL`). */
export const VEREIN_TEAMS_MAX = 30;

/** «Team nicht gefunden» am Verein-Ort: Die Verwaltung arbeitet in Teams
 *  ohne Mitgliedschaft, darum ohne den Zusatz des Team-Orts
 *  (`SERIE_MELDUNG.TEAM_NICHT_GEFUNDEN`). Kein Marker: Die Datenebene meldet
 *  `VEREIN_NICHT_GEFUNDEN`, der Verein-Kern übersetzt es bei
 *  Team-adressierten RPCs in diesen Satz. */
export const VEREIN_TEAM_NICHT_GEFUNDEN = "Team nicht gefunden.";

/** Eine Action der Vereinsverwaltung fand ihr Ziel nicht mehr (Feld
 *  `team_id` bzw. `verein_id`: Team aufgelöst, Recht entzogen; `spieler_id`:
 *  Spieler:in inzwischen gelöscht, #582 AK 15). Die offene Seite ist
 *  überholt; der Aufrufer lädt sie neu, und sie leitet weiter. */
export function zielWeg(feld?: string): boolean {
  return feld === "team_id" || feld === "verein_id" || feld === "spieler_id";
}

/** Hinweis der Teamübersicht für alle ausser der Verwaltung. Kein Marker
 *  (mehr): Seit Story #581 legt kein Weg am Team-Ort ein Team an, nur
 *  `verein_team_anlegen` — darum nicht in `VEREIN_MELDUNG`, das als
 *  Markerliste durchlaufen wird. */
export const TEAM_NUR_VERWALTUNG = "Neue Teams legt die Vereinsverwaltung an.";

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
  /** Netz der Teamnamen (Story #581): Der Name steht im Verein schon; die
   *  Anwendung nennt mit `teamnameVergebenText` das Team. */
  TEAMNAME_VERGEBEN: "Im Verein trägt schon ein anderes Team diesen Namen.",
  NUR_IN_DER_ANWENDUNG: "Das geht nur in der Anwendung, nicht über einen KI-Assistenten.",
  /** Das Gründen verlangt die Bestätigung, für den Verein handeln zu dürfen
   *  (#587 AK 3, #675 AK 2); die Datenebene prüft sie, auch wenn die
   *  Oberfläche den Knopf schon sperrt. */
  BESTAETIGUNG_FEHLT: "Bestätige zuerst, dass du für den Verein handeln darfst.",
  /** … und die Zustimmung zur Vereinbarung zur Auftragsbearbeitung (#675 AK 2). */
  ZUSTIMMUNG_FEHLT: "Stimme zuerst für den Verein der Vereinbarung zur Auftragsbearbeitung zu.",
  /** Seit dem Öffnen des Dialogs gilt eine neue Fassung der Vereinbarung
   *  (`vereinbarung_fassung()`): Zugestimmt wird nur der geltenden. */
  VEREINBARUNG_VERALTET:
    "Inzwischen gilt eine neue Fassung der Vereinbarung zur Auftragsbearbeitung. Lade die Seite neu, lies sie und stimme ihr zu.",
  /** Gründen kann nur, wer keinem Verein angehört (#587 AK 2). */
  SCHON_IM_VEREIN: "Du gehörst schon einem Verein an. Einen Verein gründen kann nur, wer keinem angehört.",
} as const;

/** Zwilling des CHECK `verein_name`: so viele Zeichen darf ein Vereinsname
 *  höchstens haben (getrimmt gezählt). */
export const VEREIN_NAME_MAX = 60;

/** Was einem Vereinsnamen im Weg steht — `null`, wenn er sich speichern lässt.
 *  Das Web prüft vorab; die Datenebene weist mit dem CHECK ab. */
export function vereinsNameProblem(name: string): string | null {
  const getrimmt = name.trim();
  if (!getrimmt) return "Bitte einen Vereinsnamen angeben.";
  if (getrimmt.length > VEREIN_NAME_MAX) return `Der Vereinsname darf höchstens ${VEREIN_NAME_MAX} Zeichen lang sein.`;
  return null;
}

/** Der Satz, wenn der Teamname im Verein schon vergeben ist (#581 AK 21):
 *  nennt das Team, das ihn trägt. */
export function teamnameVergebenText(team: string): string {
  return `Im Verein trägt schon das Team «${team}» diesen Namen.`;
}

/** Der Einstieg für ein Konto ohne Verein auf `/teams` (#587 AK 5): zwei
 *  Wege, einen Verein zu haben. Wortlaut des Boards. */
export const TEAMS_OHNE_VEREIN_TEXT = {
  titel: "Willkommen bei KiFu",
  einleitung: "Übungen und Trainings bereitest du schon jetzt vor. Teams, Spielerlisten und Kalender gibt es in einem Verein.",
  gruenden: {
    titel: "Verein gründen",
    text: "Du wirst die erste Person der Vereinsverwaltung. Danach legst du Teams an und nimmst Trainer:innen auf, dich selbst eingeschlossen.",
    knopf: "Verein gründen",
  },
  aufnahme: {
    titel: "In einen Verein aufgenommen werden",
    text: "Trainer:innen eines Teams oder die Vereinsverwaltung nehmen dich mit deiner E-Mail-Adresse in ein Team oder in die Verwaltung auf. Gib ihnen diese Adresse; danach arbeitest du sofort im Verein mit.",
    feld: "Deine E-Mail-Adresse",
  },
} as const;

/** Der Dialog «Verein gründen» (#587 AK 1–3, #675 AK 1, 2): Name, zwei
 *  Pflicht-Bestätigungen — berechtigt zu handeln und die Zustimmung zur
 *  Vereinbarung zur Auftragsbearbeitung, mit Link zum Lesen (`lesen`) — und
 *  was das Gründen für die Person bedeutet. Der feste Hinweis zum Namen
 *  steht hinter ⓘ (`info` am Feld). */
export const VEREIN_GRUENDEN_TEXT = {
  titel: "Verein gründen",
  feld: "Name des Vereins",
  info: `Höchstens ${VEREIN_NAME_MAX} Zeichen. Den Namen kannst du später ändern.`,
  haken1: "Ich bin berechtigt, für diesen Verein zu handeln.",
  haken2: "Ich stimme für den Verein der Vereinbarung zur Auftragsbearbeitung zu.",
  lesen: "Vereinbarung lesen",
  erste: "Du wirst die erste Person der Vereinsverwaltung. Solange du dabei bist, kannst du keinem anderen Verein angehören.",
  knopf: "Verein gründen",
} as const;

/** Die Vereinbarung zur Auftragsbearbeitung in der Verwaltung des Vereins
 *  (#675 AK 3, 4). `neueFassung` erscheint, wenn eine neuere Fassung gilt als
 *  die, der der Verein zugestimmt hat; `ohneZustimmung` bei Vereinen ohne
 *  festgehaltene Zustimmung (gegründet vor #675). Beides informiert nur und
 *  verlangt keine erneute Zustimmung (Out of Scope 2, Entscheid 3). */
export const VEREIN_VEREINBARUNG_TEXT = {
  titel: "Vereinbarung zur Auftragsbearbeitung",
  text: "Sie regelt, wie KiFu die Daten der Spieler:innen im Auftrag des Vereins bearbeitet.",
  lesen: "Geltende Fassung lesen",
  zugestimmt: (datum: string) => `Der Verein hat ihr am ${datum} zugestimmt.`,
  neueFassung: "Es gilt eine neue Fassung der Vereinbarung zur Auftragsbearbeitung. Lies, was sich geändert hat.",
  ohneZustimmung: "Für den Verein ist in KiFu keine Zustimmung zur Vereinbarung festgehalten.",
  /** Der Weg von der Übersicht zur Karte in der Verwaltung. */
  zurVerwaltung: "Zur Verwaltung",
} as const;

/** Was die Verwaltung zur Vereinbarung erfährt (#675 AK 4): `aktuell`, wenn
 *  der Verein der geltenden Fassung zugestimmt hat; `neue_fassung`, wenn er
 *  einer anderen (älteren) zugestimmt hat; `ohne`, wenn keine Zustimmung
 *  festgehalten ist. Die geltende Fassung ist immer die neuste. */
export function vereinbarungLage(geltend: string, zugestimmt: string | null): "aktuell" | "neue_fassung" | "ohne" {
  if (zugestimmt === null) return "ohne";
  return zugestimmt === geltend ? "aktuell" : "neue_fassung";
}

/** Der Name verletzt den CHECK `verein_name`, den das Web vorab prüft
 *  (`vereinsNameProblem`); diesen Satz sieht nur, wer die Prüfung umgeht. */
export const VEREIN_NAME_UNGUELTIG = "Der Vereinsname ist ungültig.";

// ── Verein löschen, Konto löschen (Story #587) ──────────────────────────────

const anzahl = (zahl: number, eins: string, mehr: string) => `${zahl} ${zahl === 1 ? eins : mehr}`;

/** Verein löschen in der Gefahrenzone der Verwaltung (#587 AK 10, 11): der
 *  Satz der Gefahrenzone, die Beschriftungen und was der Dialog nennt. */
export const VEREIN_LOESCHEN_TEXT = {
  beschreibung:
    "Austreten betrifft nur dich; in deinen Teams bleibst du Trainer:in. Verein löschen entfernt alle Teams und alle Spieler:innen samt Links und Abos; alle Personen werden Konten ohne Verein und behalten ihre eigenen Übungen und Trainings.",
  knopf: "Verein löschen",
  einleitung: "Mit dem Verein wird unwiderruflich gelöscht:",
  feld: "Vereinsname",
  endgueltig: "Das lässt sich nicht rückgängig machen.",
  /** Statt der Liste, wenn der Verein weder Teams noch Spieler:innen hat. */
  leer: "Der Verein hat keine Teams und keine Spieler:innen.",
} as const;

export const vereinLoeschenTitel = (name: string) => `${name} löschen`;

/** Die Meldung nach dem Löschen, auf `/teams` (PC 4: Übungen und Trainings
 *  der Personen bleiben). */
export const vereinGeloeschtText = (name: string) => `Der Verein «${name}» ist gelöscht. Deine eigenen Übungen und Trainings bleiben.`;

/** Was mit dem Verein verschwindet, für den Dialog: die Zeilen der Liste (nur,
 *  was es gibt), dann was aus den Personen wird. `personen`: verschiedene
 *  Konten in Verwaltung und Teams (`verein_ansicht`). */
export function vereinLoeschenFolgen(f: { teams: number; spieler: number; ohneTeam: number; personen: number }): {
  geloescht: string[];
  personen: string;
} {
  const geloescht: string[] = [];
  if (f.teams > 0) geloescht.push(`${anzahl(f.teams, "Team", "Teams")}, mit Terminen und Team-Trainings`);
  if (f.spieler > 0)
    geloescht.push(
      `${anzahl(f.spieler, "Spieler:in", "Spieler:innen")}${f.ohneTeam > 0 ? `, davon ${f.ohneTeam} ohne Team,` : ""} samt Links, Abos und Abholadressen`,
    );
  return {
    geloescht,
    personen:
      f.personen <= 1
        ? "Dein Konto bleibt bestehen, ohne Verein; deine eigenen Übungen und Trainings bleiben."
        : `Alle ${f.personen} Personen werden Konten ohne Verein und behalten ihre eigenen Übungen und Trainings.`,
  };
}

/** Der Name stimmte beim Ausführen nicht mehr (der Verein wurde inzwischen
 *  umbenannt): der aktuelle Name und dass nichts geschehen ist. Fürs Löschen
 *  des Vereins und fürs Löschen des Kontos je ein eigener Satz (#587 AK 14). */
export function vereinHeisstInzwischenText(name: string, was: "verein" | "konto"): string {
  const anfang = `Der Verein heisst inzwischen «${name}». Gib diesen Namen ein, um fortzufahren.`;
  return was === "verein" ? `${anfang} Der Verein bleibt unverändert.` : `${anfang} Verein und Konto bleiben unverändert.`;
}

/** Konto löschen (#587 AK 12–14): die Sätze der drei Fälle des Dialogs und der
 *  Rückmeldungen der Datenebene beim Ausführen. */
export const KONTO_LOESCHEN_TEXT = {
  titel: "Konto wirklich löschen?",
  /** Technischer Fehler: unverändert, ein zweiter Versuch ist möglich. */
  fehler: "Das Konto liess sich nicht löschen. Bitte versuche es noch einmal.",
  /** Die Datenebene hat gelöscht, die Anmeldung lässt sich aber nicht entfernen. */
  teilweise:
    "Deine Übungen, Trainings und gegebenenfalls dein Verein sind schon gelöscht, aber das Konto selbst liess sich nicht entfernen. Bitte versuche es noch einmal.",
  /** Titel des Dialogs im Fall «letzte Verwaltung» (AK 13). */
  nichtLoeschbar: "Konto lässt sich noch nicht löschen",
  /** Fall frei: ein Verein, dem das Konto angehört, bleibt bestehen. */
  vereinBleibt: "Gehörst du einem Verein an, bleibt er bestehen.",
  /** Die einzige Person hat den Dialog mit dem Namen bestätigt, ist es beim
   *  Ausführen aber nicht mehr (weitere Person im Team oder in der Verwaltung,
   *  oder der Verein ist inzwischen anderswo gelöscht): nichts ist gelöscht. */
  weiterePerson:
    "Im Verein hat sich inzwischen etwas geändert. Verein und Konto bleiben unverändert. Prüfe die Angaben und versuche es noch einmal.",
} as const;

/** Fall «letzte Verwaltung» (AK 13): nicht löschbar, solange weitere Personen
 *  dem Verein angehören; der Weg heraus. */
export function kontoLetzteVerwaltungSaetze(verein: string) {
  return {
    lage: `Du bist die letzte Person in der Vereinsverwaltung von «${verein}», und dem Verein gehören weitere Personen an.`,
    weg: "Nimm zuerst jemanden in die Verwaltung auf. Oder lösche den Verein unter Verein › Verwaltung.",
  };
}

/** Fall «einzige Person» (AK 12): Mit dem Konto verschwindet der Verein; die
 *  Zeilen nennen nur, was es gibt. */
export function kontoEinzigePersonSaetze(verein: string, teams: number, spieler: number) {
  const geloescht: string[] = [];
  if (teams > 0) geloescht.push(`${anzahl(teams, "Team", "Teams")}, mit Terminen und Team-Trainings`);
  if (spieler > 0) geloescht.push(`${anzahl(spieler, "Spieler:in", "Spieler:innen")} samt Links, Abos und Abholadressen`);
  return {
    titel: "Konto und Verein löschen",
    // Ohne Liste kein Doppelpunkt ins Leere.
    lage: `Du bist die einzige Person im Verein «${verein}». Mit deinem Konto wird der Verein gelöscht${geloescht.length > 0 ? ":" : "."}`,
    geloescht,
    endgueltig: VEREIN_LOESCHEN_TEXT.endgueltig,
    feld: VEREIN_LOESCHEN_TEXT.feld,
    knopf: "Konto und Verein löschen",
  };
}

/** Beim Ausführen zeigt die Datenebene: Das Konto ist inzwischen die einzige
 *  Person im Verein (vorher gehörten weitere an). Nichts ist gelöscht; der
 *  Dialog verlangt jetzt den Vereinsnamen. */
export const kontoEinzigePersonInzwischenText = (verein: string) =>
  `Dein Konto ist inzwischen die einzige Person im Verein «${verein}». Mit dem Konto wird der Verein gelöscht: Bestätige das mit dem Vereinsnamen. Es ist nichts gelöscht.`;

/** Wenn die Antwort der Datenebene nicht die Form des Vertrags hat: Ob der
 *  Vorgang geschehen ist, ist dann nicht gesagt; der Satz schickt zum Nachsehen
 *  statt zu einem blinden zweiten Versuch (`lib/verein-antwort.ts`). */
export const VEREIN_UNSTIMMIG = {
  gruenden: "Die Antwort liess sich nicht lesen. Lade die Seite neu und prüfe, ob der Verein angelegt ist.",
  vereinbarung: "Die Angaben zur Vereinbarung liessen sich gerade nicht lesen. Lade die Seite neu.",
  loeschen: "Die Antwort liess sich nicht lesen. Lade die Seite neu und prüfe, ob der Verein noch besteht.",
  konto: "Die Antwort liess sich nicht lesen. Melde dich neu an und prüfe, ob dein Konto noch besteht.",
  info: "Die Angaben zu deinem Konto liessen sich gerade nicht lesen. Bitte versuche es noch einmal.",
} as const;

/** Ein Schritt beim Aufnehmen einer Person (Suche oder Aufnahme): die Person
 *  samt Anzeigename — oder der fertige Satz (`PERSON_MELDUNG`), warum es nicht
 *  weitergeht. Eine Form für Kern, Actions und den Baustein `PersonAufnehmen`.
 *  `zielWeg`: Das Ziel (Team oder Verein) ist nicht mehr zu finden, etwa weil
 *  das Team inzwischen aufgelöst oder das Recht der Verwaltung entzogen ist;
 *  die offene Seite ist überholt, der Aufrufer lädt sie neu. */
export type PersonSchritt = { ok: true; anzeigeName: string } | { ok: false; meldung: string; zielWeg?: true };

/** Der Ausgang einer Suche oder Aufnahme einer Person, als Satz — am Team-Ort
 *  und am Verein-Ort derselbe (#581). Der Schlüssel ist der `status` der RPC. */
export const PERSON_MELDUNG = {
  nicht_gefunden: "Zu dieser Adresse gibt es kein bestätigtes Konto. Die Person registriert sich zuerst selbst bei KiFu.",
  anderer_verein: VEREIN_MELDUNG.ANDERER_VEREIN,
  gebremst: "Zu viele Versuche - bitte später erneut.",
  bereits_mitglied: "Diese Person ist bereits im Team.",
  bereits_verwaltung: "Diese Person gehört schon zur Vereinsverwaltung.",
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
  /** Nur beim Zuordnen zum Schnuppern (#584): der Grund, dann sind die vier
   *  Listen leer bzw. 0. */
  grund?: "schnuppern_hat_team" | "schnuppern_anzahl_fehlt";
};

/** Die Sätze der Abweisungen beim Zuordnen zum Schnuppern (#584 AK 9, 10). */
export const SCHNUPPERN_ZUORDNEN_TEXT = {
  schnuppern_hat_team: "Diese Spieler:in ist schon einem Team zugeordnet. Ordne sie ohne Schnuppern zu.",
  schnuppern_anzahl_fehlt: "Das Team hat noch keine Anzahl Schnuppertrainings. Ein Mitglied des Teams legt sie zuerst fest.",
} as const;

/** Beschriftung der Checkbox im Dialog «Einem Team zuordnen» (#584 AK 8). */
export const SCHNUPPERN_ZUORDNEN_LABEL = "Zum Schnuppern zuordnen";

/** Der Satz unter der angehakten Checkbox (#584 AK 7) — derselbe wie beim
 *  Einschalten am Team-Ort. */
export const SCHNUPPERN_ZUORDNEN_HINWEIS = PROBE_TEXT.keinWeiteresTeam;

/** Die Meldung nach dem Zuordnen zum Schnuppern (#584 AK 11). */
export function schnuppernZugeordnetText(name: string, team: string): string {
  return `${name} ist jetzt dem Team ${team} zugeordnet und schnuppert dort.`;
}

/** Die Meldung nach dem Herausnehmen am Verein-Ort. Endete dabei ein
 *  Schnuppertraining, das die Bestätigung nicht angekündigt hat (ein Mitglied
 *  schaltete es nach dem Laden der Seite ein), sagt es der Zusatz (#584 AK 13). */
export function vereinHerausgenommenText(vorname: string, team: string, schnuppernUnangekuendigt: boolean): string {
  const satz = `${vorname} ist nicht mehr im Team ${team}.`;
  return schnuppernUnangekuendigt ? `${satz} Das Schnuppertraining ist damit beendet.` : satz;
}

/** Bis drei beim Namen, darüber die Zahl. */
function wer(namen: string[]): string {
  return namen.length <= 3 ? aufzaehlung(namen) : `${namen.length} Spieler:innen`;
}

const mitJahrgang = (p: SpielerKurz) => `${spielerName(p)} (${p.jahrgang})`;

/** Der Satz zur Abweisung einer einzelnen oder gesammelten Zuordnung
 *  (#579 AK 4–7, 21, 22; #584 AK 9, 10, 12, 16): zuerst gleiche Angaben und bestehende Zuordnungen,
 *  dann die Schnuppernden, zuletzt die Grenze des Teams. `gewaehlt`: wie
 *  viele Spieler:innen zur Wahl standen — bei einer ist es eine einzelne
 *  Zuordnung. Wortlaut des Boards (Gleiche Angaben, Grenze gesammelt), das
 *  Übrige im selben Stil. */
export function zuordnenAbweisungText(a: ZuordnenAbweisung, team: string, gewaehlt: number): string {
  // Beim Zuordnen zum Schnuppern nennt die Datenebene genau einen Grund (#584 AK 9, 10).
  if (a.grund) return SCHNUPPERN_ZUORDNEN_TEXT[a.grund];
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
    saetze.push(`${mitJahrgang(p)} schnuppert im Team «${p.team}». Dort beendet zuerst ein Mitglied das Schnuppern, oder ${p.vorname} wird aus dem Team genommen.`);
  if (a.ueber_grenze > 0)
    saetze.push(
      gewaehlt === 1
        ? `${team} umfasst schon ${SPIELER_MAX} oder mehr Spieler:innen. Die Grenze des Teams ist erreicht; eine weitere Spieler:in lässt sich nicht zuordnen.`
        : `Mit allen gewählten wären es ${SPIELER_MAX + a.ueber_grenze} von ${SPIELER_MAX}, ${a.ueber_grenze === 1 ? "eine" : a.ueber_grenze} zu viel.`,
    );
  // Eine einzelne Schnuppernde lässt sich auch keinem anderen Team zuordnen:
  // Dann gilt nur der Ausweg aus ihrem Satz (#584 AK 12), kein «anderes Team».
  if (gewaehlt !== 1) saetze.push("Ändere die Auswahl und versuche es nochmals.");
  else if (a.schnuppert.length === 0) saetze.push("Wähle ein anderes Team und versuche es nochmals.");
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

// ── Spielerbestand der Verwaltung (Story #582) ──────────────────────────────
//
// Eigene Sätze für die Verwaltung: `spielerDoppeltText` (lib/spieler.ts) und
// `LINK_TEXT` sprechen Trainer:innen an und fliessen in die KI-Beschreibungen,
// sie bleiben unverändert. Nie J+S-Nummer oder Link in einem Satz.

/** Der Status `abgewiesen` der RPCs `verein_spieler_anlegen` und
 *  `verein_spieler_aendern`: die Namen aller Teams der bestehenden
 *  Spieler:in(nen) mit diesem Schlüssel und ob eine davon keinem Team
 *  zugeordnet ist. */
export type SpielerDoppeltImVerein = { teams: string[]; ohne_team: boolean };

const ZUSATZ_IM_VORNAMEN = "Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.";

/** Der Satz zur abgewiesenen Erfassung ohne Team (#582 AK 4): nennt die Teams
 *  der bestehenden Spieler:in oder dass sie keinem zugeordnet ist, dass die
 *  Verwaltung sie selbst zuordnet und wie man Gleichnamige unterscheidet.
 *  Bei Altdubletten (Teams und eine ohne Team) nur die Teams. Die Eingabe
 *  steht bereinigt, wie sie gespeichert würde. */
export function spielerErfassenAbgewiesenText(
  d: SpielerDoppeltImVerein,
  e: { vorname: string; nachname: string; jahrgang: number },
  verein: string,
): string {
  const name = `${spielerName({ vorname: bereinigeName(e.vorname), nachname: bereinigeName(e.nachname) })} (${e.jahrgang})`;
  const zuordnen = "Ordne die vorhandene Spieler:in selbst einem Team zu.";
  if (d.teams.length > 0) return `${name} wird im Verein «${verein}» schon ${imTeam(d.teams)} geführt. ${zuordnen} ${ZUSATZ_IM_VORNAMEN}`;
  return `${name} wird im Verein «${verein}» schon geführt, ist aber keinem Team zugeordnet. ${zuordnen} ${ZUSATZ_IM_VORNAMEN}`;
}

/** Der Satz zur abgewiesenen Änderung (#582 AK 5): Wortlaut wie am Team-Ort,
 *  ohne den Verweis an die Verwaltung — sie ist die Verwaltung. */
export function spielerAendernAbgewiesenText(d: SpielerDoppeltImVerein): string {
  const anfang = "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt";
  return d.teams.length > 0 ? `${anfang}, ${imTeam(d.teams)}.` : `${anfang}, die keinem Team zugeordnet ist.`;
}

/** Der Satz über dem Dialog «Spieler:in erfassen». */
export function spielerErfassenEinleitung(verein: string): string {
  return `Die Spieler:in kommt ohne Team in den Verein «${verein}». Einem Team ordnest du sie danach zu.`;
}

/** Der Hinweis über dem Link einer Spieler:in ohne Team (#582 AK 10). Eigene
 *  Konstante: `LINK_TEXT` fliesst in die KI-Beschreibungen. */
export function linkOhneTeamText(vorname: string): string {
  return `${vorname} ist keinem Team zugeordnet. Die Spielervertretung sieht erst Termine, wenn ${vorname} einem Team zugeordnet ist; der Link bleibt danach derselbe.`;
}

/** Titel und Sätze der Bestätigung zum Löschen (#582 AK 13): die Teams, aus
 *  denen die Spieler:in verschwindet, oder dass sie keinem zugeordnet ist,
 *  dann die Folgen. `teams`: Namen, nach Name geordnet. */
export function spielerLoeschenTitel(name: string): string {
  return `${name} aus dem Verein löschen`;
}

export function spielerLoeschenSaetze(vorname: string, teams: string[]): { zuordnung: string; link: string; vergangen: string } {
  const zuordnung =
    teams.length === 0
      ? `${vorname} ist keinem Team zugeordnet.`
      : teams.length === 1
        ? `${vorname} ist dem Team ${teams[0]} zugeordnet und verschwindet daraus.`
        : `${vorname} ist den Teams ${aufzaehlung(teams)} zugeordnet und verschwindet aus allen.`;
  return {
    zuordnung,
    link: `Der private Link und alle Meldungen von ${vorname} entfallen endgültig.`,
    vergangen: `An vergangenen Terminen erscheint ${vorname} ohne Namen.`,
  };
}

const spielerZahlWort = (n: number) => (n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`);

/** Die Teile der Kopfzeile von `/verein/spieler`, die zusammen «144
 *  Spieler:innen · 2 ohne Team · höchstens 1000 je Verein» lauten; die
 *  Oberfläche bricht nur zwischen ihnen um. «· 0 ohne Team» entfällt. */
export function spielerKopfTeile(spieler: number, ohneTeam: number): string[] {
  return [spielerZahlWort(spieler), ...(ohneTeam > 0 ? [`${ohneTeam} ${SPIELER_OHNE_TEAM}`] : []), `höchstens ${VEREIN_SPIELER_MAX} je Verein`];
}

/** Die Kopfzeile von `/verein` für die Verwaltung: «10 Teams · 144
 *  Spieler:innen · höchstens 30 Teams». Ohne Zahl der Spieler:innen (kein
 *  Recht) fehlt der mittlere Teil. */
export function vereinKopfText(teams: number, spieler?: number): string {
  const t = teams === 1 ? "1 Team" : `${teams} Teams`;
  return `${t}${spieler === undefined ? "" : ` · ${spielerZahlWort(spieler)}`} · höchstens ${VEREIN_TEAMS_MAX} Teams`;
}

/** Die Zeile «Spieler:innen» der Karte «Verein»; über der Grenze (Altbestand)
 *  nur die Zahl, nie ein negativer Rest. */
export function spielerVonText(n: number): string {
  return n <= VEREIN_SPIELER_MAX ? `${n} von ${VEREIN_SPIELER_MAX}` : `${n} (höchstens ${VEREIN_SPIELER_MAX} Spieler:innen)`;
}

/** Der Leerzustand von `/verein/spieler` für die Verwaltung, solange der Verein niemanden führt. */
export const SPIELER_BESTAND_LEER = {
  titel: "Noch keine Spieler:innen",
  text: "Der Verein führt noch keine Spieler:innen. Erfasse die erste oder nimm sie in der Spielerliste eines Teams auf.",
} as const;

/** Derselbe Leerzustand für ein Mitglied ohne Verwaltung (Story #580 AK 11):
 *  Der Titel ist `SPIELER_BESTAND_LEER.titel`, erfassen kann es hier nicht. */
export const SPIELER_BESTAND_LEER_MITGLIED = "Der Verein führt noch keine Spieler:innen.";

/** Die Plakette einer Spieler:in ohne Team und ihr Wort im Kopf der Liste. */
export const SPIELER_OHNE_TEAM = "ohne Team";

/** Suche und Eingrenzung ergeben niemanden (Story #580 AK 11). */
export const SPIELER_KEINE_TREFFER = {
  titel: "Keine Spieler:in gefunden",
  text: "Ändere die Suche oder die Eingrenzung.",
} as const;

/** Der Hinweis über der Liste für ein Mitglied ohne Verwaltung (Story #580 AK 5). */
export const SPIELER_ZUORDNUNG_HINWEIS = "Spieler:innen ordnet die Vereinsverwaltung einem Team zu.";

/** Die Beschriftungen der Filterleiste von `/verein/spieler` (Story #580 AK 6–8). */
export const SPIELER_FILTER = {
  suche: "Spieler:innen durchsuchen",
  team: "Team",
  ohneTeam: "Ohne Team",
  teamsGruppe: "Teams",
  jahrgang: "Jahrgang",
  zuruecksetzen: "Zurücksetzen",
  weiter: "Weitere anzeigen",
} as const;

/** Unter der Liste, wenn sie in Schritten steht: «50 von 144 angezeigt». */
export function spielerAngezeigtText(angezeigt: number, treffer: number): string {
  return `${angezeigt} von ${treffer} angezeigt`;
}
