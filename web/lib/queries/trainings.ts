import { createClient } from "@/lib/supabase/server";
import { likePattern } from "@/lib/search";
import { TRAININGSTEIL_SLUGS, sortStufen, teilTraegtDauer, hkatRank } from "@/lib/training";
import type { Fahrplan } from "@/lib/queries/exercises";
import type { KategorieSlug, TrainingsteilSlug } from "@/lib/vocab";

/**
 * Query-Layer für Trainings — der EINZIGE Datenpfad zu `trainings`
 * und `training_exercises`. RLS filtert serverseitig: ein öffentliches Training darf
 * jeder lesen, ein privates nur sein Eigentümer (Story #9 AC12).
 *
 * Seit dem Fassungs-Modell (Epic #72) trägt die Zuordnung ihre Übungsinhalte
 * selbst. Sie hängt damit an genau einer RLS-Kette — die frühere Situation, dass
 * eine Übung im lesbaren Training unsichtbar sein konnte, gibt es nicht mehr.
 */

/** Woraus eine Fassung entstanden ist — unveränderlich, reine Angabe. */
export type Herkunft = {
  name: string;
  typ: "manual" | "community" | "eigen";
  datum: string;
};

export type TrainingExerciseItem = {
  /** training_exercises.id (die Zuordnung, also die Fassung selbst). */
  id: string;
  trainingsteil: TrainingsteilSlug;
  /** Nur Hauptteil-Fassungen tragen eine Kategorie. */
  hauptteilkategorie: string | null;
  position: number;
  durationMin: number | null;
  name: string;
  kategorien: string[];
  erscheinungsform: string[];
  feldtyp: string | null;
  anzahlKinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  fahrplan: Fahrplan | null;
  aufbau: string | null;
  bildUrl: string | null;
  bildQuelle: "foto" | "diagramm" | null;
  diagramm: unknown;
  /** `null` nur bei Fassungen, die noch nicht überführt sind. */
  herkunft: Herkunft | null;
};

export type TrainingDetail = {
  id: string;
  name: string;
  ownerId: string | null;
  visibility: "public" | "private";
  stufen: KategorieSlug[];
  createdAt: string;
  updatedAt: string;
  /** Flach, sortiert nach fester Trainingsteil-Reihenfolge, dann Position. */
  exercises: TrainingExerciseItem[];
};

/** Inhaltsfelder, die Fassung und Bibliotheks-Übung gleich benennen. Genau
 *  darum genügt beim Lesen eine Quelle-Weiche statt zweier Mappings. */
const INHALT_FELDER = `name, kategorien, erscheinungsform, feldtyp, anzahl_kinder,
  material, methodischer_fahrplan, aufbau, bild_url, bild_quelle, diagramm`;

// Der Embed auf `exercises` ist die Brücke für das Auslieferungsfenster: die
// Bestand-Überführung läuft als Migration und kann dem App-Deploy um Minuten
// nachlaufen. Solange eine Zuordnung noch nicht überführt ist (`name is null`),
// liefert die referenzierte Übung die Inhalte, damit kein Training leer
// erscheint. Entfällt mit dem Verweis-Abbau.
const PE_SELECT = `
  id, trainingsteil, hauptteilkategorie, position, duration_min,
  herkunft_name, herkunft_typ, herkunft_datum, exercise_name_cache,
  ${INHALT_FELDER},
  exercises ( ${INHALT_FELDER} )
`;

const TRAINING_SELECT = `id, name, owner_id, visibility, stufen, created_at, updated_at, training_exercises ( ${PE_SELECT} )`;

/** Die Inhaltsfelder, wie sie aus beiden Tabellen zurückkommen. */
type RawInhalt = {
  name: string | null;
  kategorien: string[] | null;
  erscheinungsform: string[] | null;
  feldtyp: string | null;
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  material: string[] | null;
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  bild_url: string | null;
  bild_quelle: "foto" | "diagramm" | null;
  diagramm: unknown;
};

type RawTrainingExercise = RawInhalt & {
  id: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  position: number;
  duration_min: number | null;
  herkunft_name: string | null;
  herkunft_typ: "manual" | "community" | "eigen" | null;
  herkunft_datum: string | null;
  exercise_name_cache: string | null;
  exercises: RawInhalt | null;
};
type RawTraining = {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "public" | "private";
  stufen: string[];
  created_at: string;
  updated_at: string;
  training_exercises: RawTrainingExercise[];
};

const teilRank = (t: string) => {
  const i = TRAININGSTEIL_SLUGS.indexOf(t as TrainingsteilSlug);
  return i === -1 ? 99 : i;
};

