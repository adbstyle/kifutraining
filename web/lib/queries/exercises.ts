import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  feldtyp as feldtypLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
} from "@/lib/vocab";
import {
  getExercisesFuer,
  type ExerciseFilters,
  type ExerciseListRow,
} from "@/lib/queries/uebungen-fuer";
import {
  traegtFeldtyp,
  traegtSpielfeldgroesse,
  type Altersstufe,
} from "@/lib/altersstufe";
import {
  EINORDNUNG_LABEL,
  anzahlSpielerText,
  spielfeldText,
} from "@/lib/labels";
import { sortStufen } from "@/lib/training";
import { hatDiagramm } from "@/lib/diagramm";
import type { Eckdatum, ExerciseCardData } from "@/components/ui";

/**
 * Query-Layer für Übungen — der EINZIGE Datenpfad zu `exercises`
 * (Architektur §6). RLS filtert serverseitig: anonym nur `public`,
 * eingeloggt zusätzlich eigene private Übungen (Story 3 EK12/13). Die Suche
 * selbst steht in lib/queries/uebungen-fuer.ts (ohne Cookie-Client).
 */

export type { ExerciseFilters, ExerciseListRow } from "@/lib/queries/uebungen-fuer";

/** Übungen gemäss gesetzten Filtern. Dimensionen sind mit UND verknüpft,
 *  mehrere Werte innerhalb einer Dimension mit ODER (Story 3 EK9).
 *  Adapter für die Oberfläche: Cookie-Session, User aus der Session. */
export async function getExercises(
  f: ExerciseFilters = {},
): Promise<ExerciseListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return getExercisesFuer(supabase, user?.id ?? null, f);
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
  /** Spielfeldgrösse in Metern — im Juniorenfussball, im Kinderfussball
   *  beim freien Feld (#272); nur paarweise belegt (Story 3, Übungswelten). */
  spielfeld_laenge_m: number | null;
  spielfeld_breite_m: number | null;
  kategorien: string[];
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  /** Die freie Ergänzung zum Material (Epic #266). */
  material: string[];
  /** Material-Liste und -Basis roh aus der DB — gelesen wird über
   *  `parseMaterialListe` / `parseMaterialBasis` (lib/material.ts). */
  material_liste: unknown;
  material_basis: unknown;
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  varianten_text: string | null;
  bild_url: string | null;
  diagramm: unknown;
  bild_quelle: "foto" | "diagramm" | null;
  source: "manual" | "user";
  visibility: "public" | "private";
  owner_id: string | null;
};

// Felder der Detailansicht — dieselben für die Seite und das KI-Werkzeug
// «uebung_abrufen» (#142 NFR 5: keine zweite Spaltenliste).
const DETAIL_COLUMNS =
  "id, slug, name, altersstufe, trainingsteil, erscheinungsform, hauptteilkategorie, uebungstyp, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, kategorien, anzahl_kinder, material, material_liste, material_basis, methodischer_fahrplan, aufbau, varianten_text, bild_url, diagramm, bild_quelle, source, visibility, owner_id";

/** Eine Übung per Slug (volle Felder). RLS blendet private Übungen für
 *  Nicht-Eigentümer aus -> null (Story 4 Postcondition). */
export async function getExerciseDetail(
  slug: string,
): Promise<ExerciseDetail | null> {
  return getExerciseDetailFuer(await createClient(), { slug });
}

/** Dieselbe Detailabfrage für einen bereits als Nutzer sprechenden Client,
 *  per Slug oder per id. Sichtbarkeit entscheidet allein RLS: eine fremde
 *  private Übung ist `null` — genau wie eine, die es nicht gibt (#142 AK 10). */
export async function getExerciseDetailFuer(
  supabase: SupabaseClient,
  schluessel: { slug: string } | { id: string },
): Promise<ExerciseDetail | null> {
  const query = supabase.from("exercises").select(DETAIL_COLUMNS);
  const { data, error } = await ("id" in schluessel
    ? query.eq("id", schluessel.id)
    : query.eq("slug", schluessel.slug)
  ).maybeSingle();
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

/** Die Eckdaten einer Übungskarte (#305): Alterskategorien · Einordnung ·
 *  Feld · Spieler:innen. Nicht erfasste Angaben fallen ohne Platzhalter weg.
 *
 *  - Alterskategorien als Buchstaben, aufsteigend G bis A — auch unter
 *    aktivem Alterskategorien-Filter (PO 2026-09-29).
 *  - Einordnung nur auf der feinsten Ebene: im Kinderfussball-Hauptteil die
 *    Hauptteilkategorie, sonst Trainingsteil bzw. Junioren-Block.
 *  - Feld: die Spielfeldgrösse, wo die Übung eine trägt und sie erfasst ist,
 *    sonst der Feldtyp einer Kinderfussball-Übung. Beim freien Feld mit
 *    Massen genügen die Masse. */
function eckdaten(row: ExerciseListRow): Eckdatum[] {
  const einordnung = row.hauptteilkategorie
    ? hauptteilkategorieLabels[
        row.hauptteilkategorie as keyof typeof hauptteilkategorieLabels
      ] ?? row.hauptteilkategorie
    : EINORDNUNG_LABEL[row.trainingsteil] ?? row.trainingsteil;
  const spielfeld = traegtSpielfeldgroesse(row.altersstufe, row.feldtyp)
    ? spielfeldText(row.spielfeld_laenge_m, row.spielfeld_breite_m)
    : null;
  const feld =
    spielfeld ??
    (traegtFeldtyp(row.altersstufe) && row.feldtyp
      ? feldtypLabels[row.feldtyp as keyof typeof feldtypLabels] ?? row.feldtyp
      : null);
  const anzahl = anzahlSpielerText(row.anzahl_kinder);

  return [
    row.kategorien.length > 0 ? { text: zusammen(sortStufen(row.kategorien).join(" ")) } : null,
    { text: einordnung },
    feld ? { text: zusammen(feld) } : null,
    // Auf der schmalen Karte abgekürzt; vorgelesen wird der volle Begriff.
    anzahl ? { text: zusammen(`${anzahl} Sp.`), vorgelesen: `${anzahl} Spieler:innen` } : null,
  ].filter((e): e is Eckdatum => e != null);
}

/** Kurze Angaben umbrechen nie in sich («ab 4 Sp.», «25 × 18 m»), sondern
 *  nur an den Trennern; umbrechen darf allein die Einordnung, die auf einer
 *  schmalen Karte länger als eine Zeile sein kann. */
function zusammen(text: string): string {
  return text.replace(/ /g, "\u00a0");
}

/** DB-Zeile -> Karten-Props (Labels aus dem Vokabular). */
export function toCardData(row: ExerciseListRow): ExerciseCardData {
  return {
    slug: row.slug,
    name: row.name,
    eckdaten: eckdaten(row),
    herkunft: row.source,
    visibility: row.visibility,
    bildUrl: row.bild_url,
    diagramm: row.diagramm,
    bildQuelle: row.bild_quelle,
  };
}
