import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { bereinigeName, jahrgangAus, linkStandAus, nachSpielerName, nachTeamname, spielerProblem, SPIELER_MELDUNG, type LinkStand, type SpielerEingabe } from "@/lib/spieler";
import {
  IMPORT_TEXT,
  IMPORT_ZEILEN_MAX,
  ausgangAus,
  importErwartetForm,
  importZeilenForm,
  importZeilenStimmen,
  jsAus,
  vorschauAus,
  type ImportAusgang,
  type ImportEintrag,
  type ImportErwartet,
  type ImportVorschau,
} from "@/lib/spieler-import";
import { teamNameProblem } from "@/lib/team";
import {
  PERSON_MELDUNG,
  type PersonSchritt,
  KONTO_LOESCHEN_TEXT,
  VEREIN_MELDUNG,
  VEREIN_NAME_UNGUELTIG,
  VEREIN_TEAM_NICHT_GEFUNDEN,
  VEREIN_UNSTIMMIG,
  teamnameVergebenText,
  spielerAendernAbgewiesenText,
  spielerErfassenAbgewiesenText,
  vereinsNameProblem,
  zuordnenAbweisungText,
  type SpielerDoppeltImVerein,
  type ZuordnenAbweisung,
} from "@/lib/verein";
import {
  gruendungAus,
  kontoInfoAus,
  vereinbarungAus,
  kontoLoeschAusgangAus,
  vereinLoeschAusgangAus,
  type KontoLoeschAusgang,
  type KontoLoeschInfo,
  type VereinLoeschAusgang,
  type VereinVereinbarung,
} from "@/lib/verein-antwort";
import { MELDUNG_WIEDERHOLEN, NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";
import { argumente, eingabeFehler, spielerFehler } from "@/lib/kern/spieler";

/** Ein Fehler der `verein_*`-RPCs: «Verein nicht gefunden» ordnet nur dieser
 *  Bereich ein, alles übrige `spielerFehler`. */
function vereinFehler(e: { message: string; code?: string }) {
  return e.message.includes("VEREIN_NICHT_GEFUNDEN")
    ? fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" })
    : spielerFehler(e);
}

/** Dasselbe für die Team-adressierten `verein_*`-RPCs: Kein Recht und ein
 *  inzwischen aufgelöstes Team sind ununterscheidbar (`VEREIN_NICHT_GEFUNDEN`);
 *  dort heisst es `VEREIN_TEAM_NICHT_GEFUNDEN` am Feld `team_id`. */
function teamFehler(e: { message: string; code?: string }) {
  return e.message.includes("VEREIN_NICHT_GEFUNDEN") ? teamNichtGefunden() : spielerFehler(e);
}

/**
 * Der Spielerbestand des Vereins am Verein-Ort (Epic Vereine #575, Story
 * #579, #580): die Liste für alle Mitglieder (die Verwaltung mit mehr
 * Angaben) und das Zuordnen zu einem Team — nur in der Anwendung, das
 * Zuordnen nur für die Vereinsverwaltung. Es gibt dafür kein KI-Werkzeug
 * (Architekturplan §4.1, §5.5); der Kern steht hier, damit Seite und Action
 * dieselbe Regelquelle nutzen.
 *
 * Geschrieben und gelesen wird nur über die RPCs `verein_*`: Sie prüfen die
 * Rolle als erste Anweisung und rufen `nur_in_der_anwendung()` auf.
 */

/** Eine Spieler:in, wie jedes Vereinsmitglied sie sieht (Story #580 AK 3):
 *  nur diese vier Angaben, auch bei Spieler:innen der eigenen Teams. */
export type VereinSpielerMitglied = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  /** Die Teams der Spieler:in, nach Namen; leer, wenn sie keinem zugeordnet ist. */
  teams: { id: string; name: string }[];
};

/** Dieselbe Spieler:in für die Vereinsverwaltung: dazu J+S-Nummer, Stand des
 *  privaten Links und Schnuppern. Für Mitglieder liefert die Datenebene diese
 *  Schlüssel gar nicht, sie fehlen dort ganz. */
export type VereinSpieler = VereinSpielerMitglied & {
  /** Die J+S-Nummer; `null`, wenn keine erfasst ist. */
  js: string | null;
  /** Stand des aktuellen privaten Links (Spalte «Privater Link», #657). */
  linkStand: LinkStand;
  /** Wo und wie weit sie schnuppert (#584); `anzahl`: die vom Team festgelegte
   *  Zahl, `null` ohne; `besucht`: gezählt wie am Team-Ort. */
  schnuppern: { teamId: string; anzahl: number | null; besucht: number } | null;
};

/** Ein Team des Vereins, wie jedes Mitglied es sieht. */
export type VereinTeamMitglied = { id: string; name: string };

/** Dasselbe Team für die Verwaltung; `anzahl`: Zuordnungen, gezählt wie die Grenze 100. */
export type VereinTeam = VereinTeamMitglied & { anzahl: number };

/** Die Antwort der Datenebene: `spieler` mit Suche und Eingrenzung, alles
 *  übrige ungefiltert — die Optionen der Filter und die Zahlen im Kopf
 *  ändern sich nicht mit ihnen. `verwaltung` sagt die Datenebene selbst (die
 *  eigene Rolle der aufrufenden Person); an ihm hängt die Form der Zeilen und
 *  Teams, und die Seite wählt an ihm die Sicht — eine Quelle, auch bei 0
 *  Treffern und 0 Teams. */
type VereinSpielerliste = {
  /** Alle vorkommenden Jahrgänge des Vereins, aufsteigend. */
  jahrgaenge: number[];
  /** Alle Spieler:innen des Vereins und davon die ohne Team. */
  gesamt: number;
  ohneTeam: number;
} & (
  | { verwaltung: true; spieler: VereinSpieler[]; teams: VereinTeam[] }
  | { verwaltung: false; spieler: VereinSpielerMitglied[]; teams: VereinTeamMitglied[] }
);

