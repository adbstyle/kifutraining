import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  SPIELER_MELDUNG,
  bereinigeName,
  jahrgangAus,
  nachSpielerName,
  spielerName,
  spielerProblem,
  type Spieler,
  type SpielerEingabe,
} from "@/lib/spieler";
import {
  IMPORT_TEXT,
  IMPORT_ZEILEN_MAX,
  jsAus,
  type ImportEintrag,
  type ImportErwartet,
  type ImportVorschau,
} from "@/lib/spieler-import";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { MELDUNG_WIEDERHOLEN, NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Die Spielerliste eines Teams (Epic #433, Story #434): einsehen, aufnehmen,
 * ändern, entfernen — dieselben Funktionen für die Karte «Spieler:innen» im
 * Team-Bereich und die KI-Werkzeuge «spieler_*».
 *
 * Geschrieben wird nur über die RPCs `spieler_*`: Sie prüfen die
 * Mitgliedschaft, halten vor jeder Änderung der Liste den Stand begonnener
 * Termine fest (Migration spielerliste) und ersetzen beim ersten Aufnehmen die
 * erwarteten Zahlen. Lesen darf jedes Mitglied (RLS `sp_select`).
 */

export const SPIELER_FELD = { feld: "spieler_id" } as const;

const SPIELER_SPALTEN = "id, vorname, nachname, jahrgang, js_nummer, link_bezogen, kader_spieler(kader_id)";

type SpielerRoh = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  js_nummer: string | null;
  link_bezogen: boolean;
  kader_spieler: { kader_id: string }[] | null;
};

function ausRoh(s: SpielerRoh): Spieler {
  return {
    id: s.id,
    vorname: s.vorname,
    nachname: s.nachname,
    jahrgang: s.jahrgang,
    jsNummer: s.js_nummer,
    linkBezogen: s.link_bezogen,
    kaderIds: (s.kader_spieler ?? []).map((k) => k.kader_id),
  };
}

/** Ein Fehler der Spieler-RPCs als Kern-Fehler: «nicht gefunden» ordnet nur
 *  die Spielerliste ein, alles übrige `ausDbFehler` mit dem Satz aus
 *  `SPIELER_MELDUNG`. */
function spielerFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("SPIELER_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("SPIELER_DOPPELT"))
    return fehlschlag("regel", SPIELER_MELDUNG.SPIELER_DOPPELT, { feld: "vorname" });
  return ausDbFehler(e);
}

function eingabeFehler(e: SpielerEingabe): KernFehler | null {
  const p = spielerProblem(e);
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Die RPC-Argumente einer geprüften Eingabe. */
function argumente(e: SpielerEingabe) {
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
  const { data, error } = await supabase.from("spieler").select(SPIELER_SPALTEN).eq("team_id", e.teamId);
  if (error) return ausDbFehler(error);
  return ok({ team: team.wert, spieler: nachSpielerName(((data ?? []) as SpielerRoh[]).map(ausRoh)) });
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
  const { data, error } = await supabase.rpc("spieler_aufnehmen", { p_team: e.teamId, ...argumente(e) });
  if (error) return spielerFehler(error);
  const r = data as { id: string; ersetzt: number };
  return ok({ spielerId: r.id, teamId: e.teamId, ersetzt: r.ersetzt });
}

/** Vorname, Nachname, Jahrgang und J+S-Nummer ändern (AK 2, 14) — als Ganzes. */
export async function aendereSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: SpielerEingabe & { spielerId: string },
): Promise<KernErgebnis<{ spielerId: string; teamId: string }>> {
  const problem = eingabeFehler(e);
  if (problem) return problem;
  const team = await teamDesSpielers(supabase, e.spielerId);
  if (!team.ok) return team;
  const { error } = await supabase.rpc("spieler_aendern", { p_spieler: e.spielerId, ...argumente(e) });
  if (error) return spielerFehler(error);
  return ok({ spielerId: e.spielerId, teamId: team.wert });
}

/** Eine Spieler:in aus der Liste entfernen (AK 3). An vergangenen Terminen
 *  bleibt sie als ehemalige Spieler:in ohne Namen (#435 PC 4). */
export async function entferneSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ teamId: string; name: string }>> {
  const geladen = await ladeSpieler(supabase, e.spielerId);
  if (!geladen.ok) return geladen;
  const { error } = await supabase.rpc("spieler_entfernen", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ teamId: geladen.wert.teamId, name: spielerName(geladen.wert) });
}

