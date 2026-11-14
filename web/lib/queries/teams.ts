import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMeineTeamsFuer, type TeamUebersicht } from "@/lib/queries/teams-fuer";

export type { TeamUebersicht } from "@/lib/queries/teams-fuer";

/**
 * Query-Layer für Teams (Team-Epic Stories 3, 4, 5; Vereine #581).
 *
 * Die Mitglieder eines Teams sind untereinander gleichberechtigt — es gibt im
 * Team keine Rollen. Was ein Team selbst betrifft (anlegen, umbenennen,
 * auflösen), ist Sache der Vereinsverwaltung und liegt im Verein. Sichtbar ist
 * ein Team nur seinen Mitgliedern; das setzt die RLS durch, hier steht kein
 * zusätzlicher Filter. Die Mitgliederliste liefert Anzeigename und E-Mail-
 * Adresse (#425) — beides nur den aktuellen Mitgliedern des Teams, darum die
 * RPC statt eines Joins auf auth.users.
 */

export type TeamMitglied = {
  userId: string;
  anzeigeName: string;
  /** Damit erkennbar ist, wer hinter einem Anzeigenamen steckt (#425). */
  email: string;
  /** Gehört auch zur Vereinsverwaltung — die Liste zeigt es als Plakette (#581 AK 15). */
  istVerwaltung: boolean;
};

export type TeamDetail = {
  id: string;
  name: string;
  mitglieder: TeamMitglied[];
};

/** Die eigenen Teams, einmal pro Request gelesen: Die Seitenleiste braucht
 *  sie auf jeder Seite, die Teamübersicht und die Trainingsseiten noch
 *  einmal. Ohne Anmeldung liefert die RLS keine Zeile — wer den User schon
 *  kennt (die Navigation), ruft das hier direkt. */
export const getMeineTeamsImRequest = cache(async (): Promise<TeamUebersicht[]> =>
  getMeineTeamsFuer(await createClient()),
);

/** Die Teams des angemeldeten Kontos, alphabetisch (`getMeineTeamsFuer`).
 *  Anonym: leere Liste. */
export async function getMeineTeams(): Promise<TeamUebersicht[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getMeineTeamsImRequest();
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
  const mitglieder = (
    (roh ?? []) as { user_id: string; anzeige_name: string; email: string; ist_verwaltung: boolean }[]
  ).map((m) => ({
    userId: m.user_id,
    anzeigeName: m.anzeige_name,
    email: m.email,
    istVerwaltung: m.ist_verwaltung,
  }));

  return { id: team.id, name: team.name, mitglieder };
});