const nachName = (a: { name: string }, b: { name: string }) => nachTeamname(a.name, b.name);

type SpielerRoh = VereinSpielerMitglied & {
  js?: string | null;
  /** abgeholt; der Schlüssel heisst bis N1 wie die Spalte. */
  link_bezogen?: boolean;
  /** Bis N1 optional (altes Schema ohne ihn im Fenster); dann in
   *  VERWALTUNGS_SCHLUESSEL. */
  link_zugestellt?: boolean;
  schnuppern?: { team_id: string; anzahl: number | null; besucht: number } | null;
};

/** Die drei Schlüssel, die nur die Verwaltung bekommt. */
const VERWALTUNGS_SCHLUESSEL = ["js", "link_bezogen", "schnuppern"] as const;

/** Passt die Form nicht zur Rolle, die die Datenebene nennt, ist das ein
 *  Fehler, keine leere Liste und keine andere Sicht. */
const LISTE_UNSTIMMIG = "Die Spieler:innen liessen sich gerade nicht lesen. Bitte versuche es noch einmal.";

/**
 * Die Spieler:innen des Vereins mit Suche und Eingrenzung (Story #580): Die
 * Datenebene sucht und grenzt über den ganzen Verein ein, nichts gekappt.
 * Die Reihenfolge (AK 1: Vorname, dann Nachname) legt allein dieser Kern
 * fest, mit derselben deutschen Ordnung wie die Spielerliste eines Teams
 * (`nachSpielerName`) — unabhängig von der Collation der Datenbank. Bei
 * gleichem Vor- und Nachnamen bleibt die Folge der Datenebene stehen
 * (Jahrgang, dann Kennung; `sort` ist stabil). Weil die Daten ganz kommen,
 * stört das weder Suche noch Anzeige in Schritten. `suche`: Teil von
 * «Vorname Nachname», ohne Gross-/Kleinschreibung und Akzente. `teamIds` und
 * `ohneTeam` gelten zusammen als ODER, `jahrgaenge` ebenso; Suche und beide
 * Eingrenzungen als UND. Unbekannte Teams treffen nie. Jede Zeile nennt
 * weiter alle Teams der Spieler:in. Die Form der Antwort entscheidet allein
 * `verwaltung` aus der Datenebene; trägt eine Zeile oder ein Team eine
 * andere Form, ist das ein technischer Fehler (nie eine leere Liste).
 */
export async function ladeVereinSpielerliste(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; suche?: string; teamIds?: string[]; ohneTeam?: boolean; jahrgaenge?: number[] },
): Promise<KernErgebnis<VereinSpielerliste>> {
  if (!istUuid(e.vereinId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });
  const { data, error } = await supabase.rpc("verein_spielerliste", {
    p_verein: e.vereinId,
    // Die Datenebene bereinigt selbst (NFC, Leerraum); nur Leeres heisst null.
    p_suche: e.suche || null,
    p_teams: e.teamIds?.length ? e.teamIds : null,
    p_ohne_team: e.ohneTeam ?? false,
    p_jahrgaenge: e.jahrgaenge?.length ? e.jahrgaenge : null,
  });
  if (error) return vereinFehler(error);
  const r = data as {
    spieler: SpielerRoh[];
    teams: (VereinTeamMitglied & { anzahl?: number })[];
    jahrgaenge: number[];
    gesamt: number;
    ohne_team: number;
    verwaltung: boolean;
  };
  // Die Form folgt der Rolle, die die Datenebene nennt: Die Verwaltung hat je
  // Zeile alle drei Zusatzangaben und je Team die Zahl, ein Mitglied keine davon.
  const zusatz = (s: SpielerRoh) => VERWALTUNGS_SCHLUESSEL.filter((k) => k in s).length;
  const passt =
    typeof r.verwaltung === "boolean" &&
    (r.verwaltung
      ? r.spieler.every((s) => zusatz(s) === VERWALTUNGS_SCHLUESSEL.length) && r.teams.every((t) => "anzahl" in t)
      : r.spieler.every((s) => zusatz(s) === 0) && r.teams.every((t) => !("anzahl" in t)));
  if (!passt) return fehlschlag("technisch", LISTE_UNSTIMMIG, { wiederholbar: true });

  const basis = { jahrgaenge: r.jahrgaenge, gesamt: r.gesamt, ohneTeam: r.ohne_team };
  const zeilen = nachSpielerName(r.spieler);
  const mitglied = (s: SpielerRoh): VereinSpielerMitglied => ({
    id: s.id,
    vorname: s.vorname,
    nachname: s.nachname,
    jahrgang: s.jahrgang,
    teams: s.teams.map((t) => ({ id: t.id, name: t.name })).sort(nachName),
  });
  const teams = [...r.teams].sort(nachName);
  if (!r.verwaltung)
    return ok({ ...basis, verwaltung: false, spieler: zeilen.map(mitglied), teams: teams.map((t) => ({ id: t.id, name: t.name })) });
  return ok({
    ...basis,
    verwaltung: true,
    spieler: zeilen.map((s) => ({
      ...mitglied(s),
      js: s.js ?? null,
      linkStand: linkStandAus(s.link_bezogen === true, s.link_zugestellt === true),
      schnuppern: s.schnuppern ? { teamId: s.schnuppern.team_id, anzahl: s.schnuppern.anzahl, besucht: s.schnuppern.besucht } : null,
    })),
    // `anzahl` steht bei jedem Team der Verwaltung (oben geprüft).
    teams: teams.map((t) => ({ id: t.id, name: t.name, anzahl: t.anzahl as number })),
  });
}

