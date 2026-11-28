// Die Regeln der Spielerliste eines Teams (Epic #433, Story #434) und die
// Spielerzahl, die aus ihr folgt.
//
// Eine Regelquelle für die Spielerliste der Oberfläche und die KI-Werkzeuge
// «spieler_*» — der Fachkern (lib/kern/spieler.ts) prüft damit vor jedem
// Schreiben, und die Datenebene meldet mit denselben Markern
// (SPIELER_MELDUNG), wenn sie trotzdem abweist. Ob zwei Angaben dieselbe
// Spieler:in meinen (Gross/Klein, Bindestrich, Apostroph), entscheidet allein
// die Datenebene: je Verein über `spieler_text_schluessel` im Trigger
// `spieler_vorher` und in `spieler_doppelt` (Story #578).
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { datumKurz } from "@/lib/zeit";
import { tagOhneJahr } from "@/lib/monat";
import { SPIEL_TEXT } from "@/lib/spiel";
import { PROBE_TEXT, type ProbeStand } from "@/lib/probe";
import { BENACHRICHTIGUNG_TAGE } from "@/lib/benachrichtigung";

/** Zwillinge der Checks `spieler_vorname`, `spieler_nachname`, `spieler_js`
 *  und `spieler_jahrgang`. */
export const NAME_MAX = 60;
export const JS_MAX = 20;
export const JAHRGANG_MIN = 1000;
export const JAHRGANG_MAX = 9999;
/** So viele Ziffern hat ein Jahrgang — für `maxLength` der Felder. */
export const JAHRGANG_STELLEN = 4;
/** Zwilling der Obergrenze im Trigger `team_spieler_vorher` (Marker
 *  `SPIELERLISTE_VOLL`): So viele Zuordnungen führt ein Team höchstens, die
 *  Schnuppernden mitgezählt. Sie wirkt nur auf neue Zuordnungen. Die Grenze
 *  des Vereins steht in lib/verein.ts. */
export const SPIELER_MAX = 100;

export const SPIELER_TEXT = {
  vorname: `Bitte einen Vornamen mit höchstens ${NAME_MAX} Zeichen angeben.`,
  nachname: `Bitte einen Nachnamen mit höchstens ${NAME_MAX} Zeichen angeben.`,
  jahrgang: "Den Jahrgang als vierstellige Jahreszahl eingeben, etwa 2017.",
  jsNummer: `Die J+S-Nummer darf höchstens ${JS_MAX} Zeichen lang sein.`,
} as const;

/** Die Sätze zu den Markern der Datenebene (Migration spielerliste). */
export const SPIELER_MELDUNG = {
  /** Im eigenen Team (#578 AK 3) und als Netz aus dem Trigger `spieler_vorher`
   *  für das Rennen; sonst wählt `spielerDoppeltText` den Satz. */
  SPIELER_DOPPELT:
    "Diese Spieler:in steht schon auf der Liste. Unterscheide zwei Gleichnamige mit einem Zusatz im Vornamen.",
  SPIELERLISTE_VOLL: `Das Team hat schon ${SPIELER_MAX} Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.`,
  /** Netz aus dem Trigger `team_spieler_vorher` (Story #579): Die Zuordnung
   *  besteht schon — die Verwaltung erfährt es sonst als Befund `bereits`. */
  SCHON_ZUGEORDNET: "Diese Spieler:in ist dem Team schon zugeordnet.",
  SPIELER_NICHT_GEFUNDEN: "Spieler:in nicht gefunden.",
  SPIELERLISTE_FUEHRT_ZAHL:
    "Das Team führt eine Spielerliste: Die Spielerzahl anstehender Termine kommt aus ihr und lässt sich nicht von Hand festlegen.",
  /** Der Import im Verein bekommt mehr Zeilen, als eine Datei haben darf
   *  (#585): Zwilling von `IMPORT_ZEILEN_MAX` in lib/spieler-import.ts. */
  IMPORT_ZU_GROSS: "Eine Datei darf höchstens 1000 Zeilen haben.",
} as const;

/** «A», «A und B», «A, B und C» — die eine Aufzählung von Namen (Teams,
 *  Spieler:innen) in allen Sätzen; `bindewort` «oder» für Alternativen. */
export function aufzaehlung(namen: string[], bindewort = "und"): string {
  return namen.length <= 1 ? (namen[0] ?? "") : `${namen.slice(0, -1).join(", ")} ${bindewort} ${namen.at(-1)}`;
}

/** Die eine Ordnung von Teamnamen im Web, wie in allen Team-Listen der
 *  Vereins-Funktionen: deutsch verglichen. Die Datenebene liefert in ihrer
 *  Kollation; die Lade-Funktionen (Kern, Link-Ansicht) ordnen damit einmal,
 *  die Bausteine übernehmen die Folge, wie sie kommt. */
export const nachTeamname = (a: string, b: string): number => a.localeCompare(b, "de");

/** «im Team «A»», «im Team «A» und «B»», «im Team «A», «B» und «C»» —
 *  nach Namen sortiert. */
export function imTeam(teams: string[]): string {
  const namen = [...teams].sort(nachTeamname).map((t) => `«${t}»`);
  return `im Team ${aufzaehlung(namen)}`;
}

/** Der Status `abgewiesen` der RPCs `spieler_aufnehmen` und `spieler_aendern`
 *  (Story #578, Architekturplan Vereine §4.4): Die bestehende Spieler:in
 *  steht im Team, in dem man handelt (`eigenes_team`), oder nur in anderen
 *  Teams des Vereins (`teams`, nur Namen) oder in keinem (`ohne_team`, Story
 *  #579 AK 19). */
export type SpielerDoppelt = { status: "abgewiesen"; grund: "doppelt"; eigenes_team: boolean; teams: string[]; ohne_team: boolean };

/** Der Satz zur Abweisung einer Doppelerfassung, gleich in App und KI
 *  (#578 AK 3, 4, 6, 10; #579 AK 19). Erfassen nennt die Eingabe, bereinigt
 *  wie beim Speichern; Ändern nennt nur die Teams. Im eigenen Team der Satz
 *  zu `SPIELER_DOPPELT`; in anderen Teams nennt er deren Namen, in keinem
 *  Team sagt er, dass die Spieler:in im Verein geführt wird, aber keinem Team
 *  zugeordnet ist — die Zuordnung klärt die Vereinsverwaltung. Nie J+S-Nummer
 *  oder Link (PC 3). */
export function spielerDoppeltText(
  d: Pick<SpielerDoppelt, "eigenes_team" | "teams" | "ohne_team">,
  eingabe: { vorname: string; nachname: string; jahrgang: number } | null,
): string {
  if (d.eigenes_team) return SPIELER_MELDUNG.SPIELER_DOPPELT;
  const name = eingabe
    ? `${spielerName({ vorname: bereinigeName(eingabe.vorname), nachname: bereinigeName(eingabe.nachname) })} (${eingabe.jahrgang})`
    : null;
  if (d.teams.length === 0) {
    if (!d.ohne_team) return SPIELER_MELDUNG.SPIELER_DOPPELT;
    const klaeren = "Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.";
    return name
      ? `${name} wird im Verein geführt, ist aber keinem Team zugeordnet. ${klaeren}`
      : `Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, die keinem Team zugeordnet ist. ${klaeren}`;
  }
  if (!name) return `Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, ${imTeam(d.teams)}.`;
  return `${name} wird im Verein schon ${imTeam(d.teams)} geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.`;
}

