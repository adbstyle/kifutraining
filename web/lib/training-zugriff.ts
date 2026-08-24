// Wer darf ein Training bearbeiten — und wohin gehören seine Bilder?
//
// Seit dem Team-Epic gibt es zwei Eigentumsformen: eine Person ODER ein Team.
// Beide Fälle unterscheiden sich für den Editor nur in zwei Punkten: wer
// schreiben darf und in welchem Storage-Ordner die Bildkopien landen. Diese
// Datei hält beides an einer Stelle, damit nicht jede Action ihre eigene
// Variante der Frage stellt.
//
// Die RLS bleibt die Autorität — hier geht es um klare Meldungen und um den
// richtigen Bild-Ordner, nicht um Zugriffsschutz.
import { teamOrdner, userOrdner, type BildOrdner } from "@/lib/fassung";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Wem das Training gehört — und damit, wohin seine Bilder gehören. */
export type Bearbeitungsziel =
  | { art: "persoenlich"; ownerId: string }
  | { art: "team"; teamId: string };

/** Das Bearbeitungsziel eines Trainings, oder `null` wenn es der USER nicht
 *  bearbeiten darf (fremd, nicht vorhanden oder eine eingefrorene Vorlage).
 *
 *  Team-Trainings kommen nur bei Mitgliedern überhaupt aus der Abfrage zurück —
 *  dafür sorgt die SELECT-Policy. */
export async function ladeBearbeitungsziel(
  supabase: SupabaseClient,
  trainingId: string,
  userId: string,
): Promise<Bearbeitungsziel | null> {
  const { data } = await supabase
    .from("trainings")
    .select("owner_id, team_id, visibility")
    .eq("id", trainingId)
    .maybeSingle();
  if (!data) return null;

  if (data.team_id) return { art: "team", teamId: data.team_id };
  if (data.owner_id === userId && data.visibility === "private")
    return { art: "persoenlich", ownerId: userId };
  return null;
}

/** Der Storage-Ordner für die Bildkopien dieses Trainings. */
export function bildOrdnerFuer(ziel: Bearbeitungsziel): BildOrdner {
  return ziel.art === "team" ? teamOrdner(ziel.teamId) : userOrdner(ziel.ownerId);
}