/**
 * Eine oder mehrere Spieler:innen einem Team des Vereins zuordnen (#579 AK
 * 2–8, 20–23): alles oder nichts. Lässt sich eine nicht zuordnen, ändert die
 * Datenebene nichts und nennt die Befunde, die hier in einen Satz gehen
 * (`zuordnenAbweisungText`); `teamName` ist der Name, den die Verwaltung
 * gewählt hat — er steht nur im Satz. `ersetzt`: Zahl der anstehenden
 * Termine, deren erwartete Spielerzahl wegfiel (nur beim ersten Zuordnen in
 * ein Team ohne Spieler:innen, AK 23). `schnuppern` (#584 AK 8–11): nur für
 * eine einzelne Spieler:in ohne Team; die Zählung beginnt mit der Zuordnung.
 * Abweisungen und die Marker `SCHNUPPERN_NUR_EINZELN` bzw. `SPIELER_SCHNUPPERT`
 * kommen als Satz an.
 */
export async function ordneSpielerZu(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; teamName: string; spielerIds: string[]; schnuppern?: boolean },
): Promise<KernErgebnis<{ anzahl: number; ersetzt: number }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const ids = [...new Set(e.spielerIds)];
  if (ids.length === 0 || !ids.every(istUuid))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_ids" });
  const { data, error } = await supabase.rpc("verein_spieler_zuordnen", {
    p_team: e.teamId,
    p_spieler: ids,
    p_schnuppern: e.schnuppern === true,
  });
  if (error) return teamFehler(error);
  const r = data as { status: "zugeordnet"; anzahl: number; ersetzt: number } | ({ status: "abgewiesen" } & ZuordnenAbweisung);
  if (r.status === "abgewiesen") return fehlschlag("regel", zuordnenAbweisungText(r, e.teamName, ids.length), { feld: "spieler_ids" });
  return ok({ anzahl: r.anzahl, ersetzt: r.ersetzt });
}

// ── Vereinsverwaltung: Ansichten, Teams, Personen (Story #581) ──────────────
//
// Wie oben: nur über `verein_*`-RPCs, nur für die Verwaltung (Ausnahmen:
// `verein_ansicht` für alle Mitglieder, mit weniger Feldern), nur in der
// Anwendung — kein KI-Werkzeug ruft diese Funktionen (Wächter in `check:kern`).

/** Eine Person der Vereinsverwaltung. `userId` und `email` nur, wenn die
 *  Leserin selbst zur Verwaltung gehört; `anzeigeName` ist `null` ohne
 *  Anzeigenamen. */
export type VerwaltungPerson = { anzeigeName: string | null; ich: boolean; userId?: string; email?: string };

/** Eine Trainer:in eines Teams, wie die Verwaltung sie sieht. */
export type TeamTrainer = { userId: string; anzeigeName: string; email: string; istVerwaltung: boolean };

/** Ein Team in der Vereinsansicht. Die Felder nach `istMitglied` stehen nur
 *  für die Verwaltung (`spielerZahl`: gezählt wie die Grenze 100, samt
 *  Schnuppernden; `ohneMitglied`: keine Trainer:in). */
export type VereinTeamZeile = {
  id: string;
  name: string;
  istMitglied: boolean;
  trainer?: TeamTrainer[];
  spielerZahl?: number;
  ohneMitglied?: boolean;
};

/** `spielerZahl`: alle Spieler:innen des Vereins, gezählt wie die Grenze 1000;
 *  `spielerOhneTeam`: davon ohne Team; `personen`: verschiedene Konten in
 *  Verwaltung und Teams (was das Löschen des Vereins zu Konten ohne Verein
 *  macht, #587). Alle drei nur für die Verwaltung. */
export type VereinAnsicht = {
  name: string;
  verwaltung: VerwaltungPerson[];
  teams: VereinTeamZeile[];
  spielerZahl?: number;
  spielerOhneTeam?: number;
  personen?: number;
};

/** Eine Trainer:in in der Teamansicht der Verwaltung. */
export type VereinTeamTrainer = TeamTrainer & { ich: boolean };

/** Eine Spieler:in in der Teamansicht: `teams` sind alle ihre Teams (samt
 *  diesem), `schnuppern` gilt für dieses Team (#584: `anzahl` die festgelegte
 *  Zahl oder `null`, `besucht` die Zählung). Nie J+S-Nummer oder Link. */
export type VereinTeamSpieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  schnuppern: { anzahl: number | null; besucht: number } | null;
  teams: { id: string; name: string }[];
};

/** Was mit dem Team beim Auflösen verschwindet. */
export type AufloesungsFolgen = { trainings: number; termine: number; spiele: number; kader: number };

export type VereinTeamAnsicht = {
  id: string;
  name: string;
  spielerZahl: number;
  ichMitglied: boolean;
  trainer: VereinTeamTrainer[];
  spieler: VereinTeamSpieler[];
  aufloesung: AufloesungsFolgen;
};

type TrainerRoh = { user_id: string; anzeige_name: string; email: string; ist_verwaltung: boolean; ich?: boolean };
type VerwaltungRoh = { anzeige_name: string | null; ich: boolean; user_id?: string; email?: string };
type TeamRoh = {
  id: string;
  name: string;
  ist_mitglied: boolean;
  trainer?: TrainerRoh[];
  spieler_zahl?: number;
  ohne_mitglied?: boolean;
};

const trainerAus = (t: TrainerRoh): TeamTrainer => ({
  userId: t.user_id,
  anzeigeName: t.anzeige_name,
  email: t.email,
  istVerwaltung: t.ist_verwaltung,
});

const teamNichtGefunden = () => fehlschlag("nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN, { feld: "team_id" });
const vereinNichtGefunden = () => fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });

/** Die Vereinsansicht: Name, Verwaltung und Teams. Jedes Mitglied darf sie
 *  lesen; E-Mails, Trainer:innen und Spielerzahlen sieht nur die Verwaltung
 *  (die Datenebene lässt sie sonst weg). */
