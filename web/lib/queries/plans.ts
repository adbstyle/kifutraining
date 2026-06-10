import { createClient } from "@/lib/supabase/server";
import { likePattern } from "@/lib/search";
import { TRAININGSTEIL_SLUGS, sortStufen, teilTraegtDauer, hkatRank } from "@/lib/plan";
import type { Fahrplan } from "@/lib/queries/exercises";
import type { KategorieSlug, TrainingsteilSlug } from "@/lib/vocab";

/**
 * Query-Layer für Trainingspläne — der EINZIGE Datenpfad zu `training_plans`
 * und `plan_exercises`. RLS filtert serverseitig: einen öffentlichen Plan darf
 * jeder lesen, einen privaten nur sein Eigentümer (Story #9 AC12). Eingebettete
 * Übungen unterliegen ebenfalls der RLS — eine für den Betrachter nicht
 * sichtbare Übung kommt als `null` zurück und fällt auf den zwischengespeicherten
 * Namen zurück (Platzhalter, Story #9 AC10).
 */

/** Vollständige Übungsfelder, soweit eine Plan-Ansicht sie braucht (Durchführung,
 *  Druck, Detail-Link). `null`, wenn die Übung für den Betrachter nicht sichtbar
 *  oder gelöscht ist. */
export type PlanExerciseExercise = {
  id: string;
  slug: string;
  name: string;
  trainingsteil: string;
  kategorien: string[];
  visibility: "public" | "private";
  source: "manual" | "user";
  feldtyp: string | null;
  hauptteilkategorie: string | null;
  erscheinungsform: string[];
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  bild_url: string | null;
  owner_id: string | null;
};

export type PlanExerciseItem = {
  /** plan_exercises.id (die Zuordnung selbst). */
  id: string;
  trainingsteil: TrainingsteilSlug;
  /** Snapshot der Hauptteilkategorie (nur Hauptteil-Zuordnungen; placeholder-fest
   *  aus `plan_exercises`, nicht aus der ggf. unsichtbaren Übung). */
  hauptteilkategorie: string | null;
  position: number;
  durationMin: number | null;
  exerciseId: string | null;
  /** Aufgelöster Anzeigename: die Übung, sonst der Platzhalter-Cache. */
  name: string;
  /** Ist die referenzierte Übung für den Betrachter aufrufbar? */
  available: boolean;
  exercise: PlanExerciseExercise | null;
};

export type PlanDetail = {
  id: string;
  name: string;
  ownerId: string | null;
  visibility: "public" | "private";
  stufen: KategorieSlug[];
  createdAt: string;
  updatedAt: string;
  /** Flach, sortiert nach fester Trainingsteil-Reihenfolge, dann Position. */
  exercises: PlanExerciseItem[];
};

const PE_SELECT = `
  id, trainingsteil, hauptteilkategorie, position, duration_min, exercise_id, exercise_name_cache,
  exercises (
    id, slug, name, trainingsteil, kategorien, visibility, source,
    feldtyp, hauptteilkategorie, erscheinungsform, anzahl_kinder, material,
    methodischer_fahrplan, aufbau, bild_url, owner_id
  )
`;

const PLAN_SELECT = `id, name, owner_id, visibility, stufen, created_at, updated_at, plan_exercises ( ${PE_SELECT} )`;

type RawExercise = PlanExerciseExercise | null;
type RawPlanExercise = {
  id: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  position: number;
  duration_min: number | null;
  exercise_id: string | null;
  exercise_name_cache: string | null;
  exercises: RawExercise;
};
type RawPlan = {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "public" | "private";
  stufen: string[];
  created_at: string;
  updated_at: string;
  plan_exercises: RawPlanExercise[];
};

const teilRank = (t: string) => {
  const i = TRAININGSTEIL_SLUGS.indexOf(t as TrainingsteilSlug);
  return i === -1 ? 99 : i;
};

