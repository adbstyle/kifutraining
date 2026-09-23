import type { SupabaseClient } from "@supabase/supabase-js";
import { likePattern } from "@/lib/search";
import type { Altersstufe } from "@/lib/altersstufe";

// Die Übungssuche für einen Client, der bereits als Nutzer spricht (Cookie-
// Session ODER OAuth-Bearer). Abgespalten aus lib/queries/exercises.ts, damit
// der Fachkern (lib/kern) sie nutzen kann, ohne den Cookie-Client
// (`@/lib/supabase/server`, `next/headers`) mitzuziehen. Der Cookie-Wrapper
// `getExercises` bleibt in exercises.ts und ruft diese Funktion.

/**
 * Teil des Query-Layers für Übungen — des EINZIGEN Datenpfads zu `exercises`
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


/** Übungs-IDs, die der angemeldete USER favorisiert hat. RLS liefert nur eigene
 *  Favoriten — anonyme Aufrufer bekommen ein leeres Set. */
async function getFavoriteIds(
  supabase: SupabaseClient,
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

/** Dieselbe Suche für einen Client, der bereits als Nutzer spricht (Cookie-
 *  Session ODER OAuth-Bearer). Die userId kommt als Parameter: am Bearer-
 *  Client (persistSession: false) kennt `auth.getUser()` ohne Token keinen
 *  User — die Abfrage liefe still wie anonym. Der Katalog und das KI-Werkzeug
 *  «uebungen_suchen» laufen damit über denselben Abfrageweg — dieselben
 *  Filter, dieselbe Sortierung, dieselbe Sichtbarkeit (#142 AK 7, NFR 5).
 *
 *  `favoriten: false` lässt die Favoriten ganz aus: keine Abfrage auf
 *  `exercise_favorites`, `is_favorited` immer false, `f.fav` wirkungslos.
 *  Ein KI-Zugang erreicht die Favoriten nicht (Erlauben-Seite,
 *  `ZUGANG_DARF_NICHT` in lib/mcp/umfang.ts). */
export async function getExercisesFuer(
  supabase: SupabaseClient,
  userId: string | null,
  f: ExerciseFilters = {},
  opt: { favoriten?: boolean } = {},
): Promise<ExerciseListRow[]> {
  const mitFavoriten = opt.favoriten ?? true;
  const favIds = mitFavoriten ? await getFavoriteIds(supabase, userId ?? undefined) : new Set<string>();

  // Favoriten-Filter ist nur angemeldet wirksam; ohne Favoriten -> leere Liste.
  if (f.fav && mitFavoriten) {
    if (!userId || favIds.size === 0) return [];
  }
  // „Nur meine Übungen" ist ebenfalls nur angemeldet wirksam.
  if (f.mine && !userId) return [];

  let query = supabase.from("exercises").select(LIST_COLUMNS).order("name");

  // Filter serverseitig per ID-Liste (kombiniert sauber mit Suche/Filtern).
  // Bei sehr vielen Favoriten könnte die Query-URL lang werden; im
  // Kinderfussball-Kontext unkritisch. Sonst später als JOIN/View lösen.
  if (f.fav && mitFavoriten) query = query.in("id", [...favIds]);
  // Eigene Übungen: öffentliche wie private, keine fremden/Manual-Übungen.
  if (f.mine && userId) query = query.eq("owner_id", userId);
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
