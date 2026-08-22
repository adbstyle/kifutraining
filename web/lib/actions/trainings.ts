"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { TRAININGSTEIL_SLUGS, stufenAbgedeckt, teilTraegtDauer } from "@/lib/training";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { kopiereDiagramm, parseDiagramm } from "@/lib/diagramm";
import {
  stempleHerkunft,
  fassungBildPfad,
  FASSUNG_INHALT_FELDER,
  VORLAGE_SELECT,
} from "@/lib/fassung";
import {
  kategorienSlugs,
  hauptteilkategorieSlugs,
  type TrainingsteilSlug,
} from "@/lib/vocab";

export type TrainingFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Ergebnis einer feingranularen Editor-Aktion (sofort-persistent). */
export type TrainingActionResult = { ok: boolean; error?: string };

/** Ergebnis mit Auto-Privat-Hinweis (Story #12 Postcondition 2). */
export type AutoPrivateResult = TrainingActionResult & { becamePrivate?: boolean };

/** Ergebnis des Stufen-Setzens inkl. abweichender Übungen (Story #12 AC3). */
export type StufenResult = AutoPrivateResult & {
  mismatched?: { id: string; name: string }[];
};

function csv(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Editor- und Ansichtspfade eines Trainings nach einer Mutation neu validieren. */
function revalidateTraining(trainingId: string) {
  revalidatePath(`/training/${trainingId}/edit`);
  revalidatePath(`/training/${trainingId}`);
  revalidatePath(`/training/${trainingId}/durchfuehren`);
  revalidatePath(`/training/${trainingId}/druck`);
  revalidatePath("/trainings");
}

function validStufen(values: string[]): string[] {
  return values.filter((s) => kategorienSlugs.includes(s as never));
}

// ── Fassungen: Kopieren einer Vorlage ins Training ───────────────────────────

/** Eine Bibliotheks-Übung, wie sie für das Kopieren gelesen wird (VORLAGE_SELECT). */
type Vorlage = {
  id: string;
  name: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  bild_url: string | null;
  diagramm: unknown;
  source: "manual" | "user";
  owner_id: string | null;
  herkunft_name: string | null;
  herkunft_typ: "manual" | "community" | "eigen" | null;
  herkunft_datum: string | null;
} & Record<string, unknown>;

/** Die inhaltlichen Felder der Vorlage übernehmen — eine Quelle für die
 *  Feldmenge, damit ein neues Übungsfeld nicht an einer von mehreren Stellen
 *  vergessen wird. */
function fassungInhalt(ex: Vorlage): Record<string, unknown> {
  return Object.fromEntries(FASSUNG_INHALT_FELDER.map((f) => [f, ex[f]]));
}

/** Das Diagramm entkoppelt kopieren (frische Element-IDs). `parseDiagramm` ist
 *  die Trust-Boundary: ein strukturell unbrauchbares Diagramm ergibt keine
 *  Kopie, statt die Übernahme scheitern zu lassen. */
function kopiereDiagrammVon(quelle: unknown): unknown {
  const data = parseDiagramm(quelle);
  return data && data.elemente.length > 0 ? kopiereDiagramm(data) : null;
}

/** Die Bilddatei der Vorlage byte-identisch in den Pfad des Trainings-
 *  Eigentümers kopieren. Kein Download/Upload und keine Bildverarbeitung — die
 *  Storage-Kopie prüft Leserecht auf der Quelle und Schreibrecht auf dem Ziel,
 *  genau die benötigte Semantik. Ohne Vorlagenbild ein No-op. */
async function kopiereBild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quellUrl: string | null,
  ownerId: string,
  fassungId: string,
): Promise<{ url: string | null; pfad: string | null; error?: string }> {
  const quellPfad = bildUrlToPath(quellUrl);
  if (!quellPfad) return { url: null, pfad: null };

  const zielPfad = fassungBildPfad(ownerId, fassungId, quellPfad);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .copy(quellPfad, zielPfad);
  if (error) return { url: null, pfad: null, error: `Bildkopie fehlgeschlagen: ${error.message}` };

  return {
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(zielPfad).data.publicUrl,
    pfad: zielPfad,
  };
}

/** Storage-Objekt best-effort entfernen (no-op bei null). */
async function entferneStorageObjekt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pfad: string | null,
) {
  if (pfad) await supabase.storage.from(STORAGE_BUCKET).remove([pfad]);
}

// ── Story #10: Training anlegen ──────────────────────────────────────────────────

/** Neues Training anlegen (Story #10 AC1/AC2/AC3). Standardmässig privat, der USER
 *  ist Eigentümer. Leitet in den Editor weiter. */