/** Die CHECKs der Spielerliste, samt Anführungszeichen gesucht (wie
 *  `TERMIN_CHECKS`). Der Fachkern prüft vorab; die Meldung trifft nur, wer
 *  ihn umgeht. */
export const SPIELER_CHECKS: [string, string][] = [
  ['"spieler_vorname"', SPIELER_TEXT.vorname],
  ['"spieler_nachname"', SPIELER_TEXT.nachname],
  ['"spieler_jahrgang"', SPIELER_TEXT.jahrgang],
  ['"spieler_js"', SPIELER_TEXT.jsNummer],
];

/** Die gespeicherte Form eines Namens: NFC, jeder Leerraum ein Leerzeichen,
 *  aussen keiner. Zwilling von `spieler_text_bereinigt`. */
export function bereinigeName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFC").replace(/[\s   ]+/g, " ").trim();
}

/** Länge wie Postgres `char_length`: in Code Points, nicht in UTF-16-Einheiten. */
function laenge(s: string): number {
  return [...s].length;
}

export type SpielerEingabe = {
  vorname: string;
  nachname: string;
  /** Wie getippt: «2017». */
  jahrgang: string | number;
  /** Optional; leer heisst keine. */
  jsNummer?: string | null;
};

export type SpielerFeld = "vorname" | "nachname" | "jahrgang" | "js_nummer";

/** Was an einer Spieler:in nicht stimmt, sonst `null` (#434 AK 6, 14). */
export function spielerProblem(e: SpielerEingabe): { feld: SpielerFeld; text: string } | null {
  const vorname = bereinigeName(e.vorname);
  const nachname = bereinigeName(e.nachname);
  if (laenge(vorname) < 1 || laenge(vorname) > NAME_MAX) return { feld: "vorname", text: SPIELER_TEXT.vorname };
  if (laenge(nachname) < 1 || laenge(nachname) > NAME_MAX) return { feld: "nachname", text: SPIELER_TEXT.nachname };
  if (jahrgangAus(e.jahrgang) === null) return { feld: "jahrgang", text: SPIELER_TEXT.jahrgang };
  if (laenge((e.jsNummer ?? "").trim()) > JS_MAX) return { feld: "js_nummer", text: SPIELER_TEXT.jsNummer };
  return null;
}

/** Der Jahrgang als Zahl, wenn er vierstellig ist, sonst `null`. */
export function jahrgangAus(j: string | number): number | null {
  const t = String(j).trim();
  if (!/^\d{4}$/.test(t)) return null;
  const n = Number(t);
  return n >= JAHRGANG_MIN && n <= JAHRGANG_MAX ? n : null;
}

/** Was in ein Jahrgang-Feld getippt wird, ohne Nicht-Ziffern. */
export function nurZiffern(s: string): string {
  return s.replace(/\D/g, "");
}

/** Eine Spieler:in, wie die Liste sie führt. */
export type Spieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  jsNummer: string | null;
  /** Stand des aktuellen privaten Links, teamübergreifend (#657 PC 1). */
  linkStand: LinkStand;
  /** Die Kader des Teams, in dessen Liste sie steht (#452 AK 5). */
  kaderIds: string[];
  /** Die Namen der weiteren Teams des Vereins, denen sie zugeordnet ist,
   *  nach Namen (#579 AK 9). */
  weitereTeams: string[];
  /** Sie schnuppert im Team: ihr Stand (#555 AK 6, 7); sonst `null`. */
  probe: ProbeStand | null;
  /** Nur in der Spielerliste eines Teams (#483 AK 11): Nach dem letzten
   *  bekannten Stand hat mindestens ein Gerät Mitteilungen eingeschaltet. */
  mitteilungen?: boolean;
};

/** Überall Vor- und Nachname (Epic PO 2). */
export function spielerName(s: { vorname: string; nachname: string }): string {
  return `${s.vorname} ${s.nachname}`;
}

/** Nach Vorname, dann Nachname — so, wie die Namen dastehen. */
export function nachSpielerName<T extends { vorname: string; nachname: string }>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) => a.vorname.localeCompare(b.vorname, "de") || a.nachname.localeCompare(b.nachname, "de"),
  );
}

// ── Aus dem Team nehmen (Story #579) ────────────────────────────────────────

/** Die Teams einer Spieler:in samt Stand, wie `spieler_teams` sie liefert:
 *  `eigen` — die handelnde Person ist Mitglied; `dieses` — das Team, in dem
 *  sie handelt; `abholbar` — dessen Selbstabholung ist eingeschaltet (#583);
 *  `stand` — die Kennung dieser Teams und ihres Schnupperns, die das
 *  Herausnehmen mitgibt (AP §4.3). */
export type SpielerTeams = {
  teams: { name: string; eigen: boolean; dieses: boolean; abholbar: boolean }[];
  stand: string;
  /** Sie schnuppert in diesem Team (`dieses`, #584): Das Herausnehmen beendet es. */
  schnuppert: boolean;
};

/** Was die Bestätigung des Herausnehmens braucht: wen, aus welchem Team, in
 *  welchem Verein und in welchen weiteren Teams sie danach bleibt. */
export type HerausnehmenLage = {
  vorname: string;
  nachname: string;
  team: string;
  /** Der Name des Vereins; `null`, wo er nicht bekannt ist. */
  verein: string | null;
  /** Die Namen der Teams, in denen sie danach bleibt (ohne `team`). */
  verbleibend: string[];
  /** Sie schnuppert in diesem Team: Das Schnuppertraining endet mit. */
  probe: boolean;
  /** Nur im KI-Weg (#589 AK 4): Es ist das letzte Team der handelnden Person
   *  mit ihr, der Assistent erreicht sie danach nicht mehr. Die Sätze der
   *  Bestätigung (`herausnehmenSaetze`) kennen das Feld nicht; nur
   *  `herausnehmenFrage` hängt den Zusatz an. */
  letztesEigenes?: boolean;
};

/** Die Teams, in denen sie nach dem Herausnehmen bleibt: alle ausser dem,
 *  in dem man handelt — über `dieses`, nicht über den Namen: Teamnamen sind
 *  im Bestand nicht eindeutig. */
export function verbleibendeTeams(teams: { name: string; dieses: boolean }[]): string[] {
  return teams.filter((t) => !t.dieses).map((t) => t.name);
}

export const HERAUSNEHMEN_TEXT = {
  /** Der Stand der Teams wich ab: nichts wurde geändert (AP §4.3). */
  geaendert: "Inzwischen hat sich etwas geändert. Lies den Hinweis noch einmal und bestätige erneut.",
  aktion: "Aus dem Team nehmen",
} as const;

export function herausnehmenTitel(l: Pick<HerausnehmenLage, "vorname" | "nachname" | "team">): string {
  return `${spielerName(l)} aus ${l.team} nehmen`;
}

/** Die Bestätigung des Herausnehmens (#579 AK 13–16, Board «Herausnehmen
 *  statt löschen»): `absaetze` sagen, dass die Spieler:in nicht gelöscht wird
 *  und samt Link im Verein bleibt — mit weiteren Teams oder, beim letzten,
 *  ohne Team —, `warnung` nennt, was in diesem Team verfällt, `zusatz`, was
 *  bleibt. Die Oberfläche setzt sie in den Dialog, der KI-Weg hängt sie zu
 *  einer Rückfrage zusammen (`herausnehmenFrage`). */
