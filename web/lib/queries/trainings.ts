import { createClient } from "@/lib/supabase/server";
import { likePattern } from "@/lib/search";
import { TRAININGSTEIL_SLUGS, sortStufen, teilTraegtDauer, hkatRank } from "@/lib/training";
import type { Fahrplan } from "@/lib/queries/exercises";
import type { KategorieSlug, TrainingsteilSlug } from "@/lib/vocab";
import { FASSUNG_INHALT_FELDER } from "@/lib/fassung";

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
  herkunft: Herkunft | null;
};

export type TrainingDetail = {
  id: string;
  name: string;
  ownerId: string | null;
  visibility: "public" | "private";
  stufen: KategorieSlug[];
  /** Die aktive öffentliche Vorlage dieses Trainings, falls veröffentlicht
   *  (Story 14). Nur am persönlichen Original gesetzt, nie an der Vorlage. */
  vorlageId: string | null;
  /** Woraus die Kopie entstanden ist — Name + Zeitpunkt, ohne Person. */
  herkunft: { name: string; datum: string } | null;
  /** Gehört das Training einem Team? Dann steht hier dessen Name (Story 6). */
  team: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Flach, sortiert nach fester Trainingsteil-Reihenfolge, dann Position. */
  exercises: TrainingExerciseItem[];
};

/** Die Inhaltsfelder der Fassung — aus der Kopier-Konstante abgeleitet, damit
 *  ein neues Übungsfeld nicht kopiert, aber hier vergessen werden kann (es
 *  verschwände dann still aus der Anzeige). */
const INHALT_FELDER = [...FASSUNG_INHALT_FELDER, "bild_url", "diagramm"].join(", ");

const PE_SELECT = `
  id, trainingsteil, hauptteilkategorie, position, duration_min,
  herkunft_name, herkunft_typ, herkunft_datum,
  ${INHALT_FELDER}
`;

const TRAINING_SELECT = `id, name, owner_id, visibility, stufen, team_id, vorlage_id, herkunft_name, herkunft_datum, created_at, updated_at, training_exercises ( ${PE_SELECT} )`;

/** Die Inhaltsfelder, wie sie aus der Zuordnung zurückkommen. */
type RawInhalt = {
  name: string;
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
};
type RawTraining = {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "public" | "private";
  stufen: string[];
  team_id: string | null;
  vorlage_id: string | null;
  herkunft_name: string | null;
  herkunft_datum: string | null;
  created_at: string;
  updated_at: string;
  training_exercises: RawTrainingExercise[];
  /** Nur der Editor lädt den Teamnamen mit (PostgREST-Embed). */
  teams?: { name: string } | null;
};

const teilRank = (t: string) => {
  const i = TRAININGSTEIL_SLUGS.indexOf(t as TrainingsteilSlug);
  return i === -1 ? 99 : i;
};

function mapTraining(raw: RawTraining): TrainingDetail {
  const exercises: TrainingExerciseItem[] = (raw.training_exercises ?? [])
    .map((te) => {
      return {
        id: te.id,
        trainingsteil: te.trainingsteil as TrainingsteilSlug,
        hauptteilkategorie: te.hauptteilkategorie,
        position: te.position,
        durationMin: te.duration_min,
        name: te.name,
        kategorien: te.kategorien ?? [],
        erscheinungsform: te.erscheinungsform ?? [],
        feldtyp: te.feldtyp,
        anzahlKinder: te.anzahl_kinder,
        material: te.material ?? [],
        fahrplan: te.methodischer_fahrplan,
        aufbau: te.aufbau,
        bildUrl: te.bild_url,
        bildQuelle: te.bild_quelle,
        diagramm: te.diagramm,
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
    vorlageId: raw.vorlage_id,
    herkunft:
      raw.herkunft_name && raw.herkunft_datum
        ? { name: raw.herkunft_name, datum: raw.herkunft_datum }
        : null,
    team: raw.team_id ? { id: raw.team_id, name: raw.teams?.name ?? "Team" } : null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    exercises,
  };
}

/** Training für den Editor: das eigene PRIVATE Training oder ein Training des
 *  eigenen Teams (Team-Epic Story 6). `null`, wenn es das Training nicht gibt,
 *  der USER es nicht bearbeiten darf oder es eine veröffentlichte Vorlage ist —
 *  Vorlagen sind eingefroren (Story 14), die RLS kennt für sie keine
 *  Update-Policy.
 *
 *  Die SELECT-Policy lässt Team-Trainings nur bei Mitgliedern durch; der
 *  Filter hier grenzt lediglich die fremden öffentlichen Vorlagen aus, die
 *  jeder lesen darf. */
export async function getTrainingForEdit(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select(`${TRAINING_SELECT}, teams ( name )`)
    .eq("id", id)
    .eq("visibility", "private")
    .or(`owner_id.eq.${user.id},team_id.not.is.null`)
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

// ── Team-Trainings (Team-Epic Story 5) ───────────────────────────────────────

/** Ein Team-Training im Bestand des Teams. Wie eine Pool-Zeile, zusätzlich mit
 *  der Herkunft — «basiert auf …» sagt, woraus die Kopie entstanden ist. */
export type TeamTrainingRow = TrainingListRow & {
  herkunft: { name: string; datum: string } | null;
};

const TEAM_LIST_SELECT = `${LIST_SELECT}, herkunft_name, herkunft_datum`;

/** Der Trainingsbestand eines Teams. Team-Trainings erscheinen NIE im
 *  Trainings-Pool — sie gehören dem Team, nicht der Öffentlichkeit und keiner
 *  Person. Sichtbar sind sie nur Mitgliedern; das setzt die RLS durch. */
export async function getTeamTrainings(teamId: string): Promise<TeamTrainingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainings")
    .select(TEAM_LIST_SELECT)
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false })
    .order("id");
  if (error) throw error;

  return (data ?? []).map((raw) => {
    const r = raw as unknown as RawListTraining & {
      herkunft_name: string | null;
      herkunft_datum: string | null;
    };
    return {
      ...mapListRow(r),
      herkunft:
        r.herkunft_name && r.herkunft_datum
          ? { name: r.herkunft_name, datum: r.herkunft_datum }
          : null,
    };
  });
}
