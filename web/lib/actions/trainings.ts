"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { TRAININGSTEIL_SLUGS, stufenAbgedeckt, teilTraegtDauer } from "@/lib/training";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { revalidiereTraining } from "@/lib/revalidate";
import { kopiereTraining } from "@/lib/training-kopie";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { bildOrdnerFuer, ladeBearbeitungsziel } from "@/lib/training-zugriff";
import {
  istEigeneFassungsDatei,
  stempleHerkunft,
  kopiereBild,
  kopiereDiagrammVon,
  entferneStorageObjekt,
  inhaltFelder,
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

/** Ergebnis des Stufen-Setzens inkl. abweichender Übungen (Story #12 AC3). */
export type StufenResult = TrainingActionResult & {
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

/** Die Bilddatei einer Fassung entfernen (Story 3 AK 13).
 *
 *  Gelöscht wird ausschliesslich die eigene Kopie: der Dateiname muss die
 *  Zuordnungs-ID tragen, wie `fassungBildPfad` sie bildet. Zeigt die URL auf
 *  etwas anderes — etwa noch auf das Bild der Vorlage, solange eine Zuordnung
 *  nicht überführt ist — bleibt die Datei unangetastet. Ein verwaistes Bild ist
 *  harmlos, ein gelöschtes Vorlagenbild wäre Datenverlust für alle. */
async function entferneFassungsBild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bildUrl: string | null,
  fassungId: string,
) {
  const pfad = bildUrlToPath(bildUrl);
  if (!pfad || !istEigeneFassungsDatei(pfad, fassungId)) return;
  await entferneStorageObjekt(supabase, pfad);
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

  // Schreibrecht prüfen (UX-Guard; RLS setzt es ohnehin serverseitig durch).
  // Team-Trainings sind für jedes Mitglied bearbeitbar (Story 6) — und ihre
  // Bildkopien gehören in den Team-Ordner, nicht in den persönlichen.
  const ziel = await ladeBearbeitungsziel(supabase, trainingId, user.id);
  if (!ziel) return { ok: false, error: "Training nicht gefunden." };

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
  const bild = await kopiereBild(supabase, ex.bild_url, bildOrdnerFuer(ziel), fassungId);
  if (bild.error) return { ok: false, error: bild.error };

  const { error } = await supabase.from("training_exercises").insert({
    id: fassungId,
    training_id: trainingId,
    trainingsteil,
    hauptteilkategorie: hkat,
    position,
    ...inhaltFelder(ex),
    bild_url: bild.url,
    diagramm: kopiereDiagrammVon(ex.diagramm),
    ...stempleHerkunft(ex, user.id),
  });
  if (error) {
    await entferneStorageObjekt(supabase, bild.pfad);
    return { ok: false, error: error.message };
  }

  revalidiereTraining(trainingId);
  return { ok: true };
}

// ── Story 14 (Team-Epic): Veröffentlichen als eingefrorene Vorlagen-Kopie ────

export type PublishResult =
  | { status: "published" }
  | { status: "incomplete"; missing: string[] }
  | { status: "error"; error: string };

/** Fehlt dem Training etwas, um veröffentlicht werden zu dürfen? Gibt die
 *  Marker zurück, die die Oberfläche in Klartext übersetzt. Das Gate lebt in
 *  der App, weil das Veröffentlichen selbst kein RPC mehr ist — die RLS
 *  verhindert nur noch das Ändern einer bestehenden Vorlage, nicht das Anlegen
 *  einer unvollständigen. */
async function fehlendeVoraussetzungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  ownerId: string,
): Promise<{ missing: string[] } | { error: string }> {
  const { data: training } = await supabase
    .from("trainings")
    .select("stufen, visibility, training_exercises ( trainingsteil )")
    .eq("id", trainingId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!training) return { error: "Training nicht gefunden." };
  if (training.visibility !== "private")
    return { error: "Nur persönliche Trainings lassen sich veröffentlichen." };

  const teile = (training.training_exercises ?? []).map((t) => t.trainingsteil);
  const missing: string[] = [];
  if ((training.stufen ?? []).length === 0) missing.push("stufe");
  if (!teile.includes("einleitung")) missing.push("einleitung");
  if (!teile.includes("hauptteil")) missing.push("hauptteil");
  return { missing };
}

