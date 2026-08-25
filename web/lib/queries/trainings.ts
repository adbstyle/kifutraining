import { createClient } from "@/lib/supabase/server";
import { likePattern } from "@/lib/search";
import { TRAININGSTEIL_SLUGS, sortStufen, teilTraegtDauer, hkatRank } from "@/lib/training";
import type { Fahrplan } from "@/lib/queries/exercises";
import type { KategorieSlug, TrainingsteilSlug } from "@/lib/vocab";
import { FASSUNG_INHALT_FELDER } from "@/lib/fassung";
import { kurzeZeit } from "@/lib/queries/termine";

/**
 * Query-Layer für Trainings — der EINZIGE Datenpfad zu `trainings`
 * und `training_exercises`. RLS filtert serverseitig: ein öffentliches Training darf
 * jeder lesen, ein privates nur sein Eigentümer (Story #9 AC12).
 *
 * Seit dem Fassungs-Modell (Epic #72) trägt die Zuordnung ihre Übungsinhalte
 * selbst. Sie hängt damit an genau einer RLS-Kette — die frühere Situation, dass
 * eine Übung im lesbaren Training unsichtbar sein konnte, gibt es nicht mehr.
 */

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
  /** Gehört das Training einem Team? Dann steht hier dessen Name (Story 6). */
  team: { id: string; name: string } | null;
  /** Anzeigename des Urhebers; `null` bei anonymisierten Vorlagen (Story 15). */
  urheber: string | null;
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
  ${INHALT_FELDER}
`;

const TRAINING_SELECT = `id, name, owner_id, visibility, stufen, team_id, vorlage_id, urheber, created_at, updated_at, training_exercises ( ${PE_SELECT} )`;

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
};
type RawTraining = {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "public" | "private";
  stufen: string[];
  team_id: string | null;
  vorlage_id: string | null;
  urheber: string | null;
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
    team: raw.team_id ? { id: raw.team_id, name: raw.teams?.name ?? "Team" } : null,
    urheber: raw.urheber ?? null,
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
  /** Facette: statt der öffentlichen Vorlagen die eigenen privaten Trainings. */
  mine?: boolean;
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
  /** Anzeigename des Urhebers; `null` bei anonymisierten Vorlagen (Story 15). */
  urheber: string | null;
};

type RawListTraining = {
  id: string;
  name: string;
  visibility: "public" | "private";
  stufen: string[];
  updated_at: string;
  urheber: string | null;
  training_exercises: { trainingsteil: string; duration_min: number | null }[];
};

// `urheber` ist ein berechnetes PostgREST-Feld (SQL-Funktion über trainings) —
// es liefert den Anzeigenamen, nie die E-Mail-Adresse.
const LIST_SELECT =
  "id, name, visibility, stufen, updated_at, urheber, training_exercises ( trainingsteil, duration_min )";

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
    urheber: raw.urheber ?? null,
  };
}

/** Trainings-Pool — die Trainings-Einstiegsansicht (analog zum Übungspool).
 *
 *  Standardmässig die öffentlichen Vorlagen: der Bestand, aus dem sich jede und
 *  jeder bedienen kann, auch ohne Konto. Die Facette `mine` zeigt stattdessen
 *  die eigenen privaten Trainings — die eigene Werkbank. Team-Trainings kommen
 *  in keiner der beiden Ansichten vor; sie leben im Team-Bereich (Story 12).
 *
 *  Ohne Suche nach Aktualität; mit Suche nach Namens-Relevanz (kürzerer Name
 *  ⇒ näher am Begriff) sortiert. */
export async function getTrainingPool(
  f: TrainingListFilters = {},
): Promise<TrainingListRow[]> {
  const supabase = await createClient();
  let query = supabase.from("trainings").select(LIST_SELECT);

  // Zwei klar getrennte Ansichten (Story 12):
  //   Standard        — die öffentlichen Vorlagen, auch für Besucher ohne Konto.
  //   „Meine Trainings" — die eigenen privaten Trainings.
  // Team-Trainings erscheinen in KEINER von beiden: sie gehören dem Team und
  // leben im Team-Bereich. Der Standardfilter schliesst sie aus (sie sind nie
  // öffentlich), die Facette ebenso (sie haben keinen owner_id).
  if (f.mine) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    query = query.eq("owner_id", user.id).eq("visibility", "private");
  } else {
    query = query.eq("visibility", "public");
  }
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
 *  dem Termin, falls es angesetzt ist. */
export type TeamTrainingRow = TrainingListRow & {
  /** Der Termin dieses Trainings, falls es angesetzt ist. Höchstens einer je
   *  Training — eine weitere Einheit entsteht als Kopie (Story 8). Beginn, Ort
   *  und Bemerkung dienen als Vorbelegung beim erneuten Ansetzen, damit der
   *  Weg aus dem Bestand derselbe ist wie aus dem Plan (Story 16 AK 3). */
  termin: {
    id: string;
    beginn: string | null;
    ort: string | null;
    bemerkung: string | null;
  } | null;
};

const TEAM_LIST_SELECT = `${LIST_SELECT}, training_termine ( id, beginn, ort, bemerkung )`;

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
    // Bewusst eigener Name: `RawTermin` in queries/termine.ts bezeichnet die
    // vollständige Termin-Zeile, hier stehen nur die Felder der Vorbelegung.
    type RawTerminVorbelegung = {
      id: string;
      beginn: string | null;
      ort: string | null;
      bemerkung: string | null;
    };
    const r = raw as unknown as RawListTraining & {
      // PostgREST erkennt die UNIQUE-Bedingung auf `training_id` und liefert
      // den Termin deshalb als EIN Objekt statt als Liste. Beide Formen
      // abfangen: eine spätere Schema-Änderung soll hier keinen stillen
      // Nulltreffer erzeugen.
      training_termine: RawTerminVorbelegung | RawTerminVorbelegung[] | null;
    };
    const termin = Array.isArray(r.training_termine)
      ? r.training_termine[0]
      : r.training_termine;
    return {
      ...mapListRow(r),
      termin: termin
        ? {
            id: termin.id,
            beginn: kurzeZeit(termin.beginn),
            ort: termin.ort,
            bemerkung: termin.bemerkung,
          }
        : null,
    };
  });
}