export async function ladeVereinAnsicht(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string },
): Promise<KernErgebnis<VereinAnsicht>> {
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const { data, error } = await supabase.rpc("verein_ansicht", { p_verein: e.vereinId });
  if (error) return vereinFehler(error);
  const r = data as {
    name: string;
    verwaltung: VerwaltungRoh[];
    teams: TeamRoh[];
    spieler_zahl?: number;
    spieler_ohne_team?: number;
    personen?: number;
  };
  return ok({
    name: r.name,
    ...(r.personen !== undefined ? { personen: r.personen } : {}),
    ...(r.spieler_zahl !== undefined ? { spielerZahl: r.spieler_zahl } : {}),
    ...(r.spieler_ohne_team !== undefined ? { spielerOhneTeam: r.spieler_ohne_team } : {}),
    verwaltung: r.verwaltung.map((v) => ({
      anzeigeName: v.anzeige_name,
      ich: v.ich,
      ...(v.user_id !== undefined ? { userId: v.user_id, email: v.email } : {}),
    })),
    teams: r.teams.map((t) => ({
      id: t.id,
      name: t.name,
      istMitglied: t.ist_mitglied,
      ...(t.trainer ? { trainer: t.trainer.map(trainerAus) } : {}),
      ...(t.spieler_zahl !== undefined ? { spielerZahl: t.spieler_zahl } : {}),
      ...(t.ohne_mitglied !== undefined ? { ohneMitglied: t.ohne_mitglied } : {}),
    })),
  });
}

/** Ein Team aus Sicht der Verwaltung (`/verein/team/[teamId]`). Kein Recht
 *  oder ein aufgelöstes Team: «nicht gefunden». */
export async function ladeVereinTeamAnsicht(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<VereinTeamAnsicht>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const { data, error } = await supabase.rpc("verein_team_ansicht", { p_team: e.teamId });
  if (error) return teamFehler(error);
  const r = data as {
    id: string;
    name: string;
    spieler_zahl: number;
    ich_mitglied: boolean;
    trainer: TrainerRoh[];
    spieler: {
      id: string;
      vorname: string;
      nachname: string;
      jahrgang: number;
      schnuppern: { anzahl: number | null; besucht: number } | null;
      teams: { id: string; name: string }[];
    }[];
    aufloesung: AufloesungsFolgen;
  };
  return ok({
    id: r.id,
    name: r.name,
    spielerZahl: r.spieler_zahl,
    ichMitglied: r.ich_mitglied,
    trainer: r.trainer.map((t) => ({ ...trainerAus(t), ich: !!t.ich })),
    spieler: nachSpielerName(r.spieler).map((s) => ({ ...s, teams: [...s.teams].sort(nachName) })),
    aufloesung: r.aufloesung,
  });
}

/** Die Abweisung «Name vergeben» als Satz am Feld `name`. */
const nameVergeben = (team: string) => fehlschlag("regel", teamnameVergebenText(team), { feld: "name" });

/** Ein Team anlegen — die Verwaltung wird dabei nicht Trainer:in. Ein
 *  vergebener Name nennt das Team, das ihn trägt (#581 AK 21). */
export async function legeTeamAn(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; name: string },
): Promise<KernErgebnis<{ teamId: string; name: string }>> {
  const problem = teamNameProblem(e.name);
  if (problem) return fehlschlag("eingabe", problem, { feld: "name" });
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const name = e.name.trim();
  const { data, error } = await supabase.rpc("verein_team_anlegen", { p_verein: e.vereinId, p_name: name });
  if (error) return vereinFehler(error);
  const r = data as { status: "angelegt"; id: string } | { status: "abgewiesen"; grund: "name_vergeben"; team: string };
  if (r.status === "abgewiesen") return nameVergeben(r.team);
  return ok({ teamId: r.id, name });
}

/** Ein Team umbenennen (nur die Verwaltung). */
export async function benenneTeamUm(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; name: string },
): Promise<KernErgebnis<{ name: string }>> {
  const problem = teamNameProblem(e.name);
  if (problem) return fehlschlag("eingabe", problem, { feld: "name" });
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const { data, error } = await supabase.rpc("verein_team_umbenennen", { p_team: e.teamId, p_name: e.name.trim() });
  if (error) return teamFehler(error);
  const r = data as { status: "umbenannt"; name: string } | { status: "abgewiesen"; grund: "name_vergeben"; team: string };
  if (r.status === "abgewiesen") return nameVergeben(r.team);
  return ok({ name: r.name });
}

/** Den Verein umbenennen. Das Web prüft vorab (`vereinsNameProblem`), die
 *  Datenebene weist mit dem CHECK ab. */
export async function benenneVereinUm(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; name: string },
): Promise<KernErgebnis<{ name: string }>> {
  const problem = vereinsNameProblem(e.name);
  if (problem) return fehlschlag("eingabe", problem, { feld: "name" });
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const { data, error } = await supabase.rpc("verein_umbenennen", { p_verein: e.vereinId, p_name: e.name.trim() });
  if (error) return vereinFehler(error);
  return ok({ name: (data as { name: string }).name });
}

/** Einen Verein gründen (#587 AK 1–4, #675 AK 2, PC 1): Die Person wird seine
 *  erste Verwaltung, ohne Team, und stimmt für den Verein der Vereinbarung zur
 *  Auftragsbearbeitung zu. Das Web prüft den Namen vorab (`vereinsNameProblem`),
 *  die Datenebene weist mit dem CHECK ab; `bestaetigt` ist «berechtigt, für
 *  den Verein zu handeln», `fassung` die Fassung der Vereinbarung, der die
 *  Person zustimmt (`null` = keine), und die Datenebene verlangt beides selbst
 *  — die Fassung muss die geltende sein. Gehört die Person inzwischen einem
 *  Verein an, ist `feld` `verein_id`: Die offene Seite ist überholt, der
 *  Aufrufer lädt sie neu. */