/** Ein persönliches Training als öffentliche Vorlage veröffentlichen (Story 14).
 *
 *  Veröffentlicht wird nie das Training selbst, sondern eine vollständige,
 *  eingefrorene Kopie: das Original bleibt privat und frei bearbeitbar, die
 *  Vorlage ändert sich nie mehr (die RLS kennt keine Update-Policy für
 *  öffentliche Zeilen). Ein erneutes Veröffentlichen ERSETZT die bisherige
 *  Vorlage — es gibt je Training höchstens eine aktive.
 *
 *  Die Bestätigung der Tragweite (inkl. des öffentlich sichtbaren
 *  Anzeigenamens) erfolgt in der Oberfläche; die Vollständigkeitsprüfung hier
 *  ist die serverseitige Trust-Boundary. */
export async function veroeffentlicheTraining(
  trainingId: string,
): Promise<PublishResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Nicht angemeldet." };

  const gate = await fehlendeVoraussetzungen(supabase, trainingId, user.id);
  if ("error" in gate) return { status: "error", error: gate.error };
  if (gate.missing.length > 0) return { status: "incomplete", missing: gate.missing };

  // Die bisherige Vorlage erst NACH der neuen Kopie abräumen: scheitert das
  // Kopieren, bleibt die alte Vorlage öffentlich stehen statt ersatzlos zu
  // verschwinden.
  const { data: vorher } = await supabase
    .from("trainings")
    .select("vorlage_id")
    .eq("id", trainingId)
    .maybeSingle();

  // Die Vorlage entsteht zuerst als private Kopie und wird erst am Schluss
  // freigegeben: in ein öffentliches Training lässt die RLS keine Fassungen
  // einfügen — genau das ist das Einfrieren.
  const kopie = await kopiereTraining(supabase, trainingId, {
    art: "persoenlich",
    ownerId: user.id,
  });
  if (!kopie.ok) return { status: "error", error: kopie.error };

  const { error: freigabeFehler } = await supabase
    .from("trainings")
    .update({ visibility: "public" })
    .eq("id", kopie.neueId)
    .eq("owner_id", user.id);
  if (freigabeFehler) {
    // Die halbfertige Kopie darf nicht als stiller Zwilling stehen bleiben.
    await loescheTrainingMitBildern(supabase, kopie.neueId);
    return { status: "error", error: freigabeFehler.message };
  }

  if (vorher?.vorlage_id) await loescheTrainingMitBildern(supabase, vorher.vorlage_id);

  const { error } = await supabase
    .from("trainings")
    .update({ vorlage_id: kopie.neueId })
    .eq("id", trainingId)
    .eq("owner_id", user.id);
  if (error) return { status: "error", error: error.message };

  revalidatePath("/trainings");
  revalidiereTraining(trainingId);
  return { status: "published" };
}

/** Die Vorlage eines Trainings zurückziehen (Story 14 AK 5). Sie verschwindet
 *  samt Bildern aus der Öffentlichkeit; das persönliche Training bleibt
 *  unberührt. Bereits gezogene Kopien anderer Trainer bleiben bestehen — sie
 *  sind eigenständig. */
