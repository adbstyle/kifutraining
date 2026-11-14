import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { nachSpielerName, nachTeamname, SPIELER_MELDUNG, type SpielerEingabe } from "@/lib/spieler";
import { teamNameProblem } from "@/lib/team";
import {
  PERSON_MELDUNG,
  type PersonSchritt,
  VEREIN_MELDUNG,
  VEREIN_TEAM_NICHT_GEFUNDEN,
  teamnameVergebenText,
  spielerAendernAbgewiesenText,
  spielerErfassenAbgewiesenText,
  vereinsNameProblem,
  zuordnenAbweisungText,
  type SpielerDoppeltImVerein,
  type ZuordnenAbweisung,
} from "@/lib/verein";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";
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
 * #579): die Grundfassung der Liste und das Zuordnen zu einem Team — nur für
 * die Vereinsverwaltung, nur in der Anwendung. Es gibt dafür kein KI-Werkzeug
 * (Architekturplan §4.1, §5.5); der Kern steht hier, damit Seite und Action
 * dieselbe Regelquelle nutzen.
 *
 * Geschrieben und gelesen wird nur über die RPCs `verein_*`: Sie prüfen die
 * Rolle als erste Anweisung und rufen `nur_in_der_anwendung()` auf.
 */

export type VereinSpieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  /** Die J+S-Nummer; `null`, wenn keine erfasst ist. Nur die Verwaltung sieht sie. */
  js: string | null;
  /** Der aktuelle private Link wurde schon bezogen (Spalte «Privater Link»). */
  linkBezogen: boolean;
  /** Die Teams der Spieler:in, nach Namen; leer, wenn sie keinem zugeordnet ist. */
  teams: { id: string; name: string }[];
};

/** Ein Team des Vereins; `anzahl`: Zuordnungen, gezählt wie die Grenze 100. */
export type VereinTeam = { id: string; name: string; anzahl: number };

const nachName = (a: { name: string }, b: { name: string }) => nachTeamname(a.name, b.name);

/** Alle Spieler:innen und Teams des Vereins, nach Vorname und Nachname bzw.
 *  Teamname geordnet (#579 AK 1) — die Grundfassung, die Story #580 ersetzt. */
export async function ladeVereinSpielerliste(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string },
): Promise<KernErgebnis<{ spieler: VereinSpieler[]; teams: VereinTeam[] }>> {
  if (!istUuid(e.vereinId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });
  const { data, error } = await supabase.rpc("verein_spielerliste", { p_verein: e.vereinId });
  if (error) return vereinFehler(error);
  const r = data as { spieler: (Omit<VereinSpieler, "js" | "linkBezogen"> & { js: string | null; link_bezogen: boolean })[]; teams: VereinTeam[] };
  return ok({
    spieler: nachSpielerName(r.spieler).map(({ link_bezogen, ...s }) => ({ ...s, linkBezogen: link_bezogen, teams: [...s.teams].sort(nachName) })),
    teams: [...r.teams].sort(nachName),
  });
}

/**
 * Eine oder mehrere Spieler:innen einem Team des Vereins zuordnen (#579 AK
 * 2–8, 20–23): alles oder nichts. Lässt sich eine nicht zuordnen, ändert die
 * Datenebene nichts und nennt die Befunde, die hier in einen Satz gehen
 * (`zuordnenAbweisungText`); `teamName` ist der Name, den die Verwaltung
 * gewählt hat — er steht nur im Satz. `ersetzt`: Zahl der anstehenden
 * Termine, deren erwartete Spielerzahl wegfiel (nur beim ersten Zuordnen in
 * ein Team ohne Spieler:innen, AK 23).
 */
export async function ordneSpielerZu(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; teamName: string; spielerIds: string[] },
): Promise<KernErgebnis<{ anzahl: number; ersetzt: number }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  const ids = [...new Set(e.spielerIds)];
  if (ids.length === 0 || !ids.every(istUuid))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_ids" });
  const { data, error } = await supabase.rpc("verein_spieler_zuordnen", { p_team: e.teamId, p_spieler: ids });
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
 *  `spielerOhneTeam`: davon ohne Team. Beide nur für die Verwaltung. */
export type VereinAnsicht = {
  name: string;
  verwaltung: VerwaltungPerson[];
  teams: VereinTeamZeile[];
  spielerZahl?: number;
  spielerOhneTeam?: number;
};

/** Eine Trainer:in in der Teamansicht der Verwaltung. */
export type VereinTeamTrainer = TeamTrainer & { ich: boolean };

/** Eine Spieler:in in der Teamansicht: `teams` sind alle ihre Teams (samt
 *  diesem), `schnuppert` gilt für dieses Team. Nie J+S-Nummer oder Link. */
export type VereinTeamSpieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  schnuppert: boolean;
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
  const r = data as { name: string; verwaltung: VerwaltungRoh[]; teams: TeamRoh[]; spieler_zahl?: number; spieler_ohne_team?: number };
  return ok({
    name: r.name,
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
      schnuppert: boolean;
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
 *  `ohneTeam`: danach ist sie keinem Team mehr zugeordnet. */
export async function nimmSpielerAusTeamImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerId: string },
): Promise<KernErgebnis<{ ohneTeam: boolean }>> {
  if (!istUuid(e.teamId)) return teamNichtGefunden();
  if (!istUuid(e.spielerId))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_id" });
  const { data, error } = await supabase.rpc("verein_spieler_aus_team_nehmen", { p_team: e.teamId, p_spieler: e.spielerId });
  if (error) return teamFehler(error);
  return ok({ ohneTeam: !!(data as { ohne_team: boolean }).ohne_team });
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
 *  keine Termine; `bezogen`: Der Link wurde schon bezogen. */
export async function holeSpielerLinkImVerein(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ token: string; ohneTeam: boolean; bezogen: boolean }>> {
  if (!istUuid(e.spielerId)) return spielerNichtGefunden();
  const { data, error } = await supabase.rpc("verein_spieler_link_holen", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  const r = data as { link_token: string; ohne_team: boolean; bezogen: boolean };
  return ok({ token: r.link_token, ohneTeam: r.ohne_team, bezogen: r.bezogen });
}

/** Den privaten Link erneuern (#582 AK 11): Der bisherige gilt nie wieder, ein
 *  Kalender-Abo endet, der Stand «bezogen» ist zurückgesetzt. */
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