export async function gruendeVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { name: string; bestaetigt: boolean; fassung: string | null },
): Promise<KernErgebnis<{ vereinId: string; name: string }>> {
  // Eine Action nimmt, was ein Aufruf schickt: ohne die Form kein TypeError.
  if (typeof e.name !== "string") return fehlschlag("eingabe", VEREIN_NAME_UNGUELTIG, { feld: "name" });
  const problem = vereinsNameProblem(e.name);
  if (problem) return fehlschlag("eingabe", problem, { feld: "name" });
  const { data, error } = await supabase.rpc("verein_gruenden", {
    p_name: e.name.trim(),
    p_bestaetigt: e.bestaetigt === true,
    // Die Datenebene nimmt `null` als «keine Zustimmung»; die Typen kennen nur Text.
    p_fassung: (typeof e.fassung === "string" ? e.fassung : null) as string,
  });
  if (error) {
    if (error.message.includes("SCHON_IM_VEREIN")) return fehlschlag("regel", VEREIN_MELDUNG.SCHON_IM_VEREIN, { feld: "verein_id" });
    if (error.code === "23514" && error.message.includes("verein_name"))
      return fehlschlag("eingabe", vereinsNameProblem(e.name) ?? VEREIN_NAME_UNGUELTIG, { feld: "name" });
    return ausDbFehler(error);
  }
  const g = gruendungAus(data);
  return g ? ok({ vereinId: g.id, name: g.name }) : fehlschlag("technisch", VEREIN_UNSTIMMIG.gruenden);
}

/** Die Vereinbarung zur Auftragsbearbeitung des Vereins für seine Verwaltung
 *  (#675 AK 3, 4): geltende Fassung und festgehaltene Zustimmung. Wer nicht
 *  zur Verwaltung gehört, erhält «Verein nicht gefunden». */
export async function ladeVereinbarung(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string },
): Promise<KernErgebnis<VereinVereinbarung>> {
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const { data, error } = await supabase.rpc("verein_vereinbarung", { p_verein: e.vereinId });
  if (error) return vereinFehler(error);
  const v = vereinbarungAus(data);
  return v ? ok(v) : fehlschlag("technisch", VEREIN_UNSTIMMIG.vereinbarung);
}

/** Den Verein löschen, nur mit dem bestätigten aktuellen Vereinsnamen (#587
 *  AK 10, 11): alle Teams, der ganze Spielerbestand samt Links, Abos und
 *  Abholadressen, die Verwaltung; die Personen bleiben als Konten ohne Verein,
 *  ihre eigenen Übungen und Trainings ebenso. Die Antwort trägt die Bilder, die
 *  der Aufrufer danach aus dem Speicher räumt. Stimmt der Name nicht mehr
 *  (umbenannt), ist nichts gelöscht und der aktuelle Name steht da. Wer nicht
 *  zur Verwaltung gehört, erfährt nur «nicht gefunden». Die Antwort der
 *  Datenebene wird auf ihre Form geprüft: Ob gelöscht ist, sagt dann nur ein
 *  Blick auf die Seite. */
export async function loescheVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; vereinsname: string },
): Promise<KernErgebnis<VereinLoeschAusgang>> {
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  if (typeof e.vereinsname !== "string") return fehlschlag("eingabe", MELDUNG_WIEDERHOLEN, { feld: "vereinsname" });
  const { data, error } = await supabase.rpc("verein_loeschen", { p_verein: e.vereinId, p_name: e.vereinsname.trim() });
  if (error) return vereinFehler(error);
  const ausgang = vereinLoeschAusgangAus(data);
  return ausgang ? ok(ausgang) : fehlschlag("technisch", VEREIN_UNSTIMMIG.loeschen);
}

/** Wie das Löschen des eigenen Kontos zum Verein steht (#587 AK 12, 13): frei,
 *  letzte Person der Verwaltung oder einzige Person im Verein. Nur lesend; die
 *  Datenebene prüft beim Ausführen erneut. */
export async function ladeKontoLoeschenInfo(supabase: SupabaseClient, _userId: string): Promise<KernErgebnis<KontoLoeschInfo>> {
  const { data, error } = await supabase.rpc("konto_loeschen_info");
  if (error) {
    // Ein Lesefehler heisst hier «Angaben nicht lesbar», nicht «nicht speichern».
    const f = ausDbFehler(error);
    return f.art === "technisch" ? fehlschlag("technisch", VEREIN_UNSTIMMIG.info, { wiederholbar: true }) : f;
  }
  const info = kontoInfoAus(data);
  return info ? ok(info) : fehlschlag("technisch", VEREIN_UNSTIMMIG.info);
}

/** Der Daten-Teil des Konto-Löschens (#587 AK 12–14): anonymisiert öffentliche,
 *  löscht private Übungen und eigene Trainings — und den Verein, wenn das Konto
 *  seine einzige Person ist und der Vereinsname stimmt (`vereinsname`: `null`
 *  ohne Eingabe). Die vier Antworten der Datenebene: `geloescht` (mit den
 *  Bildern des Vereins), `letzte_verwaltung`, `verein_bestaetigen`,
 *  `vereinsname_falsch`. Die Anmeldung selbst entfernt die Action danach; dieser
 *  Kern löscht sie nicht. */
export async function loescheKonto(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinsname: string | null },
): Promise<KernErgebnis<KontoLoeschAusgang>> {
  if (e.vereinsname !== null && typeof e.vereinsname !== "string")
    return fehlschlag("eingabe", MELDUNG_WIEDERHOLEN, { feld: "vereinsname" });
  const name = e.vereinsname?.trim() || null;
  const { data, error } = await supabase.rpc("delete_account", { p_vereinsname: name });
  if (error) {
    // Ein unerwarteter Fehler heisst hier «Konto liess sich nicht löschen», nicht «nicht speichern».
    const f = ausDbFehler(error);
    return f.art === "technisch" ? fehlschlag("technisch", KONTO_LOESCHEN_TEXT.fehler, { wiederholbar: true }) : f;
  }
  const ausgang = kontoLoeschAusgangAus(data);
  return ausgang ? ok(ausgang) : fehlschlag("technisch", VEREIN_UNSTIMMIG.konto);
}

