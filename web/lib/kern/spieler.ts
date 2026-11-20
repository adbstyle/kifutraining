import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  SPIELER_MELDUNG,
  HERAUSNEHMEN_TEXT,
  bereinigeName,
  herausnehmenFrage,
  jahrgangAus,
  nachSpielerName,
  nachTeamname,
  spielerDoppeltText,
  spielerName,
  spielerProblem,
  verbleibendeTeams,
  type HerausnehmenLage,
  type LinkTeam,
  type Spieler,
  type SpielerDoppelt,
  type SpielerEingabe,
  type SpielerTeams,
} from "@/lib/spieler";
import type { ProbeStand } from "@/lib/probe";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { ladeVereinslage } from "@/lib/kern/konto";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Die Spielerliste eines Teams (Epic #433, Story #434): einsehen, aufnehmen,
 * ändern, aus dem Team nehmen — dieselben Funktionen für die Karte «Spieler:innen» im
 * Team-Bereich und die KI-Werkzeuge «spieler_*».
 *
 * Geschrieben wird nur über die RPCs `spieler_*`: Sie prüfen die
 * Mitgliedschaft, halten vor jeder Änderung der Liste den Stand begonnener
 * Termine fest (Migration spielerliste) und ersetzen beim ersten Aufnehmen die
 * erwarteten Zahlen. Lesen darf jedes Mitglied (RLS `sp_select`).
 */

export const SPIELER_FELD = { feld: "spieler_id" } as const;

const SPIELER_SPALTEN = "id, vorname, nachname, jahrgang, js_nummer, link_bezogen, kader_spieler(kader_id, team_id)";

type SpielerRoh = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  js_nummer: string | null;
  link_bezogen: boolean;
  /** Alle Kader der Spieler:in, die die RLS zeigt — auch die anderer Teams,
   *  denen die handelnde Person angehört; `kopfAusRoh` grenzt auf das Team ein. */
  kader_spieler: { kader_id: string; team_id: string }[] | null;
};

/** Eine Zuordnung des Kontextteams mit ihrer Spieler:in. Das Schnuppern
 *  (`probe_seit`) hängt an der Zuordnung, nicht an der Spieler:in. */
type ZuordnungRoh = { probe_seit: string | null; spieler: SpielerRoh | null };

/** Die Spieler:in ohne Schnupper-Stand und weitere Teams; `kaderIds` nur die
 *  Kader von `teamId` (Story #579 AK 9: Eine Spieler:in steht in mehreren
 *  Teams, ihre Kader gehören je einem). */
function kopfAusRoh(s: SpielerRoh, teamId: string): Omit<Spieler, "probe" | "weitereTeams"> {
  return {
    id: s.id,
    vorname: s.vorname,
    nachname: s.nachname,
    jahrgang: s.jahrgang,
    jsNummer: s.js_nummer,
    linkBezogen: s.link_bezogen,
    kaderIds: (s.kader_spieler ?? []).filter((k) => k.team_id === teamId).map((k) => k.kader_id),
  };
}

function ausRoh(z: ZuordnungRoh & { spieler: SpielerRoh }, teamId: string): Spieler {
  return {
    ...kopfAusRoh(z.spieler, teamId),
    // Die weiteren Teams liest `ladeSpielerliste` nach (`spieler_weitere_teams`).
    weitereTeams: [],
    // Den Stand liest `mitProbeStand` nach (#555 AK 6, 7).
    probe: z.probe_seit ? { anzahl: null, besucht: 0, angemeldet: 0, moeglich: 0 } : null,
  };
}

/** Die Stände der schnuppernden Spieler:innen eines Teams (#555 AK 7), aus der
 *  Datenebene (`team_probe_staende`): besucht seit dem Einschalten, künftig
 *  angemeldet, noch möglich. */
async function mitProbeStand(
  supabase: SupabaseClient,
  teamId: string,
  spieler: Spieler[],
): Promise<KernErgebnis<Spieler[]>> {
  if (!spieler.some((s) => s.probe)) return ok(spieler);
  const { data, error } = await supabase.rpc("team_probe_staende", { p_team: teamId });
  if (error) return ausDbFehler(error);
  const staende = new Map(((data ?? []) as { spieler_id: string; stand: ProbeStand }[]).map((z) => [z.spieler_id, z.stand]));
  return ok(spieler.map((s) => (s.probe ? { ...s, probe: staende.get(s.id) ?? s.probe } : s)));
}

