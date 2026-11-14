// Die Regeln des Vereins (Epic Vereine #575, Story #577): Grenzen und die
// Sätze zu den Markern der Datenebene.
//
// Eine Regelquelle für Oberfläche und KI-Werkzeuge: Die Datenebene meldet
// mit denselben Markern (VEREIN_MELDUNG), und `fachlicheMeldung`
// (lib/training-bedingungen.ts) übersetzt sie in diese Sätze.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
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
};

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
  if (d.teams.length > 0) return `${name} wird im ${verein} schon ${imTeam(d.teams)} geführt. ${zuordnen} ${ZUSATZ_IM_VORNAMEN}`;
  return `${name} wird im ${verein} schon geführt, ist aber keinem Team zugeordnet. ${zuordnen} ${ZUSATZ_IM_VORNAMEN}`;
}

/** Der Satz zur abgewiesenen Änderung (#582 AK 5): Wortlaut wie am Team-Ort,
 *  ohne den Verweis an die Verwaltung — sie ist die Verwaltung. */
export function spielerAendernAbgewiesenText(d: SpielerDoppeltImVerein): string {
  const anfang = "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt";
  return d.teams.length > 0 ? `${anfang}, ${imTeam(d.teams)}.` : `${anfang}, die keinem Team zugeordnet ist.`;
}

/** Der Satz über dem Dialog «Spieler:in erfassen». */
export function spielerErfassenEinleitung(verein: string): string {
  return `Die Spieler:in kommt ohne Team in den ${verein}. Einem Team ordnest du sie danach zu.`;
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

/** Die Kopfzeile von `/verein/spieler`: «144 Spieler:innen · 2 ohne Team ·
 *  höchstens 1000 je Verein». */
export function spielerKopfText(spieler: number, ohneTeam: number): string {
  return `${spielerZahlWort(spieler)}${ohneTeam > 0 ? ` · ${ohneTeam} ohne Team` : ""} · höchstens ${VEREIN_SPIELER_MAX} je Verein`;
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

/** Der Leerzustand von `/verein/spieler`, solange der Verein niemanden führt. */
export const SPIELER_BESTAND_LEER = {
  titel: "Noch keine Spieler:innen",
  text: "Der Verein führt noch keine Spieler:innen. Erfasse die erste oder nimm sie in der Spielerliste eines Teams auf.",
} as const;
