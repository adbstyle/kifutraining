import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Teams lesen für einen Client, der bereits als Nutzer spricht (Cookie-
 * Session ODER OAuth-Bearer, Epic #190) — abgespalten aus
 * lib/queries/teams.ts, damit der Fachkern die eigenen Teams lesen kann, ohne
 * den Cookie-Client oder `react`s `cache` mitzuziehen. `getTeam` bleibt dort:
 * es ist an einen Request gebunden (`cache`).
 *
 * Sichtbar ist ein Team nur seinen Mitgliedern; das setzt die RLS durch, hier
 * steht kein zusätzlicher Filter.
 */

export type TeamUebersicht = {
  id: string;
  name: string;
  mitgliederAnzahl: number;
};

/** Die Teams, in denen dieses Konto Mitglied ist, alphabetisch. Ohne Konto
 *  (anonymer Client) liefert die RLS keine Zeile. Wirft bei einem
 *  Datenbankfehler — wie jede Query dieses Layers. */
export async function getMeineTeamsFuer(supabase: SupabaseClient): Promise<TeamUebersicht[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, team_members ( user_id )")
    .order("name");
  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    mitgliederAnzahl: (t.team_members ?? []).length,
  }));
}

/** Nur Kennung und Name der eigenen Teams, alphabetisch — für die
 *  Seitenleiste, die keine Mitglieder zählt. */
export async function getMeineTeamNamenFuer(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("teams").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Die Mitglieder eines Teams mit Anzeigename, ohne E-Mail (Story 1 NFR 4,
 *  #325 PC 9) — dieselbe RPC wie der Team-Bereich (`getTeam`). */
export async function getTeamMitgliederFuer(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ userId: string; anzeigeName: string }[]> {
  const { data, error } = await supabase.rpc("team_mitglieder", { p_team: teamId });
  if (error) throw error;
  return ((data ?? []) as { user_id: string; anzeige_name: string }[]).map((m) => ({
    userId: m.user_id,
    anzeigeName: m.anzeige_name,
  }));
}