/** Ein Fehler der Spieler-RPCs als Kern-Fehler: «nicht gefunden» ordnet nur
 *  die Spielerliste ein, alles übrige `ausDbFehler` mit dem Satz aus
 *  `SPIELER_MELDUNG`. */
export function spielerFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("SPIELER_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("SPIELER_DOPPELT"))
    return fehlschlag("regel", SPIELER_MELDUNG.SPIELER_DOPPELT, { feld: "vorname" });
  return ausDbFehler(e);
}

/** Die Eingabe geprüft, sonst der Fehler am Feld — geteilt mit dem Verein-Kern. */
export function eingabeFehler(e: SpielerEingabe): KernFehler | null {
  const p = spielerProblem(e);
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Die RPC-Argumente einer geprüften Eingabe — geteilt mit dem Verein-Kern. */
export function argumente(e: SpielerEingabe) {
  return {
    p_vorname: bereinigeName(e.vorname),
    p_nachname: bereinigeName(e.nachname),
    p_jahrgang: jahrgangAus(e.jahrgang),
    p_js: (e.jsNummer ?? "").trim() || null,
  };
}

/** Die Spielerliste eines Teams, nach Vorname und Nachname (AK 5). */
export async function ladeSpielerliste(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ team: { id: string; name: string }; spieler: Spieler[] }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  // Über die Zuordnungen des Kontextteams, nicht über `spieler.team_id`:
  // «Zeile sichtbar» heisst nicht «im Team» (Architekturplan §4.2). Dazu die
  // weiteren Teams und wer Mitteilungen aufs Mobile eingeschaltet hat (#483
  // AK 11, 12: nur ja/nein) — alle drei hängen nur am Team, also gleichzeitig.
  // Scheitert nur die Angabe zu den Mitteilungen (etwa im Fenster zwischen
  // Vercel-Deploy und Migration), kommt die Liste trotzdem — dann ohne Glocken.
  const [{ data, error }, weitere, mitteilungen] = await Promise.all([
    supabase.from("team_spieler").select(`probe_seit, spieler:spieler!tsp_spieler(${SPIELER_SPALTEN})`).eq("team_id", e.teamId),
    supabase.rpc("spieler_weitere_teams", { p_team: e.teamId }),
    supabase.rpc("team_spieler_mitteilungen", { p_team: e.teamId }),
  ]);
  if (error) return ausDbFehler(error);
  const zeilen = ((data ?? []) as unknown as ZuordnungRoh[]).filter((z): z is ZuordnungRoh & { spieler: SpielerRoh } => z.spieler !== null);
  if (weitere.error) return ausDbFehler(weitere.error);
  const weitereVon = new Map(((weitere.data ?? []) as { spieler_id: string; teams: string[] }[]).map((w) => [w.spieler_id, w.teams]));
  if (mitteilungen.error) console.error("[kern] team_spieler_mitteilungen:", mitteilungen.error.message);
  const mitMitteilungen = new Set((mitteilungen.error ? [] : (mitteilungen.data ?? [])) as string[]);
  const liste = zeilen.map((z) => ({
    ...ausRoh(z, e.teamId),
    weitereTeams: weitereVon.get(z.spieler.id) ?? [],
    mitteilungen: mitMitteilungen.has(z.spieler.id),
  }));
  const spieler = await mitProbeStand(supabase, e.teamId, nachSpielerName(liste));
  if (!spieler.ok) return spieler;
  return ok({ team: team.wert, spieler: spieler.wert });
}

/** Eine Spieler:in aufnehmen (AK 1, 6, 7, 14). `ersetzt`: Wie viele
 *  anstehende Termine ihre erwartete Zahl verloren — nur bei der ersten. */
export async function nimmSpielerAuf(
  supabase: SupabaseClient,
  _userId: string,
  e: SpielerEingabe & { teamId: string },
): Promise<KernErgebnis<{ spielerId: string; teamId: string; ersetzt: number }>> {
  const problem = eingabeFehler(e);
  if (problem) return problem;
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const args = argumente(e);
  const { data, error } = await supabase.rpc("spieler_aufnehmen", { p_team: e.teamId, ...args });
  if (error) return spielerFehler(error);
  const r = data as { id: string; ersetzt: number } | SpielerDoppelt;
  // Der Jahrgang ist geprüft (eingabeFehler), also gesetzt.
  if ("status" in r)
    return fehlschlag("regel", spielerDoppeltText(r, { vorname: args.p_vorname, nachname: args.p_nachname, jahrgang: args.p_jahrgang! }), { feld: "vorname" });
  return ok({ spielerId: r.id, teamId: e.teamId, ersetzt: r.ersetzt });
}

