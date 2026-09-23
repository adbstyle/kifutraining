// Trainings löschen — eine Stelle, die auch die Bilddateien mitnimmt (seit
// #197 im Fachkern).
//
// Die DB-Kaskade entfernt nur die Zeilen, nicht die Dateien im Bildspeicher.
// `loescheTrainingMitBildern` ist die eine Reihenfolge dafür, damit nie das
// Bild einer noch existierenden Fassung fällt. Sie dient dem Löschen eines
// Trainings (`loescheTraining`: Oberfläche, Team-Bestand, KI-Werkzeug
// «training_loeschen») und dem Aufräumen nach einem gescheiterten erneuten
// Ansetzen. Das Auflösen eines Teams räumt seine Bilder anderswo ab
// (`lib/storage-aufraeumen.ts`).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eigeneBildPfade, entferneStorageObjekte } from "@/lib/fassung";
import { ladeTrainingZumBearbeiten } from "@/lib/kern/zugriff";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

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

  await entferneStorageObjekte(supabase, eigeneBildPfade(fassungen ?? []));
  return true;
}

/** Die Meldung, wenn die Datenbank das Löschen nicht ausführte. */
export const LOESCHEN_FEHLGESCHLAGEN = "Löschen fehlgeschlagen.";

export type TrainingGeloescht = {
  name: string;
  /** Zahl der Übungen (Fassungen) über alle Varianten, die mitgingen. */
  uebungen: number;
  /** War es öffentlich? Dann ist es jetzt auch aus dem öffentlichen Bestand
   *  verschwunden (#197 PC 6). */
  warOeffentlich: boolean;
  teamId: string | null;
  /** Hatte das Team-Training einen Termin? Die Kaskade nimmt ihn mit. */
  terminEntfiel: boolean;
};

/** Ein Training löschen, das dieses Konto bearbeiten darf: ein eigenes oder
 *  eines der eigenen Teams (#197 AK 6–8, PC 5–7; Story 17, Team-Epic Story 5).
 *
 *  Es fragt nicht nach (#197 OoS 2); was mitging, steht im Ergebnis und wird
 *  VOR dem Löschen gelesen — danach sind die Zeilen weg. Kopien, die andere
 *  übernommen haben, sind eigene Trainings und bleiben (PC 7); wiederherstellen
 *  lässt sich nichts (OoS 3).
 *
 *  `nurTeam` beschränkt auf Team-Trainings (der Team-Bestand der Oberfläche):
 *  ein persönliches Training heisst dort «nicht gefunden». */
export async function loescheTraining(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; nurTeam?: boolean },
): Promise<KernErgebnis<TrainingGeloescht>> {
  const geladen = await ladeTrainingZumBearbeiten<{ name: string }>(
    supabase,
    userId,
    e.trainingId,
    "name",
  );
  if (!geladen.ok) return geladen;
  const { zeile } = geladen.wert;
  if (e.nurTeam && !zeile.team_id)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });

  const [fassungen, termin] = await Promise.all([
    supabase
      .from("training_exercises")
      .select("id", { count: "exact", head: true })
      .eq("training_id", zeile.id),
    supabase.from("training_termine").select("id").eq("training_id", zeile.id).maybeSingle(),
  ]);
  if (fassungen.error) return ausDbFehler(fassungen.error);
  if (termin.error) return ausDbFehler(termin.error);

  if (!(await loescheTrainingMitBildern(supabase, zeile.id)))
    return fehlschlag("technisch", LOESCHEN_FEHLGESCHLAGEN);

  return ok({
    name: zeile.name,
    uebungen: fassungen.count ?? 0,
    warOeffentlich: zeile.visibility === "public",
    teamId: zeile.team_id,
    terminEntfiel: termin.data !== null,
  });
}