export async function zieheVorlageZurueck(
  trainingId: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: training } = await supabase
    .from("trainings")
    .select("vorlage_id")
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!training) return { ok: false, error: "Training nicht gefunden." };
  if (!training.vorlage_id) return { ok: true }; // schon zurückgezogen

  await loescheTrainingMitBildern(supabase, training.vorlage_id);
  // `on delete set null` hat den Link bereits geleert; explizit nachziehen
  // schadet nicht und deckt den Fall ab, dass das Löschen nichts traf.
  await supabase
    .from("trainings")
    .update({ vorlage_id: null })
    .eq("id", trainingId)
    .eq("owner_id", user.id);

  revalidatePath("/trainings");
  revalidiereTraining(trainingId);
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

  // Kein Owner-Filter mehr: Team-Trainings darf jedes Mitglied umbenennen
  // (Story 6). Die RLS entscheidet — `select` zeigt, ob wirklich etwas getroffen
  // wurde, sonst meldete ein Nulltreffer stillen Erfolg.
  const { data, error } = await supabase
    .from("trainings")
    .update({ name: trimmed })
    .eq("id", trainingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Training nicht gefunden." };
  revalidiereTraining(trainingId);
  return { ok: true };
}

/** Stufen eines Trainings setzen/ergänzen/entfernen (Story #12 AC2). Liefert die
 *  bereits zugeordneten Übungen zurück, die keine der neuen Stufen abdecken
 *  (AC3). */
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

  const { data: after, error } = await supabase
    .from("trainings")
    .update({ stufen: valid })
    .eq("id", trainingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!after) return { ok: false, error: "Training nicht gefunden." };

  // Abweichende Fassungen ermitteln — anhand IHRER Alterskategorien: die
  // Fassung ist im Training frei bearbeitbar und die einzige Quelle.
  let mismatched: { id: string; name: string }[] = [];
  if (valid.length > 0) {
    const { data: rows } = await supabase
      .from("training_exercises")
      .select("id, name, kategorien")
      .eq("training_id", trainingId);
    mismatched = (rows ?? [])
      // Ohne Kategorien gibt es nichts abzudecken — solche Fassungen gelten
      // nicht als abweichend.
      .filter((r) => (r.kategorien ?? []).length > 0 && !stufenAbgedeckt(valid, r.kategorien))
      .map((r) => ({ id: r.id, name: r.name }));
  }

  revalidiereTraining(trainingId);
  return { ok: true, mismatched };
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
  revalidiereTraining(pe.training_id);
  return { ok: true };
}

/** Eine Zuordnung aus ihrem Trainingsteil entfernen (Story #12 AC5). */
export async function removeTrainingExercise(
  trainingExerciseId: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: pe } = await supabase
    .from("training_exercises")
    .select("training_id, bild_url")
    .eq("id", trainingExerciseId)
    .maybeSingle();
  if (!pe) return { ok: false, error: "Zuordnung nicht gefunden." };
  const trainingId = pe.training_id;

  const { error } = await supabase
    .from("training_exercises")
    .delete()
    .eq("id", trainingExerciseId);
  if (error) return { ok: false, error: error.message };

  // Erst nach erfolgreichem Löschen die eigene Bilddatei entfernen — nie das
  // Bild einer noch existierenden Fassung, und nie das Bild der Vorlage.
  await entferneFassungsBild(supabase, pe.bild_url, trainingExerciseId);

  revalidiereTraining(trainingId);
  return { ok: true };
}

/** Gesamtes Training löschen (Story #12 AC6/AC7); die Zuordnungen kaskadieren.
 *  Die Bestätigung erfolgt im UI.
 *
 *  Ein Team-Training löscht das ganze Team-Exemplar — jedes Mitglied darf das
 *  (Story 6); die Rückkehr führt dann in den Team-Bereich statt in die eigene
 *  Übersicht. Wer nur seine eigene Kopie will, übernimmt sie vorher zu sich. */
export async function deleteTraining(trainingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: training } = await supabase
    .from("trainings")
    .select("team_id")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return;

  // Kein Erfolgssignal ohne tatsächliche Löschung: der Helfer meldet `false`,
  // wenn die RLS nichts durchgelassen hat.
  if (!(await loescheTrainingMitBildern(supabase, trainingId))) return;

  if (training.team_id) {
    revalidatePath(`/team/${training.team_id}`);
    redirect(`/team/${training.team_id}`);
  }
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
  revalidiereTraining(data.training_id);
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