export async function createTraining(
  _prev: TrainingFormState,
  form: FormData,
): Promise<TrainingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const name = clean(form.get("name"));
  const stufen = validStufen(csv(form.get("stufen")));
  if (!name) return { status: "error", errors: { name: "Bitte einen Namen angeben." } };

  const { data, error } = await supabase
    .from("trainings")
    .insert({ name, owner_id: user.id, stufen, visibility: "private" })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Speichern fehlgeschlagen." };
  }

  revalidatePath("/trainings");
  redirect(`/training/${data.id}/edit`);
}

// ── Story #10: Übung einem Trainingsteil zuordnen ────────────────────────────

/** Eine sichtbare Bibliotheks-Übung als eigenständige Fassung ins Training
 *  übernehmen (Story 4). Die Fassung trägt die Inhalte der Vorlage zum
 *  Übernahmezeitpunkt, eine eigene Bild- und Diagrammkopie sowie einen
 *  unveränderlichen Herkunfts-Stempel; die Vorlage bleibt unberührt und hat
 *  danach keinen Einfluss mehr auf das Training.
 *
 *  Der Picker bleibt an den Trainingsteil (im Hauptteil an die Kategorie)
 *  gebunden und bietet nur Passendes an; die Prüfung hier ist der Guard gegen
 *  manipulierte Aufrufe. */
export async function addTrainingExercise(
  trainingId: string,
  trainingsteil: string,
  exerciseId: string,
  hauptteilkategorie?: string | null,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!TRAININGSTEIL_SLUGS.includes(trainingsteil as TrainingsteilSlug))
    return { ok: false, error: "Ungültiger Trainingsteil." };

  const istHauptteil = trainingsteil === "hauptteil";
  const hkat = istHauptteil ? (hauptteilkategorie ?? null) : null;
  if (istHauptteil && !hauptteilkategorieSlugs.includes(hkat as never))
    return { ok: false, error: "Ungültige Hauptteilkategorie." };

  // Eigentum prüfen (UX-Guard; RLS setzt es ohnehin serverseitig durch).
  const { data: training } = await supabase
    .from("trainings")
    .select("id")
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!training) return { ok: false, error: "Training nicht gefunden." };

  // Vorlage mit allen Inhalten holen (RLS lässt nur Sichtbares durch).
  const { data: ex } = await supabase
    .from("exercises")
    .select(VORLAGE_SELECT)
    .eq("id", exerciseId)
    .maybeSingle<Vorlage>();
  if (!ex) return { ok: false, error: "Übung nicht verfügbar." };
  if (ex.trainingsteil !== trainingsteil)
    return { ok: false, error: "Übung passt nicht zum Trainingsteil." };
  if (istHauptteil && ex.hauptteilkategorie !== hkat)
    return { ok: false, error: "Übung passt nicht zur Hauptteilkategorie." };

  // Nächste Position bestimmen (eindeutige Reihenfolge je Unterkategorie im
  // Hauptteil, sonst je Trainingsteil).
  let posQuery = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil);
  posQuery = istHauptteil
    ? posQuery.eq("hauptteilkategorie", hkat as string)
    : posQuery;
  const { data: last } = await posQuery
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  // Die ID vorab erzeugen: sie benennt die Bildkopie, die VOR dem Insert
  // entstehen muss (der Pfad steht dann bereits in bild_url). Scheitert der
  // Insert, bleibt höchstens eine unreferenzierte Datei liegen, die ein
  // erneuter Versuch überschreibt — nie eine Fassung ohne Inhalt.
  const fassungId = crypto.randomUUID();
  const bild = await kopiereBild(supabase, ex.bild_url, user.id, fassungId);
  if (bild.error) return { ok: false, error: bild.error };

  const { error } = await supabase.from("training_exercises").insert({
    id: fassungId,
    training_id: trainingId,
    trainingsteil,
    hauptteilkategorie: hkat,
    position,
    // Bis die Bestand-Überführung abgeschlossen ist, bleibt der Verweis als
    // Brücke für die noch nicht überführten Zuordnungen bestehen.
    exercise_id: exerciseId,
    exercise_name_cache: ex.name,
    ...fassungInhalt(ex),
    bild_url: bild.url,
    diagramm: kopiereDiagrammVon(ex.diagramm),
    ...stempleHerkunft(ex, user.id),
  });
  if (error) {
    await entferneStorageObjekt(supabase, bild.pfad);
    return { ok: false, error: error.message };
  }

  revalidateTraining(trainingId);
  return { ok: true };
}

/** Genau eine Zuordnung einer Übung aus dem Trainingsteil entfernen (Warenkorb-
 *  „−" im Picker, Story #10). Entfernt die zuletzt hinzugefügte (höchste
 *  Position) passende Zeile, damit wiederholtes „−" die Anzahl Schritt für
 *  Schritt reduziert. RLS setzt das Eigentum zusätzlich serverseitig durch. */