export function herausnehmenSaetze(l: HerausnehmenLage): { absaetze: string[]; warnung: string; zusatz: string } {
  const imVerein = l.verein ? `im Verein «${l.verein}»` : "im Verein";
  const wer = l.vorname;
  const verfall = `Abmeldungen, Spiel-Meldungen und Kader in ${l.team} verfallen.`;
  const warnung = l.probe ? `Das Schnuppertraining endet samt Zählung; künftige ${verfall}` : `Künftige ${verfall}`;
  // Gilt in beiden Fällen (PC 5).
  const zusatz = "Vergangene Anwesenheiten bleiben mit dem Namen stehen.";
  if (l.verbleibend.length === 0)
    return {
      absaetze: [
        `${wer} wird dadurch nicht gelöscht und bleibt samt privatem Link ${imVerein}, ist danach aber keinem Team mehr zugeordnet.`,
        "Ändern, einem Team zuordnen oder löschen kann dann nur die Vereinsverwaltung.",
      ],
      warnung,
      zusatz,
    };
  const teams =
    l.verbleibend.length === 1
      ? `im Team ${l.verbleibend[0]}`
      : `in den Teams ${l.verbleibend.slice(0, -1).join(", ")} und ${l.verbleibend.at(-1)}`;
  return {
    absaetze: [
      `${wer} wird dadurch nicht gelöscht und bleibt samt privatem Link ${imVerein} und ${teams}. Aus dem Verein löscht nur die Vereinsverwaltung.`,
    ],
    warnung,
    zusatz,
  };
}

/** Dasselbe als eine Rückfrage an den Assistenten (`spieler_aus_team_nehmen`
 *  ohne `stand`): nichts geschieht, bis er mit dem Stand wiederholt. Beim
 *  letzten Team der handelnden Person mit ihr dazu, dass der Assistent sie
 *  danach nicht mehr erreicht (#589 AK 4) — nur hier, nie im Dialog. */
export function herausnehmenFrage(l: HerausnehmenLage): string {
  const s = herausnehmenSaetze(l);
  const ki = l.letztesEigenes
    ? `Danach ist ${l.vorname} über den Assistenten nicht mehr erreichbar: ${l.vorname} gehört dann keinem deiner Teams mehr an.`
    : "";
  return [herausnehmenTitel(l) + "?", ...s.absaetze, s.warnung, s.zusatz, ki].filter(Boolean).join(" ");
}

// ── Spielerzahl eines Termins ───────────────────────────────────────────────

/** Was die Datenebene zu einem Termin zählt (berechnetes Feld `spielstand`):
 *  `null`, wenn die Liste leer ist bzw. bei Beginn leer war. `anwesend`: ab
 *  Beginn die Anwesenden samt Nachträgen (#475 AK 9), vorher `null`. */
export type Spielstand = {
  gesamt: number;
  angemeldet: number;
  eingefroren: boolean;
  anwesend?: number | null;
  /** Nur an einem Spiel (#463): die Abgemeldeten und die ohne Meldung. */
  abgemeldet?: number;
  ohne_meldung?: number;
  /** Nur an einem Spiel (#464): die nicht Aufgebotenen — sie zählen nur so,
   *  nicht nach ihrer Meldung —, und alle Meldungen samt ihrer. */
  nicht_aufgeboten?: number;
  meldungen?: number;
} | null;

/** Woher die Spielerzahl eines Termins kommt (#434 AK 8, 12; #435 AK 6).
 *  `anwesend`: ab Beginn die Anwesenden, die dann gezählt werden (#475 AK 10). */
export type Spielerzahl =
  | { quelle: "liste"; angemeldet: number; gesamt: number; anwesend: number | null }
  | { quelle: "erwartet"; zahl: number }
  | { quelle: "unbekannt" };

/** Die Liste geht vor, sobald sie jemanden enthält (bzw. bei Beginn enthielt);
 *  sonst gilt die erwartete Zahl. Ein ausgefallener Termin zeigt keine
 *  (#437 AK 4). */
export function spielerzahlVon(t: {
  spielerzahl: number | null;
  spielstand: Spielstand;
  ausgefallen?: boolean;
}): Spielerzahl {
  if (t.ausgefallen) return { quelle: "unbekannt" };
  if (t.spielstand)
    return {
      quelle: "liste",
      angemeldet: t.spielstand.angemeldet,
      gesamt: t.spielstand.gesamt,
      anwesend: t.spielstand.anwesend ?? null,
    };
  return t.spielerzahl !== null ? { quelle: "erwartet", zahl: t.spielerzahl } : { quelle: "unbekannt" };
}

/** Knapp für die Zeile im Trainingsplan: «12/15» oder «12» — ab Beginn die
 *  Anwesenden von allen (#475 AK 10). */
export function spielerzahlKurz(z: Spielerzahl): string | null {
  if (z.quelle === "liste") return `${z.anwesend ?? z.angemeldet}/${z.gesamt}`;
  return z.quelle === "erwartet" ? String(z.zahl) : null;
}

/** Ausgeschrieben: «12 von 15 angemeldet», ab Beginn «11 von 15 da», oder
 *  «12 Spieler:innen erwartet». */
export function spielerzahlLang(z: Spielerzahl): string | null {
  if (z.quelle === "liste")
    return z.anwesend !== null ? `${z.anwesend} von ${z.gesamt} da` : `${z.angemeldet} von ${z.gesamt} angemeldet`;
  if (z.quelle === "erwartet") return `${z.zahl} ${z.zahl === 1 ? "Spieler:in" : "Spieler:innen"} erwartet`;
  return null;
}

// ── Ab- und Anmelden (#435) ─────────────────────────────────────────────────

/** Warum die Datenebene ein Ab- oder Anmelden (`abmeldung_anwenden`) oder
 *  einen Nachtrag (`termin_anwesenheit_setzen`, #475) abweist. */
export type AbmeldeGrund =
  | "nicht_gefunden"
  | "verlegt"
  | "ausgefallen"
  | "begonnen"
  | "gilt_nicht"
  | "nicht_begonnen"
  | "nicht_dabei"
  /** Ein Spiel (#448): Für Spiele gilt diese Abmeldung nicht. */
  | "ist_spiel"
  /** Über den Link: Alle Schnuppertrainings sind vergeben (#555 AK 10, 12). */
  | "probe_voll";

/** Der Stand des Termins, gegen den abgewiesen wurde. */
export type AbmeldeStand = { datum: string; beginn: string; ende: string; ausgefallen: boolean };

export const ABMELDUNG_TEXT = {
  nichtGefunden: "Diesen Termin oder diese Spieler:in gibt es nicht mehr. Sieh dir den Trainingsplan noch einmal an.",
  begonnen: "Der Termin hat begonnen. An- und abmelden geht nur bis zum Beginn.",
  ausgefallen: "Der Termin fällt aus. Für ihn lässt sich niemand an- oder abmelden.",
  /** Der Termin gilt nicht (mehr) für die Spieler:in — ihre Kader (#453 AK 9, #454 AK 5).
   *  Nur für Mitglieder und die KI; am Link steht `linkGiltNichtText` (#583 AK 7). */
  giltNicht: "Dieser Termin gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.",
  /** Ein Termin, der begann, als die Spielerliste leer war. */
  ohneListe: "Bei Beginn führte das Team keine Spielerliste. Für diesen Termin gilt die erwartete Spielerzahl.",
  /** Ein Nachtrag vor Beginn (#475 AK 4). */
  nichtBegonnen: "Der Termin hat noch nicht begonnen. Wer da war, lässt sich erst ab Beginn nachtragen.",
  /** Ein Nachtrag für jemanden, der bei Beginn nicht zum Termin gehörte (#475 AK 5). */
  nichtDabei: "Diese Spieler:in gehörte bei Beginn nicht zu diesem Termin. Nachtragen lässt sich nur, wer da auf der Liste stand.",
  /** An einem ausgefallenen Termin (#475 AK 6). */
  ausgefallenNachtrag: "Der Termin fällt aus. Für ihn lässt sich nicht nachtragen, wer da war.",
  /** Über den Link einer schnuppernden Spieler:in (#555 AK 12). */
  probeVoll: PROBE_TEXT.voll,
} as const;