/** Eine Spieler:in samt Team, soweit die RLS sie zeigt. */
export async function ladeSpieler(
  supabase: SupabaseClient,
  spielerId: string,
): Promise<KernErgebnis<Spieler & { teamId: string }>> {
  if (!istUuid(spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase
    .from("spieler")
    .select(`${SPIELER_SPALTEN}, team_id`)
    .eq("id", spielerId)
    .maybeSingle<SpielerRoh & { team_id: string }>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  return ok({ ...ausRoh(data), teamId: data.team_id });
}

async function teamDesSpielers(supabase: SupabaseClient, spielerId: string): Promise<KernErgebnis<string>> {
  const s = await ladeSpieler(supabase, spielerId);
  return s.ok ? ok(s.wert.teamId) : s;
}

/** Führt das Team eine Spielerliste? Dann kommt die Spielerzahl anstehender
 *  Termine aus ihr (AK 8, 9). */
export async function fuehrtSpielerliste(supabase: SupabaseClient, teamId: string): Promise<boolean> {
  if (!istUuid(teamId)) return false;
  const { count } = await supabase.from("spieler").select("id", { count: "exact", head: true }).eq("team_id", teamId);
  return (count ?? 0) > 0;
}

// ── Privater Link (#436) ────────────────────────────────────────────────────

type LinkErgebnis = KernErgebnis<{ token: string; teamId: string; name: string }>;

async function linkRpc(
  supabase: SupabaseClient,
  spielerId: string,
  name: "spieler_link_holen" | "spieler_link_erneuern",
): Promise<LinkErgebnis> {
  const s = await ladeSpieler(supabase, spielerId);
  if (!s.ok) return s;
  const { data, error } = await supabase.rpc(name, { p_spieler: spielerId });
  if (error) return spielerFehler(error);
  return ok({ token: data as string, teamId: s.wert.teamId, name: spielerName(s.wert) });
}

/** Den privaten Link einer Spieler:in holen (AK 1, 12) — das Geheimnis, nicht die Adresse. */
export async function holeSpielerLink(supabase: SupabaseClient, _userId: string, e: { spielerId: string }): Promise<LinkErgebnis> {
  return linkRpc(supabase, e.spielerId, "spieler_link_holen");
}

/** Den privaten Link erneuern (AK 3): Der bisherige gilt nie wieder. */
export async function erneuereSpielerLink(supabase: SupabaseClient, _userId: string, e: { spielerId: string }): Promise<LinkErgebnis> {
  return linkRpc(supabase, e.spielerId, "spieler_link_erneuern");
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

// ── Import aus einer Datei (Story #455) ─────────────────────────────────────

/** Die Zeilen, wie sie aus dem Browser kommen, geprüft wie beim einzelnen
 *  Aufnehmen und auf eine J+S-Nummer aus Ziffern (#455 AK 17, 19). */
function importFehler(zeilen: ImportEintrag[]): KernFehler | null {
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

function importArgumente(teamId: string, zeilen: ImportEintrag[]) {
  return {
    p_team: teamId,
    p_zeilen: zeilen.map((z) => ({
      zeile: z.zeile,
      vorname: bereinigeName(z.vorname),
      nachname: bereinigeName(z.nachname),
      jahrgang: jahrgangAus(z.jahrgang),
      js: z.jsNummer,
    })),
  };
}

function importDbFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("SPIELERLISTE_GEAENDERT")) return fehlschlag("konflikt", IMPORT_TEXT.geaendert);
  if (e.message.includes("SPIELERLISTE_VOLL")) return fehlschlag("regel", IMPORT_TEXT.zuGross);
  return spielerFehler(e);
}

/** Die Vorschau eines Imports (#455 AK 15, 16): Wer neu ist, wer eine neue
 *  J+S-Nummer erhält, wer unverändert bleibt — ohne zu schreiben. */
export async function pruefeSpielerImport(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; zeilen: ImportEintrag[] },
): Promise<KernErgebnis<ImportVorschau>> {
  const problem = importFehler(e.zeilen);
  if (problem) return problem;
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase.rpc("spieler_importieren", importArgumente(e.teamId, e.zeilen));
  if (error) return importDbFehler(error);
  return ok(data as ImportVorschau);
}

/** Den Import übernehmen, ganz oder gar nicht (#455 AK 25–27, PC 1–4) —
 *  nur, wenn die Datenebene dieselbe Einordnung sieht wie die bestätigte
 *  Vorschau. `ersetzt`: anstehende Termine, die ihre erwartete Zahl verloren. */
export async function importiereSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; zeilen: ImportEintrag[]; erwartet: ImportErwartet },
): Promise<KernErgebnis<{ teamId: string; neu: number; js: number; ersetzt: number }>> {
  const problem = importFehler(e.zeilen);
  if (problem) return problem;
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase.rpc("spieler_importieren", {
    ...importArgumente(e.teamId, e.zeilen),
    p_erwartet: { neu: e.erwartet.neu, js: e.erwartet.js },
  });
  if (error) return importDbFehler(error);
  const r = data as { neu: number; js: number; ersetzt: number };
  return ok({ teamId: e.teamId, ...r });
}