export async function removeOneTrainingExercise(
  trainingId: string,
  trainingsteil: string,
  exerciseId: string,
  hauptteilkategorie?: string | null,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!TRAININGSTEIL_SLUGS.includes(trainingsteil as TrainingsteilSlug))
    return { ok: false, error: "Ungültiger Trainingsteil." };

  const istHauptteil = trainingsteil === "hauptteil";
  const hkat = istHauptteil ? (hauptteilkategorie ?? null) : null;

  // Eigentum prüfen (UX-Guard; RLS setzt es ohnehin durch).
  const { data: training } = await supabase
    .from("trainings")
    .select("id")
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!training) return { ok: false, error: "Training nicht gefunden." };

  // Zuletzt hinzugefügte passende Zuordnung entfernen (im Hauptteil zusätzlich
  // auf die Unterkategorie eingegrenzt).
  let rowQuery = supabase
    .from("training_exercises")
    .select("id")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil)
    .eq("exercise_id", exerciseId);
  rowQuery = istHauptteil ? rowQuery.eq("hauptteilkategorie", hkat as string) : rowQuery;
  const { data: row } = await rowQuery
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false, error: "Übung nicht im Trainingsteil." };

  const { error } = await supabase.from("training_exercises").delete().eq("id", row.id);
  if (error) return { ok: false, error: error.message };

  revalidateTraining(trainingId);
  return { ok: true };
}

// ── Story #14: Sichtbarkeit steuern & teilen ────────────────────────────────

export type PublishResult =
  | { status: "published" }
  | { status: "incomplete"; missing: string[] }
  | { status: "needs_confirmation"; count: number; names: string[] }
  | { status: "error"; error: string };

/** Training öffentlich schalten (Story #14). Ohne Mitveröffentlichungs-Zustimmung
 *  liefert die RPC bei eigenen privaten Übungen `needs_confirmation` (Anzahl +
 *  Namen) und bei fehlenden Voraussetzungen `incomplete` (welche fehlen) —
 *  jeweils ohne Mutation. */
export async function publishTrainingAction(
  trainingId: string,
  includePrivate: boolean,
): Promise<PublishResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Nicht angemeldet." };

  const { data, error } = await supabase.rpc("publish_training", {
    p_training_id: trainingId,
    p_include_private: includePrivate,
  });
  if (error) return { status: "error", error: error.message };

  const result = data as PublishResult;
  if (result.status === "published") revalidateTraining(trainingId);
  return result;
}

/** Öffentliches Training wieder privat schalten (Story #14 AC2). Mitveröffentlichte
 *  Übungen bleiben öffentlich (Postcondition 4). */
export async function unpublishTrainingAction(trainingId: string): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase.rpc("unpublish_training", { p_training_id: trainingId });
  if (error) return { ok: false, error: error.message };
  revalidateTraining(trainingId);
  return { ok: true };
}

// ── Story #12: Training bearbeiten, umsortieren, entfernen, löschen ──────────────

/** Trainingsnamen ändern (Story #12 AC1); leerer Name unzulässig. */
export async function renameTraining(
  trainingId: string,
  name: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bitte einen Namen angeben." };

  const { error } = await supabase
    .from("trainings")
    .update({ name: trimmed })
    .eq("id", trainingId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateTraining(trainingId);
  return { ok: true };
}

/** Stufen eines Trainings setzen/ergänzen/entfernen (Story #12 AC2). Liefert die
 *  bereits zugeordneten Übungen zurück, die keine der neuen Stufen abdecken
 *  (AC3), sowie ob das Training dadurch auf privat gesetzt wurde (Postcondition 2,
 *  durch den DB-Trigger bei leeren Stufen). */
export async function setTrainingStufen(
  trainingId: string,
  stufen: string[],
): Promise<StufenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const valid = validStufen(stufen);

  const { data: before } = await supabase
    .from("trainings")
    .select("visibility")
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { ok: false, error: "Training nicht gefunden." };

  const { data: after, error } = await supabase
    .from("trainings")
    .update({ stufen: valid })
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .select("visibility")
    .maybeSingle();
  if (error || !after) return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen." };

  // Abweichende, noch auflösbare Übungen ermitteln (Platzhalter ohne Kategorien
  // werden nicht bewertet).
  let mismatched: { id: string; name: string }[] = [];
  if (valid.length > 0) {
    const { data: rows } = await supabase
      .from("training_exercises")
      .select("id, exercise_name_cache, exercises ( name, kategorien )")
      .eq("training_id", trainingId);
    mismatched = (rows ?? [])
      .map((r) => ({
        id: r.id,
        // Embed ist als to-one-FK ein Objekt; supabase-js typisiert es defensiv
        // als Array -> hier auf das tatsächliche Objekt normalisieren.
        ex: (r.exercises as unknown) as { name: string; kategorien: string[] } | null,
        cache: r.exercise_name_cache,
      }))
      .filter((r) => r.ex != null && !stufenAbgedeckt(valid, r.ex.kategorien))
      .map((r) => ({ id: r.id, name: r.ex?.name ?? r.cache ?? "Übung" }));
  }

  revalidateTraining(trainingId);
  return {
    ok: true,
    becamePrivate: before.visibility === "public" && after.visibility === "private",
    mismatched,
  };
}