/** Die Abweisung mit dem aktuellen Stand (#435 AK 4, #437 AK 5) — an
 *  Oberfläche, Link und KI wortgleich. */
export function abweisungText(grund: AbmeldeGrund, stand?: AbmeldeStand): string {
  if (grund === "verlegt" && stand)
    return `Der Termin wurde inzwischen verlegt, neu auf ${datumKurz(stand.datum)} um ${stand.beginn}. Sieh ihn dir noch einmal an.`;
  if (grund === "ausgefallen") return ABMELDUNG_TEXT.ausgefallen;
  if (grund === "begonnen") return ABMELDUNG_TEXT.begonnen;
  if (grund === "gilt_nicht") return ABMELDUNG_TEXT.giltNicht;
  if (grund === "nicht_begonnen") return ABMELDUNG_TEXT.nichtBegonnen;
  if (grund === "nicht_dabei") return ABMELDUNG_TEXT.nichtDabei;
  if (grund === "ist_spiel") return SPIEL_TEXT.istSpiel;
  if (grund === "probe_voll") return ABMELDUNG_TEXT.probeVoll;
  return ABMELDUNG_TEXT.nichtGefunden;
}

/** Eine Spieler:in an einem Termin. `null`-Name: eine ehemalige Spieler:in an
 *  einem vergangenen Termin (#435 PC 4). */
export type Teilnehmer = {
  spielerId: string | null;
  vorname: string | null;
  nachname: string | null;
  abgemeldet: boolean;
  ehemalig: boolean;
  /** Aus dem Team genommen, am begonnenen Termin aber mit Namen und Stand
   *  bei Beginn geblieben (#579 PC 5); das Nachtragen bleibt möglich (AK 18). */
  nichtMehrImTeam: boolean;
  /** Die Kader, über die der Termin für sie gilt (#453 AK 15); leer bei einem Termin für alle. */
  kader: string[];
  /** Wann ihr Status zuletzt zwischen angemeldet und abgemeldet wechselte
   *  (ISO-Zeitpunkt, #467); `null`, wenn sie dort nie gewechselt hat. */
  gewechseltAm: string | null;
  /** Ab Beginn: Ihre Anwesenheit weicht vom Stand bei Beginn ab (#475) —
   *  angemeldet heisst dann nicht erschienen, abgemeldet doch erschienen. */
  nachgetragen: boolean;
  /** Sie schnuppert (#555): zuerst nicht angemeldet. */
  probe: boolean;
};

/** Der Stand einer Spieler:in an einem Termin, samt Nachtrag (#475 AK 8). */
export type TeilnahmeStatus = "angemeldet" | "abgemeldet" | "nicht_erschienen" | "doch_erschienen";

export function teilnahmeStatus(t: { abgemeldet: boolean; nachgetragen: boolean }): TeilnahmeStatus {
  if (t.nachgetragen) return t.abgemeldet ? "doch_erschienen" : "nicht_erschienen";
  return t.abgemeldet ? "abgemeldet" : "angemeldet";
}

/** Was der Schalter am Termin bedeutet: vor Beginn angemeldet, ab Beginn da
 *  — dann trägt er gegen den Stand bei Beginn nach (#475). */
export function statusNachSchalter(t: { abgemeldet: boolean }, an: boolean, abBeginn: boolean): TeilnahmeStatus {
  return abBeginn
    ? teilnahmeStatus({ abgemeldet: t.abgemeldet, nachgetragen: an === t.abgemeldet })
    : teilnahmeStatus({ abgemeldet: !an, nachgetragen: false });
}

/** Anwesend ist, wer angemeldet oder doch erschienen ist (#475 AK 9). */
export function istAnwesend(t: { abgemeldet: boolean; nachgetragen: boolean }): boolean {
  return t.abgemeldet === t.nachgetragen;
}

/** Wie der Stand überall heisst. */
export const TEILNAHME_TEXT: Record<TeilnahmeStatus, string> = {
  angemeldet: "angemeldet",
  abgemeldet: "abgemeldet",
  nicht_erschienen: "angemeldet, nicht erschienen",
  doch_erschienen: "abgemeldet, doch erschienen",
};

/** Wie die Gruppen im Reiter «Spieler:innen» heissen (#599): vor Beginn
 *  eines Trainings angemeldet und abgemeldet, ab Beginn jedes Termins da und
 *  nicht da. Die Gruppen eines Spiels vor dem Anpfiff heissen wie seine
 *  Status (`MELDE_STATUS`). */
export const GRUPPE_TEXT = {
  angemeldet: "Angemeldet",
  abgemeldet: "Abgemeldet",
  da: "Da",
  nichtDa: "Nicht da",
} as const;

/** Wie eine ehemalige Spieler:in überall heisst. */
export const EHEMALIGE_SPIELERIN = "Ehemalige Spieler:in";

/** Das Kennzeichen an einer Zeile eines begonnenen Termins, wenn die
 *  Spieler:in inzwischen aus dem Team genommen wurde (#579 AK 18). */
export const NICHT_MEHR_IM_TEAM = "nicht mehr im Team";

/** Nach Name; ehemalige zuletzt — an Trainings und an Spielen. */
export function nachTeilnehmer<T extends { vorname: string | null; nachname: string | null }>(liste: T[]): T[] {
  const benannt = liste.filter((t) => t.vorname !== null) as (T & { vorname: string; nachname: string })[];
  return [...nachSpielerName(benannt), ...liste.filter((t) => t.vorname === null)];
}

// ── Privater Link (#436) ────────────────────────────────────────────────────

/** Der Pfad der Seite hinter dem privaten Link: `/abmelden/<token>`. */
export const LINK_PFAD = "abmelden";

/** 64 Hex-Zeichen wie das Kalender-Abo — vorab geprüft, bevor die Datenebene fragt. */
export function istLinkToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
}

/** Ein Fehler der Datenebene hinter einem privaten Link — ohne Einzelheiten. */
export const LINK_FEHLER = "Das ging gerade nicht. Versuch es noch einmal.";

