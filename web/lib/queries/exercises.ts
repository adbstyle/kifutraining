import { createClient } from "@/lib/supabase/server";
import {
  trainingsteil as trainingsteilLabels,
  feldtyp as feldtypLabels,
  type KategorieSlug,
} from "@/lib/vocab";
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
  thema?: string[]; // Thema (OR)
  kinder?: number; // verfügbare Gruppengrösse
  q?: string; // Freitext
};

// Felder, die Liste + Karte brauchen.
const LIST_COLUMNS =
  "id, slug, name, trainingsteil, feldtyp, kategorien, source, visibility, bild_url";

export type ExerciseListRow = {
  id: string;
  slug: string;
  name: string;
  trainingsteil: string;
  feldtyp: string | null;
  kategorien: string[];
  source: "manual" | "user";
  visibility: "public" | "private";
  bild_url: string | null;
};

/** Übungen gemäss gesetzten Filtern. Dimensionen sind mit UND verknüpft,
 *  mehrere Werte innerhalb einer Dimension mit ODER (Story 3 EK9). */
export async function getExercises(
  f: ExerciseFilters = {},
): Promise<ExerciseListRow[]> {
  const supabase = await createClient();
  let query = supabase.from("exercises").select(LIST_COLUMNS).order("name");

  if (f.teil?.length) query = query.in("trainingsteil", f.teil);
  if (f.kat?.length) query = query.overlaps("kategorien", f.kat);
  if (f.feld?.length) query = query.in("feldtyp", f.feld);
  if (f.form?.length) query = query.overlaps("erscheinungsform", f.form);
  if (f.thema?.length) query = query.in("thema", f.thema);
  // Gruppengrösse: durchführbar, wenn die Mindestzahl <= verfügbar ist
  // oder gar keine Mindestzahl angegeben ist (EK6).
  if (typeof f.kinder === "number" && Number.isFinite(f.kinder)) {
    query = query.or(`anzahl_kinder_min.lte.${f.kinder},anzahl_kinder_min.is.null`);
  }
  if (f.q?.trim()) {
    query = query.textSearch("search_tsv", f.q.trim(), {
      type: "websearch",
      config: "german",
    });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExerciseListRow[];
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
  feldtyp: string | null;
  thema: string | null;
  kategorien: string[];
  spielform: string | null;
  anzahl_kinder: { min?: number | null; empfohlen?: number | null } | null;
  material: string[];
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  varianten: string[];
  bild_url: string | null;
  source: "manual" | "user";
  visibility: "public" | "private";
  owner_id: string | null;
};

export type ThemaDetail = {
  id: string;
  name: string;
  ziele: string[];
  metaphern: string[];
  fragen_an_die_kinder: string[];
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
      "id, slug, name, trainingsteil, erscheinungsform, feldtyp, thema, kategorien, spielform, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_url, source, visibility, owner_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as ExerciseDetail | null) ?? null;
}

/** Themen-Infos (Ziele/Metaphern/Fragen) zu einer Thema-Id. */
export async function getThemaDetail(id: string): Promise<ThemaDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themen")
    .select("id, name, ziele, metaphern, fragen_an_die_kinder")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ThemaDetail | null) ?? null;
}

/** Ausschliesslich die eigenen Übungen des angemeldeten Trainers (Story 8) —
 *  öffentliche wie private, keine fremden/Manual-Übungen. */
export async function getMyExercises(): Promise<ExerciseListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("exercises")
    .select(LIST_COLUMNS)
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExerciseListRow[];
}

/** Themen für die Filter-Optionen (id + Anzeigename). */
export async function getThemen(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themen")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** DB-Zeile -> Karten-Props (Labels aus dem Vokabular). */
export function toCardData(row: ExerciseListRow): ExerciseCardData {
  return {
    slug: row.slug,
    name: row.name,
    trainingsteilLabel:
      trainingsteilLabels[row.trainingsteil as keyof typeof trainingsteilLabels] ??
      row.trainingsteil,
    feldtypLabel: row.feldtyp
      ? feldtypLabels[row.feldtyp as keyof typeof feldtypLabels] ?? row.feldtyp
      : null,
    kategorien: row.kategorien as KategorieSlug[],
    herkunft: row.source,
    visibility: row.visibility,
    bildUrl: row.bild_url,
  };
}
