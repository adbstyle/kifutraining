import { createClient } from "@/lib/supabase/server";
import type { Fahrplan } from "@/lib/queries/exercises";
import { FASSUNG_INHALT_FELDER, type HerkunftTyp } from "@/lib/fassung";

/** Eine Fassung zum Bearbeiten — im eigenen privaten Training oder in einem
 *  Training des eigenen Teams (Team-Epic Story 6). `null`, wenn sie nicht
 *  existiert oder der USER sie nicht bearbeiten darf. */
export type FassungZumBearbeiten = {
  id: string;
  trainingId: string;
  trainingName: string;
  name: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
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
  herkunft: { name: string; typ: HerkunftTyp; datum: string } | null;
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
       herkunft_name, herkunft_typ, herkunft_datum,
       trainings!inner ( id, name, owner_id, team_id, visibility )`;
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
    herkunft_name: string | null;
    herkunft_typ: string | null;
    herkunft_datum: string | null;
    trainings: {
      id: string;
      name: string;
      owner_id: string | null;
      team_id: string | null;
      visibility: string;
    };
  };

  const training = data.trainings;
  // Bearbeitbar ist das eigene PRIVATE Training oder eines des eigenen Teams;
  // eine öffentliche Vorlage ist eingefroren. Team-Trainings lässt die RLS nur
  // Mitglieder überhaupt lesen.
  const bearbeitbar =
    !!training.team_id ||
    (training.owner_id === user.id && training.visibility === "private");
  if (!bearbeitbar) return null;

  const q: RohInhalt = data;

  return {
    id: data.id,
    trainingId: data.training_id,
    trainingName: training.name,
    name: q.name,
    trainingsteil: data.trainingsteil,
    hauptteilkategorie: data.hauptteilkategorie,
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
    herkunft:
      data.herkunft_name && data.herkunft_typ && data.herkunft_datum
        ? { name: data.herkunft_name, typ: data.herkunft_typ as HerkunftTyp, datum: data.herkunft_datum }
        : null,
  };
}