/** Die vollständige Adresse des privaten Links. */
export function spielerLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/${LINK_PFAD}/${token}`;
}

/** Was Erneuern für Mitteilungen aufs Mobile heisst (#483 AK 13, PC 3): Sie
 *  enden auf allen Geräten; der neue Link braucht sie neu und, als App, neu
 *  abgelegt. */
export const LINK_ERNEUERN_MITTEILUNGEN =
  "Mitteilungen aufs Mobile enden ebenfalls: Die Spielervertretung schaltet sie mit dem neuen Link neu ein und legt die App neu ab.";

export const LINK_TEXT = {
  /** AK 2: was der Link kann — beim Holen, in der Oberfläche wie beim KI-Assistenten.
   *  Dass er die Termine aller Teams zeigt, sagt `linkTeamsText`: im Link-Dialog
   *  (#583 AK 13) und im Hinweis der KI-Link-Werkzeuge (#589 AK 9). */
  warnung:
    "Wer diesen Link hat, kann diese Spieler:in für Trainings und Spiele ab- und anmelden. Für ein Spiel ist sie erst nach ihrer Meldung angemeldet. Gib ihn nur der Spieler:in selbst oder ihren Eltern.",
  /** Was Erneuern bewirkt (AK 3, PC 3; #583 AK 15): für alle Teams der
   *  Spieler:in; die Benachrichtigungen enden mit (#642 PC 2), ebenso die
   *  Mitteilungen aufs Mobile (#483 AK 13). */
  erneuern: `Erneuern macht den bisherigen Link sofort ungültig, für alle Teams der Spieler:in. Abmeldungen bleiben. Ein Kalender-Abo dieser Spieler:in erlischt damit und ist über den neuen Link neu zu holen. Die bisherigen Benachrichtigungen enden ebenfalls. ${LINK_ERNEUERN_MITTEILUNGEN}`,
  /** AK 10: ein erneuerter, unbekannter oder entfernter Link. */
  ungueltigTitel: "Dieser Link gilt nicht mehr",
  ungueltig: "Den aktuellen erhältst du über eine Abholadresse, bei den Trainer:innen oder bei der Vereinsverwaltung.",
  erneuert: "Link erneuert. Der bisherige gilt nicht mehr.",
  /** Mit eingeschalteter Selbstabholung (#438, #583 AK 15): woher Spieler:in
   *  und Eltern den neuen holen — bei den Teams, die sie eingeschaltet haben. */
  erneuertAbholen: (teams: string[]): string => `Die Spieler:in oder ihre Eltern holen den neuen Link über die Abholadresse von ${aufzaehlung(teams, "oder")} ab.`,
} as const;

// ── Stand des privaten Links (#657) ─────────────────────────────────────────

/** abgeholt: über eine Abholadresse herausgegeben (#438 PC 2; Spalte
 *  `link_bezogen`); zugestellt: Trainer:in, Verwaltung oder KI-Assistent hat
 *  ihn als ausserhalb von KiFu weitergegeben markiert; offen: weder noch. */
export const LINK_STAENDE = ["abgeholt", "zugestellt", "offen"] as const;
export type LinkStand = (typeof LINK_STAENDE)[number];

/** Der Stand aus den zwei Spalten — die einzige Ableitung im Code. Abgeholt
 *  hat Vorrang. SQL-Zwilling: Trigger `spieler_link_zugestellt_fallen` und
 *  `link_zugestellt_kern` (Migration 20261122110000) — Abholen und Erneuern
 *  setzen «zugestellt» zurück, ein abgeholter Link wird nie markiert. */
export function linkStandAus(abgeholt: boolean, zugestellt: boolean): LinkStand {
  if (abgeholt) return "abgeholt";
  return zugestellt ? "zugestellt" : "offen";
}

/** Überall dieselben Wörter (#657 PC 4): in Liste, Dialog, Verein und KI. */
export const LINK_STAND_TEXT = {
  label: { abgeholt: "abgeholt", zugestellt: "zugestellt", offen: "offen" } satisfies Record<LinkStand, string>,
  /** Knopf im Link-Dialog, nur solange der Link nicht abgeholt ist (AK 1, 2). */
  markieren: "Als zugestellt markieren",
  zuruecknehmen: "Zustellung zurücknehmen",
  /** Hinter ⓘ neben dem Knopf. */
  erklaerung:
    "Du hast den Link der Spieler:in oder den Eltern gegeben. Ob sie ihn geöffnet haben, weiss KiFu nicht. Abholen oder Erneuern ändert den Stand.",
  markiert: "Als zugestellt markiert.",
  zurueckgenommen: "Zustellung zurückgenommen.",
  /** Der Link wurde inzwischen abgeholt; nichts geändert. */
  schonAbgeholt: "Der Link wurde inzwischen abgeholt. Eine Zustellung braucht es nicht mehr.",
  /** Ohne Antwort (etwa ohne Netz) ist offen, ob der Stand geändert ist. */
  ohneAntwort: "Keine Antwort erhalten. Ob der Stand geändert ist, zeigt die Liste nach dem Neuladen.",
} as const;

/** Wie viele Links je Stand (#658 AK 1) — über alle Zeilen, die der Aufrufer
 *  gibt; im Reiter «Privater Link» die ganze Spielerliste des Teams samt
 *  Schnuppernden. */
export function zaehleLinkStaende(spieler: readonly { linkStand: LinkStand }[]): Record<LinkStand, number> {
  const zahl: Record<LinkStand, number> = { abgeholt: 0, zugestellt: 0, offen: 0 };
  for (const s of spieler) zahl[s.linkStand]++;
  return zahl;
}

/** Die Übersicht der Link-Stände im Reiter «Privater Link» (#658). */
export const LINK_UEBERSICHT = {
  titel: "Wer hat den Link?",
  einleitung: "Spieler:innen oder Eltern holen ihn selbst ab, oder du gibst ihn weiter und markierst ihn als zugestellt. Schnuppernde zählen mit.",
  /** Neben der Lozenge des Stands: woher der Stand kommt. */
  beschreibung: {
    abgeholt: "selbst über die Abholadresse",
    zugestellt: "als zugestellt markiert",
    offen: "weder abgeholt noch zugestellt",
  } satisfies Record<LinkStand, string>,
  /** AK 2: der Sprung in die Spielerliste, eingegrenzt auf «offen». Kurz,
      weil der Knopf eine feste Höhe hat und nicht umbrechen darf (375px
      mobil, schmale 2fr-Spalte ab lg); den Zusammenhang liefert die Zeile
      «offen» darüber. */
  offeneZeigen: (anzahl: number): string => `Offene zeigen (${anzahl})`,
  hinweis: "Link selbst weitergegeben? Markiere ihn unter «Spieler:innen» im Reiter «Liste» im Link-Dialog der Spieler:in als zugestellt. Erneuern setzt ihn auf offen zurück.",
} as const;

/** Die Filterleiste der Spielerliste eines Teams (#601) — aus denselben
 *  Bausteinen und mit denselben Wörtern wie die Spieler:innen des Vereins
 *  (`SPIELER_FILTER` in lib/verein.ts). */
export const TEAM_SPIELER_FILTER = {
  suche: "Spieler:innen durchsuchen",
  kader: "Kader",
  /** AK 2: «Ohne Kader» steht vor den Kadern des Teams. */
  ohneKader: "Ohne Kader",
  kaderGruppe: "Kader des Teams",
  jahrgang: "Jahrgang",
  link: "Privater Link",
  /** Die Werte des Filters «Privater Link» (AK 4): «zugestellt» und «offen» zusammen sind «nicht abgeholt». */
  linkStand: { abgeholt: "Abgeholt", zugestellt: "Zugestellt", offen: "Offen" } satisfies Record<LinkStand, string>,
  zuruecksetzen: "Zurücksetzen",
  /** AK 7: Keine Spieler:in erfüllt die Eingrenzung. */
  leerTitel: "Keine Spieler:in gefunden",
  leerText: "Ändere die Suche oder die Eingrenzung.",
} as const;

/** Die Zahl im Kopf der Spielerliste (PO 2026-11-22): die ganze Liste, bei
 *  gesetzter Eingrenzung «12 von 35». */
export function teamSpielerAnzahlText(sichtbar: number, gesamt: number, eingegrenzt: boolean): string {
  return eingegrenzt && gesamt > 0 ? `${sichtbar} von ${gesamt}` : String(gesamt);
}

/** Warum «Spieler:in hinzufügen» gesperrt ist (#706 AK 7): Die Spielerliste
 *  des Teams ist voll (`SPIELER_MAX`, Zwilling im Trigger), oder der
 *  Spielerbestand des Vereins. Vom Verein erfährt das Team nur, dass er voll
 *  ist, nie den Bestand — und wer Platz schafft. */
export const SPIELER_SPERRE = {
  team: SPIELER_MELDUNG.SPIELERLISTE_VOLL,
  verein: "Im Verein ist kein Platz für weitere Spieler:innen. Zuerst muss die Vereinsverwaltung Platz schaffen.",
} as const;
export type SpielerSperre = keyof typeof SPIELER_SPERRE;
/** Der Satz mit dem Grund der Sperre, auf den der gesperrte Knopf verweist. */
export const SPIELER_GESPERRT_ID = "spieler-gesperrt";

/** Welche Sperre gilt: zuerst die des Teams, dann die des Vereins. */
export function spielerSperre(anzahlImTeam: number, vereinVoll: boolean): SpielerSperre | null {
  if (anzahlImTeam >= SPIELER_MAX) return "team";
  return vereinVoll ? "verein" : null;
}

/** Für welche Termine eine Spieler:in mit diesen Kadern gilt — ohne Aussage
 *  darüber, was der Link zeigt (#663). In den Dialogen «Spieler:in
 *  hinzufügen» und «Spieler:in ändern». */
export function kaderHinweisText(vorname: string, kaderNamen: string[]): string {
  const wer = vorname.trim() || "Die Spieler:in";
  return kaderNamen.length === 0
    ? `${wer} ist nur bei Terminen ohne Kader dabei.`
    : `${wer} ist bei Terminen ohne Kader und bei den Terminen von ${aufzaehlung(kaderNamen)} dabei.`;
}

/** Die Anzahl über der Spielerliste, der Teilnahme und den Meldezeitpunkten
 *  (#706 AK 6): alle Spieler:innen des Teams samt Schnuppernden, «34
 *  Spieler:innen», bei Eingrenzung «12 von 34 Spieler:innen». */
export function teamSpielerAnzahlZeile(sichtbar: number, gesamt: number, eingegrenzt: boolean): string {
  return `${teamSpielerAnzahlText(sichtbar, gesamt, eingegrenzt)} ${gesamt === 1 ? "Spieler:in" : "Spieler:innen"}`;
}

/** Was der Link-Knopf einer Zeile sagt: Tooltip und Name (AK 4). Offen bleibt
 *  unmarkiert — der Stand fehlt im Text wie der Punkt am Knopf. */
export function linkKnopfText(name: string, stand: LinkStand): { tooltip: string; label: string } {
  if (stand === "offen") return { tooltip: "Privater Link", label: `Privater Link für ${name}` };
  return { tooltip: `Privater Link · ${LINK_STAND_TEXT.label[stand]}`, label: `Privater Link für ${name}, ${LINK_STAND_TEXT.label[stand]}` };
}

/** Ein Team einer Spieler:in, wie der Link-Dialog es liest: der Name und ob
 *  die Selbstabholung dieses Teams eingeschaltet ist (#583). */
export type LinkTeam = { name: string; abholbar: boolean };

/** Der Hinweis im Link-Dialog (#583 AK 13): der Link zeigt die Termine aller
 *  Teams der Spieler:in, in der Folge, in der sie geladen sind (`nachTeamname`). `ausgeschaltet`: Der Dialog gehört einem Team; bei
 *  mehr als einem Team steht dazu, dass dessen ausgeschaltete Selbstabholung
 *  den Link nicht sperrt, wenn ein anderes Team sie eingeschaltet hat.
 *  Ohne Team: `null` (dort steht der Hinweis «ohne Team»). */
export function linkTeamsText(vorname: string, teams: LinkTeam[], ausgeschaltet: boolean): string | null {
  if (teams.length === 0) return null;
  const erster = `Der Link zeigt die Termine aller Teams von ${vorname}: ${aufzaehlung(teams.map((t) => t.name))}.`;
  if (!ausgeschaltet || teams.length < 2) return erster;
  return `${erster} Eine hier ausgeschaltete Selbstabholung sperrt den Link nicht, wenn ein anderes Team von ${vorname} sie eingeschaltet hat.`;
}

/** Was die Bestätigung zum Erneuern sagt (#583 AK 15, 16), Satz für Satz:
 *  wen es trifft, ob Spieler:in und Eltern den neuen Link abholen können. Die Teams in
 *  der geladenen Folge (`nachTeamname`). */
export function linkErneuernSaetze(vorname: string, teams: LinkTeam[]): string[] {
  if (teams.length === 0)
    return [
      "Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden. Abmeldungen bleiben bestehen.",
      LINK_ERNEUERN_MITTEILUNGEN,
      `${vorname} ist keinem Team zugeordnet; gib den neuen Link selbst weiter.`,
    ];
  const abholbar = teams.filter((t) => t.abholbar).map((t) => t.name);
  return [
    `Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden für alle Teams von ${vorname}: ${aufzaehlung(teams.map((t) => t.name))}. Abmeldungen bleiben bestehen.`,
    LINK_ERNEUERN_MITTEILUNGEN,
    abholbar.length > 0
      ? LINK_TEXT.erneuertAbholen(abholbar)
      : "Keines dieser Teams hat die Selbstabholung eingeschaltet. Gib den neuen Link selbst weiter.",
  ];
}

/** Die Teams für die Bestätigung zum Erneuern liessen sich nicht lesen
 *  (etwa ohne Netz): Die Bestätigung schliesst, der Link bleibt, wie er war. */
export const LINK_ERNEUERN_LADEFEHLER = "Die Teams liessen sich nicht laden. Der Link ist nicht erneuert; versuche es noch einmal.";

/** Erneuern bekam keine Antwort (etwa ohne Netz): Ob der Link erneuert ist,
 *  bleibt offen; der Dialog zeigt den bisher geladenen Link weiter. */
export const LINK_ERNEUERN_OHNE_ANTWORT =
  "Keine Antwort beim Erneuern. Vielleicht ist der Link schon erneuert: Schliesse den Dialog und öffne ihn neu, um den aktuellen zu sehen.";

// ── Der private Link über mehrere Teams (#583) ──────────────────────────────

/** Die Teams stehen im Kopf der Seite; jeder Termin trägt sein Team (AK 2, 3). */
export const linkKopfTitel = (name: string) => `Termine für ${name}`;

/** Die Teams haben keine Termine für die Spieler:in (AK 4). */
export const LINK_KEINE_TERMINE_TITEL = "Keine anstehenden Termine";
export const linkKeineTermineText = (vorname: string) => `Die Teams von ${vorname} haben zurzeit keine Termine für ${vorname}.`;

/** Die Spieler:in ist keinem Team zugeordnet (AK 5): eigene Konstante, nicht Teil
 *  von `LINK_TEXT` (der in die KI-Beschreibungen fliesst). */
export const linkOhneTeamEltern = (vorname: string) =>
  `${vorname} ist zurzeit keinem Team zugeordnet. Termine erscheinen hier, sobald ${vorname} einem Team zugeordnet ist. Bei Fragen hilft die Vereinsverwaltung.`;

// ── Die Infos am privaten Link (#598 AK 10) ──────────────────────────────────
// Alle Erklärungen an einem Ort hinter dem ⓘ, eigene Konstanten (nicht Teil
// von `LINK_TEXT`, der in die KI-Beschreibungen fliesst).

export const LINK_INFOS = {
  titel: "Infos",
  /** Das ⓘ neben dem Namen. */
  knopf: "Infos und Erklärungen",
  zurueck: "Zurück zu den Terminen",
  angaben: "Wer deine Angaben sieht",
} as const;

export const linkMeldenTitel = (vorname: string) => `So meldest du ${vorname}`;

/** Wie man meldet (bis #598 offen im Kopf der Seite). */
export const linkMeldenText = (name: string, vorname: string) =>
  `${name} ist für jedes Training zuerst angemeldet. Kann ${vorname} nicht, melde ab - und bis zum Beginn wieder an. Für ein Spiel ist ${vorname} erst angemeldet, wenn du anmeldest.`;

export const linkSchnuppernTitel = (vorname: string) => `So schnuppert ${vorname}`;

/** Eine Meldung traf einen Termin, der nicht mehr für die Spieler:in gilt (AK 7):
 *  sie bleibt stehen, auch wenn die neu geladene Liste den Termin nicht mehr zeigt. */
export const LINK_GILT_NICHT_TITEL = "Nicht gespeichert";
export function linkGiltNichtText(art: "training" | "spiel", datum: string, vorname: string): string {
  const was = art === "spiel" ? "Das Spiel" : "Das Training";
  return `${was} vom ${tagOhneJahr(datum)} gilt nicht mehr für ${vorname}. Die Liste zeigt jetzt die aktuellen Termine.`;
}

/** Wohin mit Dringendem in «Fragen und Feedback» am Link (#544 AK 7, #583 AK 19,
 *  #587 PC 2): die Antwort kommt nie über KiFu; ohne Team ist die
 *  Vereinsverwaltung des Vereins die Stelle — mit seinem Namen. */
export const feedbackDringend = (ohneTeam: boolean, verein: string) =>
  `Bei Dringendem, etwa einer kurzfristigen Absage, wende dich ${ohneTeam ? `an die Vereinsverwaltung von «${verein}»` : "direkt an die Trainer:innen des Teams"}.`;

// ── Am Link eingrenzen (#596) ────────────────────────────────────────────────

/** Die Arten, auf die sich die Liste am Link eingrenzen lässt: Chip,
 *  Leerzustand und die Ansage nach dem Wechsel aus einer Quelle. */
export const LINK_EINGRENZUNG = {
  training: { chip: "Trainings", leer: "Keine anstehenden Trainings", eins: "Training", viele: "Trainings" },
  spiel: { chip: "Spiele", leer: "Keine anstehenden Spiele", eins: "Spiel", viele: "Spiele" },
} as const;

/** Der Weg zurück aus einer leeren Eingrenzung — ohne «Tippe», der Link
 *  wird auch am Rechner geöffnet. */
export function linkEingrenzungLeer(art: keyof typeof LINK_EINGRENZUNG): string {
  return `Hebe die Auswahl «${LINK_EINGRENZUNG[art].chip}» auf, um alle Termine zu sehen.`;
}

/** Was eine Sprachausgabe nach dem Wechsel sagt (#596): wie viele Termine
 *  der gewählten Art jetzt stehen. */
export function linkEingrenzungStand(art: keyof typeof LINK_EINGRENZUNG, n: number): string {
  const e = LINK_EINGRENZUNG[art];
  return n === 0 ? e.leer : `${n} ${n === 1 ? e.eins : e.viele}`;
}

// ── Verlegen lässt Abmeldungen verfallen (#437) ─────────────────────────────

/** Was beim Verlegen mit den Abmeldungen geschieht (AK 1) — vor dem
 *  Speichern. Wird ein begonnener Termin wieder offen, verfallen auch seine
 *  Nachträge (#475 AK 12). */
export function verfallText(n: number, nachtraege = 0): string {
  const abmeldungen =
    n === 0
      ? null
      : n === 1
        ? "Damit verfällt 1 Abmeldung: Die Spieler:in gilt wieder als angemeldet."
        : `Damit verfallen ${n} Abmeldungen: Diese Spieler:innen gelten wieder als angemeldet.`;
  // Ohne Abmeldungen sind es nur Nicht-Erschienene (Doch-Erschienene waren
  // abgemeldet): Auch sie gelten wieder als angemeldet.
  const nachtrag =
    nachtraege === 0
      ? null
      : n > 0
        ? `Damit ${nachtraege === 1 ? "verfällt auch 1 Nachtrag" : `verfallen auch ${nachtraege} Nachträge`} zur Anwesenheit.`
        : nachtraege === 1
          ? "Damit verfällt 1 Nachtrag zur Anwesenheit: Die Spieler:in gilt wieder als angemeldet."
          : `Damit verfallen ${nachtraege} Nachträge zur Anwesenheit: Diese Spieler:innen gelten wieder als angemeldet.`;
  return [abmeldungen, nachtrag].filter(Boolean).join(" ");
}

/** Was beim Verlegen mit den Absagen der Trainer:innen geschieht (#520 AK 11,
 *  PC 2, 3) — als Satz an `text` (das, was mit den Spieler:innen geschieht)
 *  gehängt; steht davor nichts, beginnt er mit «Damit». */
export function mitAbsagen(text: string, n: number): string {
  if (n === 0) return text;
  const satz =
    n === 1
      ? "verfällt 1 Absage einer Trainer:in: Sie gilt wieder als dabei."
      : `verfallen ${n} Absagen von Trainer:innen: Sie gelten wieder als dabei.`;
  return text ? `${text} Ausserdem ${satz}` : `Damit ${satz}`;
}

/** Was mit den Anmeldungen von schnuppernden Spieler:innen geschieht (#555 AK 14,
 *  PC 5) — als Satz an `text` gehängt wie `mitAbsagen`. */
export function mitAnmeldungen(text: string, n: number): string {
  if (n === 0) return text;
  const satz =
    n === 1
      ? "verfällt 1 Anmeldung einer schnuppernden Spieler:in: Sie gilt wieder als nicht angemeldet."
      : `verfallen ${n} Anmeldungen von schnuppernden Spieler:innen: Sie gelten wieder als nicht angemeldet.`;
  return text ? `${text} Ausserdem ${satz}` : `Damit ${satz}`;
}

/** Dasselbe in der Rückfrage der Oberfläche, mit dem Weg danach. */
export function verfallDialogText(n: number, nachtraege = 0, absagen = 0, anmeldungen = 0): string {
  const text = n > 0 ? `${verfallText(n, nachtraege)} Wer am neuen Zeitpunkt nicht kann, meldet sich neu ab.` : verfallText(n, nachtraege);
  return mitAnmeldungen(mitAbsagen(text, absagen), anmeldungen);
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung. */
export function verfallBestaetigen(n: number, nachtraege = 0, absagen = 0, anmeldungen = 0): string {
  const text = mitAnmeldungen(mitAbsagen(verfallText(n, nachtraege), absagen), anmeldungen);
  return `${text} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}

