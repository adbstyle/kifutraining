import "server-only";

// Die Kalender-Abos des angemeldeten Kontos für die Konto-Seite (Story #330
// AK 4, 5). Die RLS zeigt nur eigene Abos; die Namen der Teams lädt eine zweite
// Abfrage, weil `kalender_abos` nur an der Mitgliedschaft hängt, nicht direkt
// an `teams` (kein Embed möglich).

import { createClient } from "@/lib/supabase/server";
import { oeffentlicherOrigin } from "@/lib/origin";
import { aboLinks } from "@/lib/ical";

export type MeinAbo = {
  id: string;
  team: { name: string };
  /** Der https-Link zum Feed — der, den Google, Outlook und Proton brauchen. */
  url: string;
  /** Derselbe Link mit `webcal:` — Apple Kalender öffnet ihn direkt. */
  webcal: string;
};

/** Die gültigen Abos, ältestes zuerst — oder `null`, wenn sie sich nicht laden
 *  lassen (die Seite zeigt dann eine Meldung statt einer leeren Liste, die
 *  fälschlich «keine Abos» behauptete). */
export async function getMeineAbos(): Promise<MeinAbo[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kalender_abos")
    .select("id, team_id, token")
    .order("created_at");
  if (error) {
    console.error("[kalender-abo] Abos lesen", error);
    return null;
  }
  if (!data || data.length === 0) return [];

  const { data: teams, error: teamsFehler } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [...new Set(data.map((a) => a.team_id))]);
  if (teamsFehler || !teams) {
    console.error("[kalender-abo] Teams lesen", teamsFehler);
    return null;
  }
  const namen = new Map(teams.map((t) => [t.id, t.name]));

  const origin = await oeffentlicherOrigin();
  // Ein Abo ohne lesbares Team gibt es nicht: Es hängt an der Mitgliedschaft,
  // und die Mitgliedschaft macht das Team sichtbar. Fehlt es doch (gerade
  // aufgelöst), ist auch das Abo schon erloschen.
  return data.flatMap((a) => {
    const name = namen.get(a.team_id);
    return name === undefined ? [] : [{ id: a.id, team: { name }, ...aboLinks(origin, a.token) }];
  });
}