function mapTraining(raw: RawTraining): TrainingDetail {
  const exercises: TrainingExerciseItem[] = (raw.training_exercises ?? [])
    .map((te) => {
      // Die Fassung ist die Quelle; nur eine noch nicht überführte Zuordnung
      // greift auf die referenzierte Übung zurück (siehe PE_SELECT).
      const q: RawInhalt = te.name != null ? te : (te.exercises ?? te);
      return {
        id: te.id,
        trainingsteil: te.trainingsteil as TrainingsteilSlug,
        hauptteilkategorie: te.hauptteilkategorie,
        position: te.position,
        durationMin: te.duration_min,
        name: q.name ?? te.exercise_name_cache ?? "Unbenannte Übung",
        kategorien: q.kategorien ?? [],
        erscheinungsform: q.erscheinungsform ?? [],
        feldtyp: q.feldtyp,
        anzahlKinder: q.anzahl_kinder,
        material: q.material ?? [],
        fahrplan: q.methodischer_fahrplan,
        aufbau: q.aufbau,
        bildUrl: q.bild_url,
        bildQuelle: q.bild_quelle,
        diagramm: q.diagramm,
        herkunft:
          te.herkunft_name && te.herkunft_typ && te.herkunft_datum
            ? { name: te.herkunft_name, typ: te.herkunft_typ, datum: te.herkunft_datum }
            : null,
      };
    })
    // Sortierung: Trainingsteil-Reihenfolge, im Hauptteil zusätzlich nach
    // Unterkategorie (Positionen sind dort pro Unterkategorie eindeutig), dann
    // Position.
    .sort((a, b) => {
      if (a.trainingsteil !== b.trainingsteil)
        return teilRank(a.trainingsteil) - teilRank(b.trainingsteil);
      const hk = hkatRank(a.hauptteilkategorie) - hkatRank(b.hauptteilkategorie);
      return hk !== 0 ? hk : a.position - b.position;
    });

  return {
    id: raw.id,
    name: raw.name,
    ownerId: raw.owner_id,
    visibility: raw.visibility,
    stufen: sortStufen(raw.stufen ?? []),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    exercises,
  };
}

/** Training für den Editor — ausschliesslich für den Eigentümer. `null`, wenn
 *  das Training nicht existiert oder dem USER nicht gehört. */
export async function getTrainingForEdit(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select(TRAINING_SELECT)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTraining(data as unknown as RawTraining) : null;
}

/** Training zum Ansehen (Story #7/#9/#10) — RLS gibt öffentliche Trainings jedem und
 *  private nur dem Eigentümer frei. `null` ⇒ „nicht verfügbar" (privat-fremd,
 *  nicht existent — ununterscheidbar, Story #7 Postcondition 2). */
export async function getTrainingView(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select(TRAINING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTraining(data as unknown as RawTraining) : null;
}

// ── Übersichten (eigene Trainings / Trainings-Pool) ───────────────────────────────────

export type TrainingListFilters = {
  q?: string;
  stufen?: string[]; // Überlappung
  visibility?: "public" | "private"; // eigene Übersicht + Pool-Eingrenzung
  mine?: boolean; // nur eigene Trainings (owner == aktueller USER) — nur im Pool
};

export type TrainingListRow = {
  id: string;
  name: string;
  visibility: "public" | "private";
  stufen: KategorieSlug[];
  updatedAt: string;
  exerciseCount: number;
  /** Summe der erfassten Dauern (Übungen ohne Dauer zählen nicht). */
  totalDuration: number;
  /** Trägt mindestens eine Zuordnung eine erfasste Dauer? */
  hasAnyDuration: boolean;
};

type RawListTraining = {
  id: string;
  name: string;
  visibility: "public" | "private";
  stufen: string[];
  updated_at: string;
  training_exercises: { trainingsteil: string; duration_min: number | null }[];
};

const LIST_SELECT =
  "id, name, visibility, stufen, updated_at, training_exercises ( trainingsteil, duration_min )";

function mapListRow(raw: RawListTraining): TrainingListRow {
  const rows = raw.training_exercises ?? [];
  // Auffangen trägt keine Dauer und zählt nicht zur Summe.
  const withDuration = rows
    .filter((p) => teilTraegtDauer(p.trainingsteil as TrainingsteilSlug))
    .map((p) => p.duration_min)
    .filter((d): d is number => d != null);
  return {
    id: raw.id,
    name: raw.name,
    visibility: raw.visibility,
    stufen: sortStufen(raw.stufen ?? []),
    updatedAt: raw.updated_at,
    exerciseCount: rows.length,
    totalDuration: withDuration.reduce((a, d) => a + d, 0),
    hasAnyDuration: withDuration.length > 0,
  };
}

/** Trainings-Pool — die Trainings-Einstiegsansicht (analog zum Übungspool).
 *  Ohne Owner-/Sichtbarkeitsfilter liefert die RLS genau die für den Betrachter
 *  lesbare Menge: alle öffentlichen Trainings (der Community wie eigene) plus die
 *  eigenen privaten. So profitiert der Trainer von geteilten Trainings und sieht
 *  zugleich seine Entwürfe an einem Ort.
 *
 *  Optionale Eingrenzung: `mine` auf die selbst erstellten Trainings, `visibility`
 *  auf öffentlich bzw. privat. Ohne Suche nach Aktualität; mit Suche nach
 *  Namens-Relevanz (kürzerer Name ⇒ näher am Begriff) sortiert. */
export async function getTrainingPool(
  f: TrainingListFilters = {},
): Promise<TrainingListRow[]> {
  const supabase = await createClient();
  let query = supabase.from("trainings").select(LIST_SELECT);

  // „Nur meine": eigene Trainings; anonym gibt es keine -> leere Liste.
  if (f.mine) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    query = query.eq("owner_id", user.id);
  }
  if (f.visibility) query = query.eq("visibility", f.visibility);
  if (f.stufen?.length) query = query.overlaps("stufen", f.stufen);

  const hasQuery = !!f.q?.trim();
  if (hasQuery) {
    query = query.ilike("search_text", likePattern(f.q!));
  } else {
    query = query.order("updated_at", { ascending: false }).order("id");
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r) => mapListRow(r as unknown as RawListTraining));

  // Relevanz-Sortierung bei aktiver Suche: kürzerer Treffer zuerst, dann Name.
  if (hasQuery) {
    rows.sort(
      (a, b) =>
        a.name.length - b.name.length || a.name.localeCompare(b.name, "de"),
    );
  }
  return rows;
}