/** Vorname, Nachname, Jahrgang und J+S-Nummer ändern (AK 2, 14) — als Ganzes,
 *  in der Spielerliste von `teamId` (Rollen nach Ort, #578). */
export async function aendereSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: SpielerEingabe & { spielerId: string; teamId: string },
): Promise<KernErgebnis<{ spielerId: string; teamId: string }>> {
  const problem = eingabeFehler(e);
  if (problem) return problem;
  if (!istUuid(e.spielerId) || !istUuid(e.teamId))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase.rpc("spieler_aendern", { p_team: e.teamId, p_spieler: e.spielerId, ...argumente(e) });
  if (error) return spielerFehler(error);
  const r = data as { status: "geaendert" } | SpielerDoppelt;
  if (r.status === "abgewiesen") return fehlschlag("regel", spielerDoppeltText(r, null), { feld: "vorname" });
  return ok({ spielerId: e.spielerId, teamId: e.teamId });
}

/** Die Teams einer Spieler:in samt Stand — was die Bestätigung des
 *  Herausnehmens nennt (#579 AK 14–16) und der Link-Dialog (#583). Nur im
 *  Team, in dem man handelt; nach Namen wie alle Team-Listen (`nachTeamname`). */
export async function ladeSpielerTeams(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerId: string },
): Promise<KernErgebnis<SpielerTeams>> {
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (!istUuid(e.spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase.rpc("spieler_teams", { p_team: e.teamId, p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  const r = data as SpielerTeams;
  return ok({ ...r, teams: [...r.teams].sort((a, b) => nachTeamname(a.name, b.name)) });
}

/** Die Lage für die Rückfrage des KI-Wegs: Name, Team, Verein, weitere Teams
 *  und ob es das letzte Team der handelnden Person mit ihr ist (#589 AK 4). */
async function herausnehmenLage(
  supabase: SupabaseClient,
  e: { teamId: string; spielerId: string },
  teams: SpielerTeams,
): Promise<KernErgebnis<HerausnehmenLage>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const spieler = await ladeSpieler(supabase, e.teamId, e.spielerId);
  if (!spieler.ok) return spieler;
  const verein = await ladeVereinslage(supabase);
  if (!verein.ok) return verein;
  return ok({
    vorname: spieler.wert.vorname,
    nachname: spieler.wert.nachname,
    team: team.wert.name,
    verein: verein.wert?.name ?? null,
    verbleibend: verbleibendeTeams(teams.teams),
    // Ob sie in diesem Team schnuppert, nennt `spieler_teams` (eine Quelle).
    probe: teams.schnuppert,
    // `eigen` je Team aus `spieler_teams`: kein weiteres Team der Person mit ihr.
    letztesEigenes: !teams.teams.some((t) => t.eigen && !t.dieses),
  });
}

/**
 * Eine Spieler:in aus dem Team nehmen, nicht löschen (#579 AK 10, 13–16;
 * PC 4–6). Sie bleibt samt Link im Verein; ihre künftigen Meldungen und
 * Kader in diesem Team verfallen, begonnene Termine behalten sie.
 *
 * `stand` ist die Kennung der Teams, die die Bestätigung nannte
 * (`ladeSpielerTeams`). Fehlt er, ändert der Aufruf nichts und liefert die
 * Rückfrage samt Stand (KI-Weg, wie `schalteProbe`); weicht er ab, hat sich
 * die Lage geändert und nichts wurde geschrieben: ein `konflikt` auf `stand`,
 * den die Oberfläche mit frischem Stand erneut zeigt.
 */
export async function nimmSpielerAusTeam(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string; spielerId: string; stand?: string },
): Promise<KernErgebnis<{ teamId: string; spielerId: string; ohneTeam: boolean; letztesEigenesTeam: boolean; schnuppernBeendet: boolean }>> {
  if (e.stand === undefined) {
    const teams = await ladeSpielerTeams(supabase, userId, e);
    if (!teams.ok) return teams;
    const lage = await herausnehmenLage(supabase, e, teams.wert);
    if (!lage.ok) return lage;
    return fehlschlag("regel", herausnehmenFrage(lage.wert), {
      feld: "stand",
      hinweis: `Wiederhole den Aufruf mit stand: «${teams.wert.stand}», wenn das so gewollt ist.`,
    });
  }
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (!istUuid(e.spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase.rpc("spieler_aus_team_nehmen", {
    p_team: e.teamId,
    p_spieler: e.spielerId,
    p_stand: e.stand,
  });
  if (error) return spielerFehler(error);
  const r = data as
    | { status: "herausgenommen"; ohne_team: boolean; letztes_eigenes_team: boolean; schnuppern_beendet: boolean }
    | ({ status: "stand_geaendert" } & SpielerTeams);
  // Nie als Erfolg lesen: Es wurde nichts geändert.
  if (r.status === "stand_geaendert")
    return fehlschlag("konflikt", HERAUSNEHMEN_TEXT.geaendert, {
      feld: "stand",
      hinweis:
        `Die Teams der Spieler:in haben sich geändert (jetzt: ${r.teams.map((t) => t.name).join(", ") || "keines"}). ` +
        "Rufe das Werkzeug ohne stand erneut auf, um die Rückfrage mit dem neuen Stand zu erhalten.",
    });
  return ok({
    teamId: e.teamId,
    spielerId: e.spielerId,
    ohneTeam: r.ohne_team,
    letztesEigenesTeam: r.letztes_eigenes_team,
    schnuppernBeendet: r.schnuppern_beendet,
  });
}

/** Eine Spieler:in aus der Liste eines Teams, soweit die RLS sie zeigt — ohne
 *  Schnupper-Stand und weitere Teams, die nur im Kontext eines Teams gelten
 *  (`ladeSpielerliste`). «Im Team» heisst: eine Zuordnung in `team_spieler`;
 *  die Zeile `spieler` allein genügt nicht (Architekturplan §4.2). */
export async function ladeSpieler(
  supabase: SupabaseClient,
  teamId: string,
  spielerId: string,
): Promise<KernErgebnis<Omit<Spieler, "probe" | "weitereTeams">>> {
  if (!istUuid(teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (!istUuid(spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase
    .from("team_spieler")
    .select(`spieler:spieler!tsp_spieler(${SPIELER_SPALTEN})`)
    .eq("team_id", teamId)
    .eq("spieler_id", spielerId)
    .maybeSingle<{ spieler: SpielerRoh | null }>();
  if (error) return ausDbFehler(error);
  if (!data?.spieler) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  return ok(kopfAusRoh(data.spieler, teamId));
}

/** Das älteste Team der Spieler:in, dem die handelnde Person angehört — für
 *  einen Aufruf ohne Team (KI-Weg). Die RLS von `team_spieler` zeigt nur
 *  Zuordnungen zu eigenen Teams. */
export async function eigenesTeamVon(supabase: SupabaseClient, spielerId: string): Promise<KernErgebnis<string>> {
  if (!istUuid(spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase
    .from("team_spieler")
    .select("team_id")
    .eq("spieler_id", spielerId)
    .order("created_at")
    .order("team_id")
    .limit(1)
    .maybeSingle<{ team_id: string }>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  return ok(data.team_id);
}

/** Wie viele Spieler:innen die Liste des Teams führt. Führt das Team eine,
 *  kommt die Spielerzahl anstehender Termine aus ihr (#434 AK 8, 9); dazu
 *  der Hinweis, für wie viele ein Termin mit Kadern gilt (#453 AK 8). */
export async function anzahlSpieler(supabase: SupabaseClient, teamId: string): Promise<number> {
  if (!istUuid(teamId)) return 0;
  const { count } = await supabase.from("team_spieler").select("spieler_id", { count: "exact", head: true }).eq("team_id", teamId);
  return count ?? 0;
}

// ── Privater Link (#436) ────────────────────────────────────────────────────

type LinkErgebnis = KernErgebnis<{ token: string; teamId: string; name: string }>;

/** Der private Link einer Spieler:in im Team `teamId` (Story #583): Der Link
 *  gehört der Spieler:in und gilt für alle ihre Teams; geholt und erneuert
 *  wird er in einem Team, dem man angehört und dem sie zugeordnet ist (die
 *  Datenebene prüft beides). Ohne `teamId` (KI-Weg) ist es das älteste ihrer
 *  Teams, dem die handelnde Person angehört. */
async function linkRpc(
  supabase: SupabaseClient,
  e: { spielerId: string; teamId?: string; person?: { vorname: string; nachname: string } },
  name: "spieler_link_holen" | "spieler_link_erneuern",
): Promise<LinkErgebnis> {
  let teamId = e.teamId;
  if (teamId === undefined) {
    const eigenes = await eigenesTeamVon(supabase, e.spielerId);
    if (!eigenes.ok) return eigenes;
    teamId = eigenes.wert;
  }
  if (!istUuid(teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (!istUuid(e.spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  // Den Namen vor dem RPC lesen: Ein erneuerter Link wird so nie als Fehler gemeldet.
  // (Hat der Aufrufer sie schon gelesen, `e.person`, bleibt es bei einem Lesen.)
  let person = e.person;
  if (!person) {
    const gelesen = await supabase.from("spieler").select("vorname, nachname").eq("id", e.spielerId).maybeSingle<{ vorname: string; nachname: string }>();
    if (gelesen.error) return ausDbFehler(gelesen.error);
    if (!gelesen.data) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
    person = gelesen.data;
  }
  const { data, error } = await supabase.rpc(name, { p_team: teamId, p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ token: data as string, teamId, name: spielerName(person) });
}

/** Was der KI-Weg über den privaten Link einer Spieler:in nennt (#589 AK 9):
 *  das Team, in dem er ihn holt (das älteste ihrer Teams, dem die handelnde
 *  Person angehört), ihr Name und alle ihre Teams — auch die, denen die
 *  Person nicht angehört, nur mit Namen (`spieler_teams`). Keine eigene,
 *  keine fremde Spieler:in ausserhalb der eigenen Teams: `nicht_gefunden`
 *  wie eine unbekannte (#589 AK 8). */
export async function ladeLinkLage(
  supabase: SupabaseClient,
  userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ teamId: string; vorname: string; nachname: string; name: string; teams: LinkTeam[] }>> {
  const team = await eigenesTeamVon(supabase, e.spielerId);
  if (!team.ok) return team;
  const spieler = await ladeSpieler(supabase, team.wert, e.spielerId);
  if (!spieler.ok) return spieler;
  const teams = await ladeSpielerTeams(supabase, userId, { teamId: team.wert, spielerId: e.spielerId });
  if (!teams.ok) return teams;
  return ok({
    teamId: team.wert,
    vorname: spieler.wert.vorname,
    nachname: spieler.wert.nachname,
    name: spielerName(spieler.wert),
    teams: teams.wert.teams.map(({ name, abholbar }) => ({ name, abholbar })),
  });
}

/** Den privaten Link einer Spieler:in holen (AK 1, 12) — das Geheimnis, nicht die Adresse. */
export async function holeSpielerLink(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string; teamId?: string; person?: { vorname: string; nachname: string } },
): Promise<LinkErgebnis> {
  return linkRpc(supabase, e, "spieler_link_holen");
}

/** Den privaten Link erneuern (AK 3): Der bisherige gilt nie wieder, in allen Teams der Spieler:in. */
export async function erneuereSpielerLink(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string; teamId?: string; person?: { vorname: string; nachname: string } },
): Promise<LinkErgebnis> {
  return linkRpc(supabase, e, "spieler_link_erneuern");
}

// ── Selbstabholung (#438) ───────────────────────────────────────────────────

export type Abholung = { teamId: string; token: string; aktiv: boolean };

type AbholRoh = { token: string; aktiv: boolean };

async function abholRpc(
  supabase: SupabaseClient,
  teamId: string,
  name: "abholung_schalten" | "abholung_erneuern",
  extra: Record<string, unknown> = {},
): Promise<KernErgebnis<Abholung>> {
  if (!istUuid(teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase.rpc(name, { p_team: teamId, ...extra });
  if (error) return spielerFehler(error);
  const r = data as AbholRoh;
  return ok({ teamId, token: r.token, aktiv: r.aktiv });
}

/** Die Selbstabholung ein- oder ausschalten (AK 1, PC 1, 5, 6). */
export async function schalteAbholung(supabase: SupabaseClient, _userId: string, e: { teamId: string; aktiv: boolean }) {
  return abholRpc(supabase, e.teamId, "abholung_schalten", { p_aktiv: e.aktiv });
}

/** Die Abholadresse erneuern (AK 4, PC 4, 6): Die bisherige gilt nie wieder. */
export async function erneuereAbholung(supabase: SupabaseClient, _userId: string, e: { teamId: string }) {
  return abholRpc(supabase, e.teamId, "abholung_erneuern");
}

/** Die Abholadresse, wie sie steht — ohne sie anzulegen (Karte, KI). `token`
 *  fehlt, solange noch niemand die Selbstabholung eingeschaltet hat. */
export async function leseAbholung(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ teamId: string; token: string | null; aktiv: boolean }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase.from("team_abholung").select("token, aktiv").eq("team_id", e.teamId).maybeSingle<AbholRoh>();
  if (error) return ausDbFehler(error);
  return ok({ teamId: e.teamId, token: data?.token ?? null, aktiv: data?.aktiv ?? false });
}
