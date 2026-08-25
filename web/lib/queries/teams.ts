import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Query-Layer für Teams (Team-Epic Stories 3, 4, 5).
 *
 * Alle Mitglieder sind gleichberechtigt — es gibt keine Rollen. Sichtbar ist
 * ein Team nur seinen Mitgliedern; das setzt die RLS durch, hier steht kein
 * zusätzlicher Filter. E-Mail-Adressen kommen nirgends vor: die Mitgliederliste
 * liefert ausschliesslich Anzeigenamen (Story 1 NFR 4), darum die RPC statt
 * eines Joins auf auth.users.
 */

export type TeamUebersicht = {
  id: string;
  name: string;
  mitgliederAnzahl: number;
};

export type TeamMitglied = {
  userId: string;
  anzeigeName: string;
};

export type TeamDetail = {
  id: string;
  name: string;
  mitglieder: TeamMitglied[];
};

/** Die Teams des angemeldeten Kontos, alphabetisch. Anonym: leere Liste. */
export async function getMeineTeams(): Promise<TeamUebersicht[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

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

/** Ein Team samt Mitgliedern. `null`, wenn es das Team nicht gibt oder der
 *  USER nicht dazugehört — beides ununterscheidbar.
 *
 *  Über `cache` je Request nur einmal ausgeführt: Rahmen und Ansicht des
 *  Team-Bereichs fragen beide danach, sollen die Mitgliederliste aber nicht
 *  zweimal holen. */
export const getTeam = cache(async function getTeam(
  id: string,
): Promise<TeamDetail | null> {
  const supabase = await createClient();
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!team) return null;

  const { data: roh } = await supabase.rpc("team_mitglieder", { p_team: id });
  const mitglieder = ((roh ?? []) as { user_id: string; anzeige_name: string }[]).map((m) => ({
    userId: m.user_id,
    anzeigeName: m.anzeige_name,
  }));

  return { id: team.id, name: team.name, mitglieder };
});

/** Was beim Auflösen verloren geht (Story 13 AK 5): die Zahlen für den
 *  Bestätigungsdialog. Persönliche Trainings der Mitglieder zählen nicht dazu —
 *  sie gehören nicht dem Team. */
export async function getTeamAufloesungsInfo(
  teamId: string,
): Promise<{ trainings: number; termine: number }> {
  const supabase = await createClient();

  const { count: trainings } = await supabase
    .from("trainings")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  const { data: termine } = await supabase
    .from("training_termine")
    .select("id, trainings!inner ( team_id )")
    .eq("trainings.team_id", teamId);

  return { trainings: trainings ?? 0, termine: (termine ?? []).length };
}
