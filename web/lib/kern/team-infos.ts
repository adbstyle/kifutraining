import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { TEAM_INFOS_TEXT, teamInfosBereinigt, teamInfosProblem, type TeamInfos } from "@/lib/team-infos";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { TRAININGS_ZEITZONE } from "@/lib/zeit";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Infos zum Team (#598): lesen und festlegen — dieselben Funktionen für die
 * Karte «Infos zum Team» und die KI-Werkzeuge (AK 9).
 *
 * Geschrieben wird nur über die RPC `team_infos_festlegen`; Grenze, Leeren
 * und Stand (nur bei verändertem Text) stehen in der Datenebene.
 */

function teamInfosFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("TEAM_INFOS_ZU_LANG") || e.message.includes("team_infos_text"))
    return fehlschlag("eingabe", TEAM_INFOS_TEXT.zuLang, { feld: "text" });
  return ausDbFehler(e);
}

/** «YYYY-MM-DD» am Trainingsort, wie die Datenebene den Stand nennt. */
function standAmTrainingsort(zeitpunkt: string): string {
  return new Date(zeitpunkt).toLocaleDateString("sv-SE", { timeZone: TRAININGS_ZEITZONE });
}

/** Die Infos des Teams (AK 7): `text` leer = keine. */
export async function leseTeamInfos(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<TeamInfos & { teamId: string }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase
    .from("team_infos")
    .select("text, geaendert_am")
    .eq("team_id", e.teamId)
    .maybeSingle<{ text: string; geaendert_am: string }>();
  if (error) return ausDbFehler(error);
  return ok({
    teamId: e.teamId,
    text: data?.text ?? null,
    stand: data ? standAmTrainingsort(data.geaendert_am) : null,
  });
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