/** Der Ausgang des Auflösens: aufgelöst (mit dem Namen des Teams und den
 *  Bildern, die der Aufrufer danach aus dem Speicher räumt) oder der Name
 *  stimmte nicht — dann steht der aktuelle Name da. */
export type AufloesungErgebnis =
  | { status: "aufgeloest"; name: string; bilder: { id: string; bild_url: string | null }[]; spielerBleiben: number }
  | { status: "name_falsch"; name: string };

/** Ein Team auflösen, nur mit dem bestätigten aktuellen Teamnamen. */
export async function loeseTeamAuf(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; teamname: string },
): Promise<KernErgebnis<AufloesungErgebnis>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const { data, error } = await supabase.rpc("verein_team_aufloesen", { p_team: e.teamId, p_teamname: e.teamname.trim() });
  if (error) return teamFehler(error);
  const r = data as
    | { status: "aufgeloest"; name: string; bilder: { id: string; bild_url: string | null }[]; spieler_bleiben: number }
    | { status: "name_falsch"; name: string };
  if (r.status === "name_falsch") return ok({ status: "name_falsch", name: r.name });
  return ok({ status: "aufgeloest", name: r.name, bilder: r.bilder ?? [], spielerBleiben: r.spieler_bleiben });
}

/** Der Status einer Suche oder Aufnahme als Schritt. Fachliche Abweisungen
 *  (nicht gefunden, gebremst, …) sind Schritte, keine Fehler — nur ein
 *  unbekannter Status wird `technisch`. */
function personSchritt(r: { status: string; anzeige_name?: string }, erfolg: string): KernErgebnis<PersonSchritt> {
  if (r.status === erfolg && r.anzeige_name !== undefined) return ok({ ok: true, anzeigeName: r.anzeige_name });
  if (r.status in PERSON_MELDUNG)
    return ok({ ok: false, meldung: PERSON_MELDUNG[r.status as keyof typeof PERSON_MELDUNG] });
  console.error("[verein] unbekannter Status der Personensuche", r.status);
  return fehlschlag("technisch", "Das hat nicht geklappt. Bitte erneut versuchen.");
}

function adresseOderFehler(email: string): string | KernFehler {
  const adresse = email.trim();
  return adresse || fehlschlag("eingabe", "Bitte eine E-Mail-Adresse angeben.", { feld: "email" });
}

/** Nachsehen, wer sich hinter der Adresse verbirgt — mit `teamId` für die
 *  Aufnahme in ein Team (`bereits_mitglied`), ohne für die Verwaltung
 *  (`bereits_verwaltung`). Die Bremse zählt erfolglose Versuche. */
export async function findePerson(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; email: string; teamId?: string },
): Promise<KernErgebnis<PersonSchritt>> {
  const adresse = adresseOderFehler(e.email);
  if (typeof adresse !== "string") return adresse;
  if (!istUuid(e.vereinId) || (e.teamId !== undefined && !istUuid(e.teamId))) return vereinNichtGefunden();
  const { data, error } = await supabase.rpc("verein_finde_person", {
    p_verein: e.vereinId,
    p_email: adresse,
    p_team: e.teamId ?? null,
  });
  if (error) return e.teamId === undefined ? vereinFehler(error) : teamFehler(error);
  return personSchritt(data as { status: string; anzeige_name?: string }, "gefunden");
}

/** Eine Person ins Team aufnehmen — dieselbe Bremse wie die Suche. */
export async function nimmInsTeamAuf(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; email: string },
): Promise<KernErgebnis<PersonSchritt>> {
  const adresse = adresseOderFehler(e.email);
  if (typeof adresse !== "string") return adresse;
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const { data, error } = await supabase.rpc("verein_team_aufnehmen", { p_team: e.teamId, p_email: adresse });
  if (error) return teamFehler(error);
  return personSchritt(data as { status: string; anzeige_name?: string }, "aufgenommen");
}

/** Sich selbst ins Team aufnehmen («Mich aufnehmen»); wirkt auch einmalig,
 *  wenn man schon Mitglied ist. */
export async function nimmMichInsTeam(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ teamId: string }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const { error } = await supabase.rpc("verein_team_beitreten", { p_team: e.teamId });
  if (error) return teamFehler(error);
  return ok({ teamId: e.teamId });
}

/** Eine Trainer:in aus dem Team entfernen — auch sich selbst. Das letzte
 *  Mitglied darf gehen; das Team bleibt bestehen. */
export async function entferneAusTeam(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; userId: string },
): Promise<KernErgebnis<{ teamId: string }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  if (!istUuid(e.userId)) return fehlschlag("nicht_gefunden", "Person nicht gefunden.", { feld: "user_id" });
  const { error } = await supabase.rpc("verein_team_mitglied_entfernen", { p_team: e.teamId, p_user: e.userId });
  if (error) return teamFehler(error);
  return ok({ teamId: e.teamId });
}

/** Eine Person in die Vereinsverwaltung aufnehmen. */
export async function nimmInVerwaltungAuf(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; email: string },
): Promise<KernErgebnis<PersonSchritt>> {
  const adresse = adresseOderFehler(e.email);
  if (typeof adresse !== "string") return adresse;
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const { data, error } = await supabase.rpc("verein_verwaltung_aufnehmen", { p_verein: e.vereinId, p_email: adresse });
  if (error) return vereinFehler(error);
  return personSchritt(data as { status: string; anzeige_name?: string }, "aufgenommen");
}

/** Eine Person aus der Verwaltung entfernen — auch sich selbst («austreten»).
 *  Die letzte Person geht nicht: Regel mit dem Satz `LETZTE_VERWALTUNG`. */
