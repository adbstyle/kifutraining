import { createClient } from "@/lib/supabase/server";
import type { Fahrplan } from "@/lib/queries/exercises";
import { FASSUNG_INHALT_FELDER } from "@/lib/fassung";
import { bearbeitungszielVon } from "@/lib/training-zugriff";

/** Eine Fassung zum Bearbeiten — im eigenen privaten Training oder in einem
 *  Training des eigenen Teams (Team-Epic Story 6). `null`, wenn sie nicht
 *  existiert oder der USER sie nicht bearbeiten darf. */
export type FassungZumBearbeiten = {
  id: string;
  trainingId: string;
  trainingName: string;
  /** Stufen des Trainings — sie bestimmen sein Schema und damit die
   *  Einordnungen, die für diese Fassung zur Wahl stehen (Epic #71). */
  trainingStufen: string[];
  name: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  uebungstyp: string | null;
  kategorien: string[];
  erscheinungsform: string[];
  feldtyp: string | null;
  anzahlKinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  fahrplan: Fahrplan | null;
  aufbau: string | null;
  varianten: string[];
  bildUrl: string | null;
  bildQuelle: "foto" | "diagramm" | null;
  diagramm: unknown;
};

export async function getFassungZumBearbeiten(
  fassungId: string,
): Promise<FassungZumBearbeiten | null> {
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(fassungId)) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Aus der Kopier-Konstante abgeleitet — dieselbe Feldmenge wie überall sonst.
  const INHALT = [...FASSUNG_INHALT_FELDER, "bild_url", "diagramm"].join(", ");

  // Als `string` (nicht Literal) übergeben: der interpolierte Feldanteil ist
  // zur Compile-Zeit unbekannt, der typisierte Query-Parser kann ihn nicht
  // auswerten — gemappt wird unten ohnehin explizit.
  const select: string = `id, training_id, trainingsteil, hauptteilkategorie, ${INHALT},
       trainings!inner ( id, name, owner_id, team_id, stufen )`;
  const { data: roh, error } = await supabase
    .from("training_exercises")
    .select(select)
    .eq("id", fassungId)
    .maybeSingle();
  if (error) throw error;
  if (!roh) return null;

  // Der Query-Parser kennt die Feldliste nicht (siehe oben) — die Form der
  // Antwort ist durch das Select bestimmt und wird hier einmal benannt.
  type RohInhalt = {
    name: string;
    kategorien: string[] | null;
    erscheinungsform: string[] | null;
    feldtyp: string | null;
    anzahl_kinder: { min?: number | null; max?: number | null } | null;
    material: string[] | null;
    methodischer_fahrplan: Fahrplan | null;
    aufbau: string | null;
    varianten: string[] | null;
    bild_url: string | null;
    bild_quelle: "foto" | "diagramm" | null;
    diagramm: unknown;
  };
  const data = roh as unknown as RohInhalt & {
    id: string;
    training_id: string;
    trainingsteil: string;
    hauptteilkategorie: string | null;
    uebungstyp: string | null;
    trainings: {
      stufen?: string[] | null;
      id: string;
      name: string;
      owner_id: string | null;
      team_id: string | null;
    };
  };

  const training = data.trainings;
  // Dieselbe Regel wie im Editor und in den Fassungs-Actions — eine Quelle.
  if (!bearbeitungszielVon(training, user.id)) return null;

  const q: RohInhalt = data;

  return {
    id: data.id,
    trainingId: data.training_id,
    trainingName: training.name,
    trainingStufen: training.stufen ?? [],
    name: q.name,
    trainingsteil: data.trainingsteil,
    hauptteilkategorie: data.hauptteilkategorie,
    uebungstyp: data.uebungstyp,
    kategorien: q.kategorien ?? [],
    erscheinungsform: q.erscheinungsform ?? [],
    feldtyp: q.feldtyp,
    anzahlKinder: q.anzahl_kinder,
    material: q.material ?? [],
    fahrplan: q.methodischer_fahrplan,
    aufbau: q.aufbau,
    varianten: q.varianten ?? [],
    bildUrl: q.bild_url,
    bildQuelle: q.bild_quelle,
    diagramm: q.diagramm,
  };
}
