import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  SPIELER_MELDUNG,
  bereinigeName,
  jahrgangAus,
  nachSpielerName,
  spielerProblem,
  type Spieler,
  type SpielerEingabe,
} from "@/lib/spieler";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

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

const SPIELER_SPALTEN = "id, vorname, nachname, jahrgang, js_nummer";

type SpielerRoh = { id: string; vorname: string; nachname: string; jahrgang: number; js_nummer: string | null };

function ausRoh(s: SpielerRoh): Spieler {
  return { id: s.id, vorname: s.vorname, nachname: s.nachname, jahrgang: s.jahrgang, jsNummer: s.js_nummer };
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
  return ok({ teamId: geladen.wert.teamId, name: `${geladen.wert.vorname} ${geladen.wert.nachname}` });
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

/** Den privaten Link einer Spieler:in holen (AK 1, 12) — das Geheimnis, nicht die Adresse. */
export async function holeSpielerLink(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ token: string; teamId: string; name: string }>> {
  const s = await ladeSpieler(supabase, e.spielerId);
  if (!s.ok) return s;
  const { data, error } = await supabase.rpc("spieler_link_holen", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ token: data as string, teamId: s.wert.teamId, name: `${s.wert.vorname} ${s.wert.nachname}` });
}

/** Den privaten Link erneuern (AK 3): Der bisherige gilt nie wieder. */
export async function erneuereSpielerLink(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<{ token: string; teamId: string; name: string }>> {
  const s = await ladeSpieler(supabase, e.spielerId);
  if (!s.ok) return s;
  const { data, error } = await supabase.rpc("spieler_link_erneuern", { p_spieler: e.spielerId });
  if (error) return spielerFehler(error);
  return ok({ token: data as string, teamId: s.wert.teamId, name: `${s.wert.vorname} ${s.wert.nachname}` });
}