/** Am privaten Link: Der Termin wurde verlegt, seit sie abgemeldet — bzw. als
 *  schnuppernde Spieler:in angemeldet (#555 PC 5) — wurde (AK 2). */
export function verfallenHinweis(vorher: { datum: string; beginn: string; anmeldung?: boolean }): string {
  return `Verlegt, vorher ${tagOhneJahr(vorher.datum)} um ${vorher.beginn}. Deine ${vorher.anmeldung ? "Anmeldung" : "Abmeldung"} gilt nicht mehr.`;
}

// ── Selbstabholung (#438) ───────────────────────────────────────────────────

/** Der Pfad der Abholseite: `/abholen/<token>`. */
export const ABHOL_PFAD = "abholen";

/** Die vollständige Abholadresse eines Teams. */
export function abholUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/${ABHOL_PFAD}/${token}`;
}

/** Fehlversuche bis zur Sperre und ihre Dauer (AK 15) — Zwilling in
 *  `abholung_abholen` (Migration selbstabholung). */
export const ABHOL_VERSUCHE = 5;
export const ABHOL_SPERRE_MINUTEN = 15;

/** Wer für die Angaben einer Spieler:in verantwortlich ist und wer sie sieht
 *  (Story #580 PC 4, #587 PC 2) — eine Quelle für die Abholseite (ohne Namen,
 *  oder mit dem der abgeholten Spieler:in) und den privaten Link (mit dem
 *  Vornamen). Der Satz «Verantwortlich …» steht im selben Textblock wie «wer
 *  die Angaben sieht»: Der Verein ist die Stelle, an die sich Spieler:innen und Eltern wenden.
 *  Keine eigene Konstante in `LINK_TEXT`: Die fliesst in die KI-Beschreibungen. */
export function angabenSehenText(verein: string, vorname?: string): string {
  return `Verantwortlich für die Daten ${vorname ? `von ${vorname} ` : ""}ist der Verein «${verein}». Name, Jahrgang und Teams ${vorname ? `von ${vorname}` : "der Spieler:in"} sehen alle Trainer:innen des Vereins, alle Angaben die Trainer:innen ihrer Teams, J+S-Nummer und Link auch die Vereinsverwaltung, dazu die KI-Assistenten, die diese Personen verbunden haben, und wer den Link hat.`;
}

export const ABHOLUNG_TEXT = {
  /** AK 3, 5: was die Adresse kann und was Ausschalten bewirkt. */
  beschreibung:
    "Über diese Adresse holen Spieler:innen oder ihre Eltern den privaten Link mit Vorname, Nachname und Jahrgang selbst ab. Der Link zeigt die Termine aller Teams der Spieler:in. Wer die Abholadresse hat und die Angaben der Spieler:in kennt, kann die Spieler:in ab- und anmelden; teile sie nur teamintern. Ausschalten stoppt neue Abholungen, abgeholte Spieler:innen-Links gelten weiter.",
  aus: "Ausgeschaltet. Spieler:innen und Eltern erhalten den Link von diesem Team nur von euch. Der Link zeigt die Termine aller Teams der Spieler:in; ausgeschaltet sperrt die Selbstabholung ihn nicht, wenn ein anderes Team der Spieler:in sie eingeschaltet hat. Beim Einschalten gilt die bisherige Abholadresse wieder.",
  /** AK 4, 5: vor dem Erneuern. */
  erneuern:
    "Die bisherige Adresse gilt danach nie mehr, auch nicht dort, wo ihr sie geteilt habt. Links, die Spieler:innen oder Eltern schon abgeholt haben, gelten weiter. Teile danach die neue Adresse im Chat mit Spieler:innen und Eltern.",
  eingeschaltet: "Selbstabholung eingeschaltet.",
  ausgeschaltet: "Selbstabholung ausgeschaltet. Abgeholte Links gelten weiter.",
  erneuert: "Abholadresse erneuert. Teile die neue im Chat mit Spieler:innen und Eltern.",
  // ── Die Abholseite ──
  titel: "Spieler:in-Link abholen",
  einleitung:
    "Gib Vorname, Nachname und Jahrgang der Spieler:in ein. Du erhältst den privaten Link, mit dem du die Spieler:in für Trainings und Spiele ab- und anmelden kannst.",
  /** AK 7: was KiFu speichert, wer es sieht, wann es verschwindet. */
  speichertTitel: "Was KiFu speichert",
  /** AK 13, 14: immer derselbe Satz. */
  passtNicht: "Dazu finden wir keinen Link. Prüf die Schreibweise oder frag beim Team nach.",
  /** AK 16. */
  gesperrtTitel: "Zu viele Versuche",
  gesperrt: `Du kannst in ${ABHOL_SPERRE_MINUTEN} Minuten wieder eingeben. Passt es dann immer noch nicht, frag beim Team nach.`,
  fehlt: "Bitte Vorname, Nachname und den Jahrgang als vierstellige Jahreszahl eingeben.",
  /** AK 17. */
  ungueltigTitel: "Diese Abholadresse gilt nicht",
  ungueltig: "Frag deine Trainerin oder deinen Trainer nach der aktuellen Abholadresse oder direkt nach dem Link der Spieler:in.",
} as const;

/** AK 7, #587 PC 2: was KiFu speichert, wer dafür verantwortlich ist, wer es
 *  sieht, wann es verschwindet — auf dem Eingabe-Bildschirm der Abholseite.
 *  #642 AK 5: dazu die Benachrichtigungen und wie lange sie bleiben. */
/** #483 PC 6: was KiFu zu eingeschalteten Mitteilungen aufs Mobile speichert
 *  und wann es verschwindet. */
export const ABHOL_MITTEILUNGEN =
  "Schaltet jemand Mitteilungen aufs Mobile ein, speichert KiFu je Gerät eine Adresse des Mitteilungsdiensts des Geräteherstellers, ohne Telefonnummer und E-Mail-Adresse; die Trainer:innen ihrer Teams und ihre KI-Assistenten sehen nur, ob mindestens ein Gerät eingeschaltet ist. Die Adresse verschwindet beim Ausschalten, wenn das Gerät keine Mitteilungen mehr annimmt, mit einem neuen Link oder wenn die Spieler:in aus dem Verein gelöscht wird.";

export function abholSpeichertText(verein: string): string {
  return `Zu jeder Spieler:in nur Vorname, Nachname, Jahrgang, falls eingetragen die J+S-Nummer, Abmeldungen, An- und Abmeldungen zu Spielen und ob sie für ein Spiel nicht aufgeboten ist. Benachrichtigungen zu ihren Terminen bewahrt KiFu ${BENACHRICHTIGUNG_TAGE} Tage auf; sie sieht nur, wer den Link hat. ${ABHOL_MITTEILUNGEN} ${angabenSehenText(verein)} Wann sich eine Spieler:in zuletzt ab- oder wieder angemeldet hat, sehen nur die Trainer:innen ihrer Teams und ihre KI-Assistenten. Nimmt ein Team eine Spieler:in heraus, bleiben ihre Angaben im Verein; sie verschwinden erst, wenn die Vereinsverwaltung die Spieler:in aus dem Verein löscht.`;
}

/** AK 10: wozu der Link dient, dass er privat ist, und wo es ihn wieder gibt;
 *  #587 PC 2: wer für die Daten verantwortlich ist, auch auf dem
 *  Erhalt-Bildschirm. */
export function abholErhaltText(name: string, verein: string): { wozu: string; teams: string; privat: string; daten: string } {
  return {
    daten: `${angabenSehenText(verein, name)} Nimmt ein Team ${name} heraus, bleiben die Angaben im Verein; sie verschwinden erst, wenn die Vereinsverwaltung sie aus dem Verein löscht.`,
    wozu: `Mit diesem Link meldest du ${name} für Trainings ab und wieder an und für Spiele an oder ab, ohne Konto. Speichere ihn am besten als Lesezeichen.`,
    // Über jedes Team mit Selbstabholung führt die Abholung zum selben Link; die Teams nennt die Seite nicht (#583 AK 12).
    teams: `Der Link zeigt die Termine aller Teams von ${name}.`,
    privat: `Der Link ist privat. Wer ihn hat, kann ${name} ab- und anmelden. Geht er verloren, holst du ihn hier wieder ab.`,
  };
}
