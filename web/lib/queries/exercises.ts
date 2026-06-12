import { createClient } from "@/lib/supabase/server";
import {
  trainingsteil as trainingsteilLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import { likePattern } from "@/lib/search";
import type { ExerciseCardData } from "@/components/ui";

/**
 * Query-Layer für Übungen — der EINZIGE Datenpfad zu `exercises`
 * (Architektur §6). RLS filtert serverseitig: anonym nur `public`,
 * eingeloggt zusätzlich eigene private Übungen (Story 3 EK12/13).
 */

export type ExerciseFilters = {
  teil?: string[]; // Trainingsteil (OR)
  kat?: string[]; // Alterskategorien G/F/E (Überlappung)
  feld?: string[]; // Feldtyp (OR)
  form?: string[]; // Erscheinungsform (Überlappung)
  hkat?: string[]; // Hauptteilkategorie (OR)
  kinder?: number; // verfügbare Gruppengrösse
  q?: string; // Freitext
  fav?: boolean; // nur eigene Favoriten (nur angemeldet wirksam)
  mine?: boolean; // nur eigene Übungen (nur angemeldet wirksam)
};

// Felder, die Liste + Karte brauchen.
const LIST_COLUMNS =
  "id, slug, name, trainingsteil, feldtyp, hauptteilkategorie, kategorien, source, visibility, bild_url, diagramm, bild_quelle";

export type ExerciseListRow = {
  id: string;
  slug: string;
  name: string;
  trainingsteil: string;
  feldtyp: string | null;
  hauptteilkategorie: string | null;
  kategorien: string[];
  source: "manual" | "user";
  visibility: "public" | "private";
  bild_url: string | null;
  diagramm: unknown;
  bild_quelle: "foto" | "diagramm" | null;
  /** Hat der aktuelle USER diese Übung favorisiert? (false wenn anonym) */
  is_favorited: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Übungs-IDs, die der angemeldete USER favorisiert hat. RLS liefert nur eigene
 *  Favoriten — anonyme Aufrufer bekommen ein leeres Set. */
async function getFavoriteIds(
  supabase: SupabaseServerClient,
  userId: string | undefined,
): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from("exercise_favorites")
    .select("exercise_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.exercise_id));
}

/** Übungen gemäss gesetzten Filtern. Dimensionen sind mit UND verknüpft,
 *  mehrere Werte innerhalb einer Dimension mit ODER (Story 3 EK9). */
export async function getExercises(
  f: ExerciseFilters = {},
): Promise<ExerciseListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favIds = await getFavoriteIds(supabase, user?.id);

  // Favoriten-Filter ist nur angemeldet wirksam; ohne Favoriten -> leere Liste.
  if (f.fav) {
    if (!user || favIds.size === 0) return [];
  }
  // „Nur meine Übungen" ist ebenfalls nur angemeldet wirksam.
  if (f.mine && !user) return [];

  let query = supabase.from("exercises").select(LIST_COLUMNS).order("name");

  // Filter serverseitig per ID-Liste (kombiniert sauber mit Suche/Filtern).
  // Bei sehr vielen Favoriten könnte die Query-URL lang werden; im
  // Kinderfussball-Kontext unkritisch. Sonst später als JOIN/View lösen.
  if (f.fav) query = query.in("id", [...favIds]);
  // Eigene Übungen: öffentliche wie private, keine fremden/Manual-Übungen.
  if (f.mine && user) query = query.eq("owner_id", user.id);
  if (f.teil?.length) query = query.in("trainingsteil", f.teil);
  if (f.kat?.length) query = query.overlaps("kategorien", f.kat);
  if (f.feld?.length) query = query.in("feldtyp", f.feld);
  if (f.form?.length) query = query.overlaps("erscheinungsform", f.form);
  // Hauptteilkategorie: ODER über die gewählten Werte. Da nur Hauptteil-Übungen
  // eine tragen, grenzt ein gesetzter Filter faktisch auf den Hauptteil ein (#22).
  if (f.hkat?.length) query = query.in("hauptteilkategorie", f.hkat);
  // Gruppengrösse: durchführbar, wenn die Mindestzahl <= verfügbar ist
  // oder gar keine Mindestzahl angegeben ist (EK6).
  if (typeof f.kinder === "number" && Number.isFinite(f.kinder)) {
    query = query.or(`anzahl_kinder_min.lte.${f.kinder},anzahl_kinder_min.is.null`);
  }
  if (f.q?.trim()) {
    // Teilstring-Suche über alle Übungstexte (Name, Aufbau, Fahrplan,
    // Material, Varianten via `search_text`-Trigger). Findet auch Wortteile
    // und Komposita — "Hand" matcht "Handball". Sonderzeichen werden als
    // Literal maskiert, damit Eingaben wie "100%" nicht als Wildcard wirken.
    query = query.ilike("search_text", likePattern(f.q));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    is_favorited: favIds.has(row.id),
  })) as ExerciseListRow[];
}

export type Fahrplan = {
  offen_starten: string;
  ueben?: string[];
  wetteifern?: string | null;
};

export type ExerciseDetail = {
  id: string;
  slug: string;
  name: string;
  trainingsteil: string;
  erscheinungsform: string[];
  hauptteilkategorie: string | null;
  feldtyp: string | null;
  kategorien: string[];
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  varianten: string[];
  bild_url: string | null;
  diagramm: unknown;
  bild_quelle: "foto" | "diagramm" | null;
  source: "manual" | "user";
  visibility: "public" | "private";
  owner_id: string | null;
};

/** Eine Übung per Slug (volle Felder). RLS blendet private Übungen für
 *  Nicht-Eigentümer aus -> null (Story 4 Postcondition). */
export async function getExerciseDetail(
  slug: string,
): Promise<ExerciseDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, slug, name, trainingsteil, erscheinungsform, hauptteilkategorie, feldtyp, kategorien, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_url, diagramm, bild_quelle, source, visibility, owner_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as ExerciseDetail | null) ?? null;
}

/** Hat der angemeldete USER diese Übung favorisiert? (Detailseite) */
export async function isFavorited(exerciseId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("exercise_favorites")
    .select("exercise_id")
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** DB-Zeile -> Karten-Props (Labels aus dem Vokabular). */
export function toCardData(row: ExerciseListRow): ExerciseCardData {
  return {
    slug: row.slug,
    name: row.name,
    trainingsteilLabel:
      trainingsteilLabels[row.trainingsteil as keyof typeof trainingsteilLabels] ??
      row.trainingsteil,
    hauptteilkategorieLabel: row.hauptteilkategorie
      ? hauptteilkategorieLabels[
          row.hauptteilkategorie as keyof typeof hauptteilkategorieLabels
        ] ?? row.hauptteilkategorie
      : null,
    kategorien: row.kategorien as KategorieSlug[],
    herkunft: row.source,
    visibility: row.visibility,
    bildUrl: row.bild_url,
    diagramm: row.diagramm,
    bildQuelle: row.bild_quelle,
  };
}