export async function entferneAusVerwaltung(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; userId: string },
): Promise<KernErgebnis<{ vereinId: string }>> {
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  if (!istUuid(e.userId)) return fehlschlag("nicht_gefunden", "Person nicht gefunden.", { feld: "user_id" });
  const { data, error } = await supabase.rpc("verein_verwaltung_entfernen", { p_verein: e.vereinId, p_user: e.userId });
  if (error) return vereinFehler(error);
  if ((data as { status: string }).status === "letzte_verwaltung")
    return fehlschlag("regel", VEREIN_MELDUNG.LETZTE_VERWALTUNG, { feld: "user_id" });
  return ok({ vereinId: e.vereinId });
}

/** Eine Spieler:in aus einem Team nehmen (Verwaltung, #579 AK 11, 17).
 *  `ohneTeam`: danach ist sie keinem Team mehr zugeordnet;
 *  `schnuppernBeendet`: sie schnupperte dort, Schnuppern und Zählung enden
 *  (#584 AK 13). */
export async function nimmSpielerAusTeamImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerId: string },
): Promise<KernErgebnis<{ ohneTeam: boolean; schnuppernBeendet: boolean }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  if (!istUuid(e.spielerId))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_id" });
  const { data, error } = await supabase.rpc("verein_spieler_aus_team_nehmen", { p_team: e.teamId, p_spieler: e.spielerId });
  if (error) return teamFehler(error);
  const r = data as { ohne_team: boolean; schnuppern_beendet: boolean };
  return ok({ ohneTeam: !!r.ohne_team, schnuppernBeendet: !!r.schnuppern_beendet });
}

// ── Spielerbestand der Verwaltung (Story #582) ──────────────────────────────
//
// Erfassen ohne Team, ändern, löschen und den privaten Link abrufen bzw.
// erneuern — für jede Spieler:in des Vereins, ohne Mitgliedschaft in ihren
// Teams. Wie oben: nur `verein_*`-RPCs, nur in der Anwendung, kein KI-Werkzeug.
// Wer ohne Recht, für eine unbekannte, fremde oder gelöschte Spieler:in fragt,
// erfährt dasselbe: `SPIELER_NICHT_GEFUNDEN` am Feld `spieler_id`.

const spielerNichtGefunden = () =>
  fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_id" });

type SpielerAbweisung = { status: "abgewiesen"; grund: "doppelt" } & SpielerDoppeltImVerein;

/** Eine Spieler:in ohne Team erfassen (#582 AK 3, 4, 6, 7). `vereinName` steht
 *  nur im Satz der Abweisung. Eine Doppelerfassung ist eine Regel am Feld
 *  `vorname`; die Grenze des Vereins meldet die Datenebene mit `VEREIN_VOLL`. */
export async function legeSpielerImVereinAn(
  supabase: SupabaseClient,
  _userId: string,
  e: SpielerEingabe & { vereinId: string; vereinName: string },
): Promise<KernErgebnis<{ spielerId: string }>> {
  const problem = eingabeFehler(e);
  if (problem) return problem;
  if (!istUuid(e.vereinId)) return vereinNichtGefunden();
  const args = argumente(e);
  const { data, error } = await supabase.rpc("verein_spieler_anlegen", { p_verein: e.vereinId, ...args });
  if (error) return vereinFehler(error);
  const r = data as { status: "angelegt"; id: string } | SpielerAbweisung;
  // Der Jahrgang ist geprüft (eingabeFehler), also gesetzt.
  if (r.status === "abgewiesen")
    return fehlschlag(
      "regel",
      spielerErfassenAbgewiesenText(r, { vorname: args.p_vorname, nachname: args.p_nachname, jahrgang: args.p_jahrgang! }, e.vereinName),
      { feld: "vorname" },
    );
  return ok({ spielerId: r.id });
}

/** Vorname, Nachname, Jahrgang und J+S-Nummer einer Spieler:in des Vereins
 *  ändern (#582 AK 2, 5, 15) — als Ganzes. */
export async function aendereSpielerImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: SpielerEingabe & { spielerId: string },
): Promise<KernErgebnis<{ spielerId: string }>> {
  const problem = eingabeFehler(e);
  if (problem) return problem;
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_aendern", { p_spieler: e.spielerId, ...argumente(e) });
  if (error) return spielerFehler(error);
  const r = data as { status: "geaendert" } | SpielerAbweisung;
  if (r.status === "abgewiesen") return fehlschlag("regel", spielerAendernAbgewiesenText(r), { feld: "vorname" });
  return ok({ spielerId: e.spielerId });
}

/** Die Teams einer Spieler:in, nach Name — frisch gelesen für die Bestätigung
 *  zum Löschen (#582 AK 13) und zum Erneuern des Links (#583 AK 16);
 *  `abholbar`: Die Selbstabholung des Teams ist eingeschaltet. */
export async function ladeSpielerTeamsImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ teams: { id: string; name: string; abholbar: boolean }[] }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_teams", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ teams: [...(data as { teams: { id: string; name: string; abholbar: boolean }[] }).teams].sort(nachName) });
}

/** Eine Spieler:in aus dem Verein löschen (#582 AK 12, 14) — samt privatem
 *  Link und Meldungen. `teams`: ihre Teams vor dem Löschen, damit der Aufrufer
 *  deren Ansichten neu lädt. */
export async function loescheSpielerImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ teams: { id: string; name: string }[] }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_entfernen", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ teams: (data as { status: "geloescht"; teams: { id: string; name: string }[] }).teams });
}

/** Den privaten Link einer Spieler:in des Vereins holen (#582 AK 9, 10) — das
 *  Geheimnis, nicht die Adresse. `ohneTeam`: Die Spielervertretung sähe noch
 *  keine Termine; `stand`: abgeholt, zugestellt oder offen (#657). */
export async function holeSpielerLinkImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ token: string; ohneTeam: boolean; stand: LinkStand }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_link_holen", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  // `bezogen` heisst abgeholt; `zugestellt` fehlt nur im Fenster vor der Migration.
  const r = data as { link_token: string; ohne_team: boolean; bezogen: boolean; zugestellt?: boolean };
  return ok({ token: r.link_token, ohneTeam: r.ohne_team, stand: linkStandAus(r.bezogen, r.zugestellt === true) });
}

