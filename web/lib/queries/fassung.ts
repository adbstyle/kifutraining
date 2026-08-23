import { createClient } from "@/lib/supabase/server";
import type { Fahrplan } from "@/lib/queries/exercises";

/** Eine Fassung zum Bearbeiten — ausschliesslich für den Eigentümer ihres
 *  Trainings. `null`, wenn sie nicht existiert oder dem USER nicht gehört. */
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
  herkunft: { name: string; typ: string; datum: string } | null;
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

  const INHALT = `name, kategorien, erscheinungsform, feldtyp, anzahl_kinder,
    material, methodischer_fahrplan, aufbau, varianten, bild_url, bild_quelle, diagramm`;

  const { data, error } = await supabase
    .from("training_exercises")
    .select(
      `id, training_id, trainingsteil, hauptteilkategorie, ${INHALT},
       herkunft_name, herkunft_typ, herkunft_datum,
       trainings!inner ( id, name, owner_id ),
       exercises ( ${INHALT} )`,
    )
    .eq("id", fassungId)
    .eq("trainings.owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const training = data.trainings as unknown as { id: string; name: string };
  // Dieselbe Brücke wie im Anzeige-Pfad: eine noch nicht überführte Zuordnung
  // liefert ihre Inhalte über die referenzierte Übung, damit das Formular im
  // Auslieferungsfenster nicht leer erscheint. Entfällt mit dem Verweis-Abbau.
  const q = (data.name != null
    ? data
    : ((data.exercises as unknown as Record<string, unknown> | null) ?? data)) as typeof data;

  return {
    id: data.id,
    trainingId: data.training_id,
    trainingName: training.name,
    name: q.name ?? "Unbenannte Übung",
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
        ? { name: data.herkunft_name, typ: data.herkunft_typ, datum: data.herkunft_datum }
        : null,
  };
}
