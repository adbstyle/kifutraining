import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { TEAM_INFOS_TEXT, teamInfosBereinigt, teamInfosProblem, type TeamInfos } from "@/lib/team-infos";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Infos zum Team (#598): lesen und festlegen — dieselben Funktionen für die
 * Karte «Infos zum Team» und die KI-Werkzeuge (AK 9).
 *
 * Gelesen und geschrieben wird nur über die RPCs `team_infos_lesen` und
 * `team_infos_festlegen`; Grenze, Leeren und Stand (nur bei verändertem Text,
 * als Tag am Trainingsort) stehen allein in der Datenebene.
 */

function teamInfosFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("TEAM_INFOS_ZU_LANG") || e.message.includes("team_infos_text"))
    return fehlschlag("eingabe", TEAM_INFOS_TEXT.zuLang, { feld: "text" });
  return ausDbFehler(e);
}

/** Die Infos des Teams (AK 7): `text` leer = keine. */
export async function leseTeamInfos(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<TeamInfos & { teamId: string }>> {
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase.rpc("team_infos_lesen", { p_team: e.teamId });
  if (error) return teamInfosFehler(error);
  const r = data as TeamInfos;
  return ok({ teamId: e.teamId, text: r.text, stand: r.stand });
}

/** Die Infos verfassen, ändern oder — leer — entfernen (AK 1, 3). */
export async function legeTeamInfosFest(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; text: string | null },
): Promise<KernErgebnis<TeamInfos & { teamId: string }>> {
  const problem = teamInfosProblem(e.text);
  if (problem) return fehlschlag("eingabe", problem, { feld: "text" });
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase.rpc("team_infos_festlegen", {
    p_team: e.teamId,
    p_text: teamInfosBereinigt(e.text) ?? "",
  });
  if (error) return teamInfosFehler(error);
  const r = data as TeamInfos;
  return ok({ teamId: e.teamId, text: r.text, stand: r.stand });
}
