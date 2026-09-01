import { createClient } from "@/lib/supabase/server";
import {
  hauptteilkategorie as hauptteilkategorieLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import { likePattern } from "@/lib/search";
import type { Altersstufe } from "@/lib/altersstufe";
import { EINORDNUNG_LABEL } from "@/lib/labels";
import { hatDiagramm } from "@/lib/diagramm";
import type { ExerciseCardData } from "@/components/ui";

/**
 * Query-Layer für Übungen — der EINZIGE Datenpfad zu `exercises`
 * (Architektur §6). RLS filtert serverseitig: anonym nur `public`,
 * eingeloggt zusätzlich eigene private Übungen (Story 3 EK12/13).
 */

export type ExerciseFilters = {
  /** Altersstufe — genau eine, nicht mehrere: eine Übung folgt genau einem
   *  Lehrmittel, und wer hier filtert, plant in genau einer Welt (Story 6,
   *  Übungswelten). Der Katalog setzt ihn bewusst nicht: er zeigt weiterhin
   *  beide Altersstufen (Story 6 Out-of-Scope 1). */
  altersstufe?: Altersstufe;
  kat?: string[]; // Alterskategorien G/F/E (Überlappung)
  feld?: string[]; // Feldtyp (OR)
  form?: string[]; // Erscheinungsform (Überlappung)
  hkat?: string[]; // Hauptteilkategorie (OR)
  /** ODER-verknüpfte Alternativen, wo eine Übung eingeordnet sein darf: ein
   *  Trainingsteil bzw. Junioren-Block (Spalte `trainingsteil`), eine
   *  Hauptteilkategorie (Spalte `hauptteilkategorie`) oder eine Erscheinungsform
   *  (Spalte `erscheinungsform`). Alle Zweige zusammen bilden EINE Dimension —
   *  der Trainingsteil-Filter des Katalogs, in dem seit Story #129 auch die drei
   *  Hauptteilkategorien einzeln wählbar sind, und im Picker der Bestand eines
   *  Blocks samt der Übungen, die seine Erscheinungsform anzieht (Story #134).
   *
   *  Nicht zu verwechseln mit `hkat` und `form` oben: die bleiben UND-Filter.
   *  `pickExercises` muss eine Hauptteil-Zuordnung auf die fixierte
   *  Unterkategorie EINGRENZEN (Story #23), und `form` ist der Nutzerfilter des
   *  Pickers, der die ganze Vorschlagsmenge eingrenzt — nicht die
   *  Vorschlagsquelle `einordnung.formen`. Einen skalaren `teil`-Filter gibt es
   *  nicht mehr: Seit Story #129 läuft jede Einordnungs-Abfrage über dieses
   *  Feld, und ein zweiter Weg mit anderer Semantik wäre eine Falle. */
  einordnung?: { teile?: string[]; hkats?: string[]; formen?: string[] };
  typ?: string[]; // Übungstyp (OR)
  kinder?: number; // verfügbare Gruppengrösse
  q?: string; // Freitext
  fav?: boolean; // nur eigene Favoriten (nur angemeldet wirksam)
  mine?: boolean; // nur eigene Übungen (nur angemeldet wirksam)
};

// Felder, die Liste + Karte brauchen.
const LIST_COLUMNS =
  "id, slug, name, altersstufe, trainingsteil, feldtyp, hauptteilkategorie, kategorien, source, visibility, bild_url, diagramm, bild_quelle";

export type ExerciseListRow = {
  id: string;
  slug: string;
  name: string;
  /** Nach welchem Lehrmittel die Übung geführt wird (Story 1, Übungswelten). */
  altersstufe: Altersstufe;
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
  if (f.altersstufe) query = query.eq("altersstufe", f.altersstufe);
  if (f.kat?.length) query = query.overlaps("kategorien", f.kat);
  if (f.feld?.length) query = query.in("feldtyp", f.feld);
  if (f.form?.length) query = query.overlaps("erscheinungsform", f.form);
  // Hauptteilkategorie: ODER über die gewählten Werte. Da nur Hauptteil-Übungen
  // eine tragen, grenzt ein gesetzter Filter faktisch auf den Hauptteil ein (#22).
  if (f.hkat?.length) query = query.in("hauptteilkategorie", f.hkat);
  // Übungen ohne Übungstyp fallen bei aktivem Filter heraus — dieselbe Regel
  // wie bei allen Dimensionen (Story 9 PC 1).
  if (f.typ?.length) query = query.in("uebungstyp", f.typ);
  // Einordnung: EINE ODER-Klausel über alle drei Spalten, damit sich
  // Trainingsteile, Hauptteilkategorien und anziehende Erscheinungsformen in
  // derselben Auswahl mischen lassen (Story #129 AC 4/5, Story #134 AC 1/2).
  // PostgREST verbindet mehrere `or=`-Parameter derselben Abfrage mit UND — die
  // Gruppengrössen-Klausel weiter unten bleibt davon unberührt.
  //
  // Bewusst EINE Abfrage statt zweier plus Zusammenführen in JS: So bleibt die
  // Sortierung `.order("name")` in der DB-Collation unangetastet (#134 AC 5),
  // und jede Übung erscheint ohne Zutun genau einmal, auch wenn sie über
  // mehrere Zweige zugleich trifft (#134 AC 4).
  if (f.einordnung) {
    const zweige: string[] = [];
    const { teile, hkats, formen } = f.einordnung;
    if (teile?.length) zweige.push(`trainingsteil.in.(${teile.join(",")})`);
    if (hkats?.length) zweige.push(`hauptteilkategorie.in.(${hkats.join(",")})`);
    // `erscheinungsform` ist ein text[]: Überlappung statt Gleichheit.
    if (formen?.length) zweige.push(`erscheinungsform.ov.{${formen.join(",")}}`);
    if (zweige.length) query = query.or(zweige.join(","));
  }
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
  /** Nach welchem Lehrmittel die Übung geführt wird (Story 1, Übungswelten). */
  altersstufe: Altersstufe;
  trainingsteil: string;
  erscheinungsform: string[];
  hauptteilkategorie: string | null;
  uebungstyp: string | null;
  feldtyp: string | null;
  /** Spielfeldgrösse in Metern — nur im Juniorenfussball, nur paarweise
   *  belegt (Story 3, Übungswelten). */
  spielfeld_laenge_m: number | null;
  spielfeld_breite_m: number | null;
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
      "id, slug, name, altersstufe, trainingsteil, erscheinungsform, hauptteilkategorie, uebungstyp, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, kategorien, anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten, bild_url, diagramm, bild_quelle, source, visibility, owner_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as ExerciseDetail | null) ?? null;
}

/** Ein wiederverwendbares Vorlagen-Diagramm (Epic #58, Story #61). */
export type VorlageItem = {
  id: string;
  slug: string;
  name: string;
  diagramm: unknown;
};

/** Verfügbare Vorlagen-Diagramme: die eigenen Diagramme des USERs plus die
 *  KiFu-Manual-Diagramme. Fremde Trainer-Diagramme sind bewusst ausgeschlossen
 *  (Epic #58 Out-of-Scope 1) — der `or`-Filter grenzt auf Manual ODER eigene
 *  ein, RLS deckt die Lesbarkeit ab. Die Zielübung selbst wird ausgeklammert.
 *  Nur Übungen mit einem nicht-leeren Diagramm erscheinen. */
export async function getVorlagen(excludeId?: string): Promise<VorlageItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("exercises")
    .select("id, slug, name, diagramm")
    .not("diagramm", "is", null)
    .order("name");
  query = user
    ? query.or(`source.eq.manual,owner_id.eq.${user.id}`)
    : query.eq("source", "manual");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.id !== excludeId && hatDiagramm(r.diagramm))
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, diagramm: r.diagramm }));
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
      EINORDNUNG_LABEL[row.trainingsteil] ?? row.trainingsteil,
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