/** Den aktuellen Link als zugestellt markieren oder die Markierung
 *  zurücknehmen (#657 AK 2), für jede Spieler:in des Vereins, auch ohne Team.
 *  Ein abgeholter Link bleibt abgeholt (`geaendert: false`, kein Fehler). Nur
 *  in der Anwendung, nie im KI-Weg. */
export async function setzeLinkZugestelltImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string; zugestellt: boolean },
): Promise<KernErgebnis<{ linkStand: LinkStand; geaendert: boolean }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_link_zugestellt_setzen", {
    p_spieler: e.spielerId,
    p_zugestellt: e.zugestellt,
  });
  if (error) return spielerFehler(error);
  const r = data as { link_stand: LinkStand; geaendert: boolean };
  return ok({ linkStand: r.link_stand, geaendert: r.geaendert });
}

/** Den privaten Link erneuern (#582 AK 11): Der bisherige gilt nie wieder, ein
 *  Kalender-Abo endet, der Stand ist wieder offen. */
export async function erneuereSpielerLinkImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ token: string }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_link_erneuern", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ token: (data as { link_token: string }).link_token });
}

// ── Import aus einer Datei (Story #585) ─────────────────────────────────────

/** Die Zeilen, wie sie aus dem Browser kommen, geprüft wie beim einzelnen
 *  Erfassen und auf eine J+S-Nummer aus Ziffern (#455 AK 17, 19). Mehr als
 *  `IMPORT_ZEILEN_MAX` Zeilen weist schon der Kern ab, wie die Datenebene. */
function importFehler(zeilen: unknown): KernFehler | null {
  // Eine Action nimmt, was ein Aufruf schickt: ohne die Form kein TypeError.
  if (!importZeilenForm(zeilen)) return fehlschlag("eingabe", MELDUNG_WIEDERHOLEN);
  if (zeilen.length > IMPORT_ZEILEN_MAX) return fehlschlag("regel", IMPORT_TEXT.zuGross);
  // Die Zeilennummer trägt die Einordnung zwischen Vorschau und Übernahme.
  const nummern = zeilen.map((z) => z.zeile);
  if (!nummern.every((n) => Number.isInteger(n) && n > 0) || new Set(nummern).size !== nummern.length)
    return fehlschlag("eingabe", MELDUNG_WIEDERHOLEN);
  for (const z of zeilen) {
    const p = spielerProblem(z);
    if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
    if (z.jsNummer !== null && jsAus(z.jsNummer).wert !== z.jsNummer)
      return fehlschlag("eingabe", IMPORT_TEXT.js(z.jsNummer), { feld: "js_nummer" });
  }
  return null;
}

function importArgumente(vereinId: string, zeilen: ImportEintrag[]) {
  return {
    p_verein: vereinId,
    p_zeilen: zeilen.map((z) => ({
      zeile: z.zeile,
      vorname: bereinigeName(z.vorname),
      nachname: bereinigeName(z.nachname),
      jahrgang: jahrgangAus(z.jahrgang),
      js: z.jsNummer,
    })),
  };
}

/** Die Vorschau eines Imports (#585 AK 3–7): wer neu ist, wer eine neue
 *  J+S-Nummer erhält, wer unverändert bleibt oder mehrfach im Verein geführt
 *  wird — über den ganzen Verein, ohne zu schreiben. Nur die Verwaltung. */
export async function pruefeVereinImport(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; zeilen: ImportEintrag[] },
): Promise<KernErgebnis<ImportVorschau>> {
  const problem = importFehler(e.zeilen);
  if (problem) return problem;
  if (!istUuid(e.vereinId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });
  const { data, error } = await supabase.rpc("verein_spieler_importieren", importArgumente(e.vereinId, e.zeilen));
  if (error) return vereinFehler(error);
  // Die Form prüft `vorschauAus`, die Zeilennummern `importZeilenStimmen`;
  // passt etwas nicht, keine falsche Vorschau.
  const vorschau = (data as { status?: unknown } | null)?.status === "vorschau" ? vorschauAus(data) : null;
  return vorschau && importZeilenStimmen(vorschau, e.zeilen.map((z) => z.zeile))
    ? ok(vorschau)
    : fehlschlag("technisch", IMPORT_TEXT.unstimmig, { wiederholbar: true });
}

/** Den Import übernehmen, ganz oder gar nicht (#585 PC 4): nur, wenn die
 *  Datenebene dieselbe Einordnung sieht wie die bestätigte Vorschau und der
 *  Verein unter der Grenze bleibt. Sonst ist nichts geschehen, und die
 *  Antwort trägt die neue Vorschau (`veraltet`, AK 9). Die Neuen kommen ohne
 *  Team; keine Zuordnung, kein Schnuppern, keine Termine (PC 5). */
export async function importiereInVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string; zeilen: ImportEintrag[]; erwartet: ImportErwartet },
): Promise<KernErgebnis<ImportAusgang>> {
  const problem = importFehler(e.zeilen);
  if (problem) return problem;
  if (!importErwartetForm(e.erwartet)) return fehlschlag("eingabe", MELDUNG_WIEDERHOLEN);
  if (!istUuid(e.vereinId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });
  const { data, error } = await supabase.rpc("verein_spieler_importieren", {
    ...importArgumente(e.vereinId, e.zeilen),
    p_erwartet: {
      neu: e.erwartet.neu,
      js: e.erwartet.js.map(({ zeile, alt }) => ({ zeile, alt })),
      mehrfach: e.erwartet.mehrfach,
    },
  });
  if (error) return vereinFehler(error);
  const ausgang = ausgangAus(data);
  const stimmt = ausgang?.status !== "veraltet" || importZeilenStimmen(ausgang.vorschau, e.zeilen.map((z) => z.zeile));
  return ausgang && stimmt ? ok(ausgang) : fehlschlag("technisch", IMPORT_TEXT.unstimmig, { wiederholbar: true });
}
