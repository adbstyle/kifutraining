// Trainings löschen — eine Stelle, die auch die Bilddateien mitnimmt.
//
// Die DB-Kaskade entfernt nur die Zeilen, nicht die Dateien im Bildspeicher.
// Geteilt zwischen dem Löschen des eigenen Trainings, dem Zurückziehen einer
// Vorlage und dem Auflösen eines Teams — dreimal dieselbe Reihenfolge, damit
// nie das Bild einer noch existierenden Fassung fällt.
import { bildUrlToPath } from "@/lib/storage";
import { entferneStorageObjekt, istEigeneFassungsDatei } from "@/lib/fassung";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Ein Training samt seiner Fassungs-Bilddateien löschen. Liefert `false`,
 *  wenn nichts gelöscht wurde (nicht vorhanden oder kein Schreibrecht — die
 *  RLS entscheidet), damit der Aufrufer kein falsches Erfolgssignal gibt.
 *
 *  Gelöscht wird ausschliesslich, was der Fassung selbst gehört: der Dateiname
 *  muss ihre ID tragen. Ein verwaistes Bild ist harmlos, eine fremde oder
 *  geteilte Datei zu löschen wäre Datenverlust. */
export async function loescheTrainingMitBildern(
  supabase: SupabaseClient,
  trainingId: string,
): Promise<boolean> {
  // Bildpfade VOR dem Löschen einsammeln — danach sind die Zeilen weg.
  const { data: fassungen } = await supabase
    .from("training_exercises")
    .select("id, bild_url")
    .eq("training_id", trainingId);

  const { data: geloescht, error } = await supabase
    .from("trainings")
    .delete()
    .eq("id", trainingId)
    .select("id");
  if (error || !geloescht?.length) return false;

  for (const f of fassungen ?? []) {
    const pfad = bildUrlToPath(f.bild_url);
    if (pfad && istEigeneFassungsDatei(pfad, f.id)) {
      await entferneStorageObjekt(supabase, pfad);
    }
  }
  return true;
}