/** Zuordnung innerhalb ihres Trainingsteils umsortieren (Story #12 AC4). */
export async function moveTrainingExercise(
  trainingExerciseId: string,
  dir: -1 | 1,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: pe } = await supabase
    .from("training_exercises")
    .select("training_id")
    .eq("id", trainingExerciseId)
    .maybeSingle();
  if (!pe) return { ok: false, error: "Zuordnung nicht gefunden." };

  const { error } = await supabase.rpc("move_training_exercise", {
    p_training_exercise_id: trainingExerciseId,
    p_dir: dir,
  });
  if (error) return { ok: false, error: error.message };
  revalidateTraining(pe.training_id);
  return { ok: true };
}

/** Eine Zuordnung aus ihrem Trainingsteil entfernen (Story #12 AC5). Meldet,
 *  wenn das Training dadurch auf privat gesetzt wurde (Postcondition 2). */
export async function removeTrainingExercise(
  trainingExerciseId: string,
): Promise<AutoPrivateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: pe } = await supabase
    .from("training_exercises")
    .select("training_id")
    .eq("id", trainingExerciseId)
    .maybeSingle();
  if (!pe) return { ok: false, error: "Zuordnung nicht gefunden." };
  const trainingId = pe.training_id;

  const { data: before } = await supabase
    .from("trainings")
    .select("visibility")
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { ok: false, error: "Training nicht gefunden." };

  const { error } = await supabase
    .from("training_exercises")
    .delete()
    .eq("id", trainingExerciseId);
  if (error) return { ok: false, error: error.message };

  const { data: after } = await supabase
    .from("trainings")
    .select("visibility")
    .eq("id", trainingId)
    .maybeSingle();

  revalidateTraining(trainingId);
  return {
    ok: true,
    becamePrivate: before.visibility === "public" && after?.visibility === "private",
  };
}

/** Gesamtes Training löschen (Story #12 AC6/AC7); die Zuordnungen kaskadieren.
 *  Die Bestätigung erfolgt im UI. */
export async function deleteTraining(trainingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("trainings").delete().eq("id", trainingId).eq("owner_id", user.id);
  revalidatePath("/trainings");
  redirect("/trainings?mine=1&deleted=1");
}

// ── Story #11: Dauer je Zuordnung erfassen/ändern/entfernen ──────────────────

/** Dauer einer Zuordnung setzen (Vielfaches von 5 min) oder entfernen (null).
 *  Persistiert unmittelbar (Story #11 AC1/AC2). RLS stellt sicher, dass nur der
 *  Eigentümer schreibt. */
export async function setExerciseDuration(
  trainingExerciseId: string,
  minutes: number | null,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes % 5 !== 0))
    return { ok: false, error: "Dauer muss ein Vielfaches von 5 Minuten sein." };

  // Trust Boundary: „Auffangen" trägt keine Dauer (DB-CHECK erzwingt dies; hier
  // mit klarer Meldung statt Constraint-Fehler abfangen). Das Leeren (null) bleibt
  // immer erlaubt.
  if (minutes !== null) {
    const { data: row } = await supabase
      .from("training_exercises")
      .select("trainingsteil")
      .eq("id", trainingExerciseId)
      .maybeSingle();
    if (row && !teilTraegtDauer(row.trainingsteil as TrainingsteilSlug))
      return { ok: false, error: "Für diesen Trainingsteil kann keine Dauer gesetzt werden." };
  }

  const { data, error } = await supabase
    .from("training_exercises")
    .update({ duration_min: minutes })
    .eq("id", trainingExerciseId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Zuordnung nicht gefunden." };
  revalidateTraining(data.training_id);
  return { ok: true };
}

// ── Story #10: Übungsauswahl (Picker) ────────────────────────────────────────

/** Für den Picker passende Übungen eines Trainingsteils laden — alle für den
 *  USER sichtbaren (RLS), eingrenzbar nach Erscheinungsform und (Hauptteil)
 *  Hauptteilkategorie sowie per Freitext (Story #10 AC5/AC6/AC7, #23). */
export async function pickExercises(
  trainingsteil: string,
  opts: { form?: string[]; hkat?: string[]; q?: string } = {},
): Promise<ExerciseListRow[]> {
  if (!TRAININGSTEIL_SLUGS.includes(trainingsteil as TrainingsteilSlug)) return [];
  return getExercises({
    teil: [trainingsteil],
    form: opts.form,
    hkat: opts.hkat,
    q: opts.q,
  });
}