function mapPlan(raw: RawPlan): PlanDetail {
  const exercises: PlanExerciseItem[] = (raw.plan_exercises ?? [])
    .map((pe) => {
      const ex = pe.exercises;
      return {
        id: pe.id,
        trainingsteil: pe.trainingsteil as TrainingsteilSlug,
        hauptteilkategorie: pe.hauptteilkategorie,
        position: pe.position,
        durationMin: pe.duration_min,
        exerciseId: pe.exercise_id,
        name: ex?.name ?? pe.exercise_name_cache ?? "Unbenannte Übung",
        available: ex != null,
        exercise: ex,
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

/** Plan für den Editor — ausschliesslich für den Eigentümer. `null`, wenn der
 *  Plan nicht existiert oder dem USER nicht gehört. */
export async function getPlanForEdit(id: string): Promise<PlanDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("training_plans")
    .select(PLAN_SELECT)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPlan(data as unknown as RawPlan) : null;
}

/** Plan zum Ansehen (Story #7/#9/#10) — RLS gibt öffentliche Pläne jedem und
 *  private nur dem Eigentümer frei. `null` ⇒ „nicht verfügbar" (privat-fremd,
 *  nicht existent — ununterscheidbar, Story #7 Postcondition 2). */
export async function getPlanView(id: string): Promise<PlanDetail | null> {
  const supabase = await createClient();
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("training_plans")
    .select(PLAN_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPlan(data as unknown as RawPlan) : null;
}

// ── Übersichten (eigene Pläne / Plan-Pool) ───────────────────────────────────

export type PlanListFilters = {
  q?: string;
  stufen?: string[]; // Überlappung
  visibility?: "public" | "private"; // eigene Übersicht + Pool-Eingrenzung
  mine?: boolean; // nur eigene Pläne (owner == aktueller USER) — nur im Pool
};

export type PlanListRow = {
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

type RawListPlan = {
  id: string;
  name: string;
  visibility: "public" | "private";
  stufen: string[];
  updated_at: string;
  plan_exercises: { trainingsteil: string; duration_min: number | null }[];
};

const LIST_SELECT =
  "id, name, visibility, stufen, updated_at, plan_exercises ( trainingsteil, duration_min )";

function mapListRow(raw: RawListPlan): PlanListRow {
  const rows = raw.plan_exercises ?? [];
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

/** Ausschliesslich die eigenen Pläne des angemeldeten Trainers (Story #13). */
export async function getMyPlans(
  f: PlanListFilters = {},
): Promise<PlanListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("training_plans")
    .select(LIST_SELECT)
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    // deterministische Sekundärsortierung bei gleichem Änderungszeitpunkt
    .order("id", { ascending: true });

  if (f.visibility) query = query.eq("visibility", f.visibility);
  if (f.stufen?.length) query = query.overlaps("stufen", f.stufen);
  if (f.q?.trim()) query = query.ilike("search_text", likePattern(f.q));

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => mapListRow(r as unknown as RawListPlan));
}

/** Plan-Pool — die Trainingsplaner-Einstiegsansicht (analog zum Übungspool).
 *  Ohne Owner-/Sichtbarkeitsfilter liefert die RLS genau die für den Betrachter
 *  lesbare Menge: alle öffentlichen Pläne (der Community wie eigene) plus die
 *  eigenen privaten. So profitiert der Trainer von geteilten Plänen und sieht
 *  zugleich seine Entwürfe an einem Ort.
 *
 *  Optionale Eingrenzung: `mine` auf die selbst erstellten Pläne, `visibility`
 *  auf öffentlich bzw. privat. Ohne Suche nach Aktualität; mit Suche nach
 *  Namens-Relevanz (kürzerer Name ⇒ näher am Begriff) sortiert. */
export async function getPlanPool(
  f: PlanListFilters = {},
): Promise<PlanListRow[]> {
  const supabase = await createClient();
  let query = supabase.from("training_plans").select(LIST_SELECT);

  // „Nur meine": eigene Pläne; anonym gibt es keine -> leere Liste.
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
  const rows = (data ?? []).map((r) => mapListRow(r as unknown as RawListPlan));

  // Relevanz-Sortierung bei aktiver Suche: kürzerer Treffer zuerst, dann Name.
  if (hasQuery) {
    rows.sort(
      (a, b) =>
        a.name.length - b.name.length || a.name.localeCompare(b.name, "de"),
    );
  }
  return rows;
}
