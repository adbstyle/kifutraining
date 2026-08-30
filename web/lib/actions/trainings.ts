"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { TRAININGSTEIL_SLUGS, stufenAbgedeckt, teilTraegtDauer, ZIEL_MAX } from "@/lib/training";
import { heimatFilterFuerEinordnung } from "@/lib/junioren";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { bildOrdnerFuer, ladeBearbeitungsziel } from "@/lib/training-zugriff";
import {
  istEigeneFassungsDatei,
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
import { istAltersstufe, kategorienFuer, type Altersstufe } from "@/lib/altersstufe";
import {
  FREIES_SPIEL,
  bedingungAusFehler,
  fehlerMeldung,
  type Bedingung,
  fehlendeBedingungenAus,
} from "@/lib/training-bedingungen";

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
  /** Hat sich mit den Stufen das Trainingsschema geändert? Dann hat die
   *  Datenebene die Fassungen übertragen und der Editor lädt neu. */
  wechsel?: boolean;
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

/** Transitional (Story 1 Out of Scope 1): Der Trainer wählt die Altersstufe
 *  eines Trainings noch nicht selbst — sie folgt aus den gewählten
 *  Alterskategorien. Mit Story 5 wird sie beim Anlegen gewählt und diese
 *  Ableitung fällt weg; danach beschränken die Kategorien sich auf die Werte
 *  der gewählten Altersstufe statt sie zu bestimmen. */
function altersstufeAusStufen(stufen: string[]): Altersstufe {
  const junioren = kategorienFuer("juniorenfussball");
  return stufen.some((s) => junioren.includes(s)) ? "juniorenfussball" : "kinderfussball";
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
  // Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30). Bestehende
  // Trainings ohne bleiben bearbeitbar; ein neues entsteht nicht mehr so. Die
  // Datenebene setzt es als Trigger `trainings_stufe_pflicht` ebenfalls durch.
  if (stufen.length === 0)
    return {
      status: "error",
      message: "Bitte mindestens eine Alterskategorie wählen.",
    };

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      name,
      ziel: zielWert(form.get("ziel")),
      owner_id: user.id,
      stufen,
      altersstufe: altersstufeAusStufen(stufen),
      visibility: "private",
    })
    .select("id")
    .single();

  if (error || !data) {
    // Übersetzt, nicht roh: eine gemischte Stufenwahl kommt hier als
    // Constraint-Meldung an, und die versteht niemand (Epic #71).
    return {
      status: "error",
      message: error ? fehlerMeldung(error.message) : "Speichern fehlgeschlagen.",
    };
  }

  revalidatePath("/trainings");
  redirect(`/training/${data.id}/edit`);
}

// ── Story #10: Übung einem Trainingsteil zuordnen ────────────────────────────

/** Eine sichtbare Bibliotheks-Übung als eigenständige Fassung ins Training
 *  übernehmen (Story 4). Die Fassung trägt die Inhalte der Vorlage zum
 *  Übernahmezeitpunkt sowie eine eigene Bild- und Diagrammkopie; die Vorlage
 *  bleibt unberührt und hat danach keinen Einfluss mehr auf das Training.
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
  // Ziel darf jede Einordnung beider Schemata sein — welche zum Training
  // passt, entscheidet das Schema-Gate der Datenebene.
  const filter = heimatFilterFuerEinordnung(trainingsteil);
  if (filter.trainingsteile.length === 0)
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
  // Passt die Heimat der Vorlage zu diesem Block? Dieselbe Regel, nach der
  // der Picker anbietet — sonst zeigte er Treffer, die hier scheitern.
  if (!filter.trainingsteile.includes(ex.trainingsteil))
    return { ok: false, error: "Übung passt nicht zu diesem Block." };
  if (
    filter.hauptteilkategorien &&
    !filter.hauptteilkategorien.includes(ex.hauptteilkategorie ?? "")
  )
    return { ok: false, error: "Übung passt nicht zu diesem Block." };

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
  });
  if (error) {
    await entferneStorageObjekt(supabase, bild.pfad);
    // Übersetzt statt roh: Eine Übung, deren Werte nicht zur Altersstufe des
    // Trainings passen, weist die Datenebene als Constraint-Verletzung ab
    // (Story 1). Der Picker grenzt darauf erst mit Story 6 ein.
    return { ok: false, error: fehlerMeldung(error.message) };
  }

  revalidiereTraining(trainingId);
  return { ok: true };
}

// ── Story A: Veröffentlichen ist ein Zustand, keine Kopie ────────────────────

export type PublishResult =
  | { status: "published" }
  | { status: "incomplete"; missing: Bedingung[] }
  | { status: "error"; error: string };

/** Welche Bedingungen dem Training fehlen, um öffentlich zu sein. Die Datenbank
 *  prüft dieselben und ist die letzte Instanz; hier geht es darum, das Fehlende
 *  in Klartext benennen zu können, statt einen rohen Trigger-Fehler zu zeigen. */
async function fehlendeBedingungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  ownerId: string,
): Promise<{ missing: Bedingung[] } | { error: string }> {
  // Ohne owner_id-Filter lesen: sonst käme ein Team-Training gar nicht zurück
  // und der Trainer bekäme «nicht gefunden» statt des Hinweises, dass er es
  // zuerst zu sich übernehmen muss.
  const { data: training } = await supabase
    .from("trainings")
    .select(
      "owner_id, team_id, altersstufe, stufen, training_exercises ( trainingsteil, hauptteilkategorie )",
    )
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return { error: "Training nicht gefunden." };
  if (training.team_id)
    return {
      error:
        "Ein Team-Training lässt sich nicht veröffentlichen. Übernimm es zuerst in deinen persönlichen Bestand.",
    };
  if (training.owner_id !== ownerId) return { error: "Training nicht gefunden." };

  const fassungen = training.training_exercises ?? [];
  return {
    missing: fehlendeBedingungenAus(
      istAltersstufe(training.altersstufe) ? training.altersstufe : "kinderfussball",
      training.stufen ?? [],
      fassungen,
    ),
  };
}

/** Ein persönliches Training öffentlich schalten (Story A AK 1).
 *
 *  Es entsteht keine Kopie: dasselbe Training wird sichtbar und bleibt
 *  bearbeitbar. Die Community sieht damit immer den aktuellen Stand.
 *
 *  Die Bestätigung der Tragweite — inklusive des öffentlich werdenden
 *  Anzeigenamens — erfolgt in der Oberfläche (AK 2); die Prüfung hier ist die
 *  serverseitige Trust-Boundary. */
export async function veroeffentlicheTraining(
  trainingId: string,
): Promise<PublishResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Nicht angemeldet." };

  const gate = await fehlendeBedingungen(supabase, trainingId, user.id);
  if ("error" in gate) return { status: "error", error: gate.error };
  if (gate.missing.length > 0) return { status: "incomplete", missing: gate.missing };

  const { data, error } = await supabase
    .from("trainings")
    .update({ visibility: "public" })
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    // Weist die Datenebene ab, ist das keine technische Panne, sondern dieselbe
    // Aussage wie die Vorabprüfung — nur hat sich der Stand zwischenzeitlich
    // geändert. Entsprechend übersetzt statt roh durchgereicht.
    const bedingung = bedingungAusFehler(error.message);
    return bedingung
      ? { status: "incomplete", missing: [bedingung] }
      : { status: "error", error: error.message };
  }
  if (!data) return { status: "error", error: "Training nicht gefunden." };

  revalidatePath("/trainings");
  revalidiereTraining(trainingId);
  return { status: "published" };
}

/** Ein öffentliches Training auf Entwurf zurücknehmen (Story A AK 3).
 *
 *  Es verschwindet aus der Öffentlichkeit und bleibt im Übrigen unberührt.
 *  Kopien, die andere übernommen haben, bleiben bestehen — sie sind
 *  eigenständige Trainings, das Übernehmen kopiert. */
export async function setzeTrainingAufEntwurf(
  trainingId: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data, error } = await supabase
    .from("trainings")
    .update({ visibility: "private" })
    .eq("id", trainingId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Training nicht gefunden." };

  revalidatePath("/trainings");
  revalidiereTraining(trainingId);
  return { ok: true };
}

// ── Story #12: Training bearbeiten, umsortieren, entfernen, löschen ──────────────

/** Trainingsnamen ändern (Story #12 AC1); leerer Name unzulässig. */
/** Leere und reine Leerzeichen-Eingaben sind kein Ziel (Story 10 PC 3). */
function zielWert(v: FormDataEntryValue | null): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t.slice(0, ZIEL_MAX);
}

/** Das Ziel eines Trainings setzen, ändern oder entfernen (Story 10 AC 1/3).
 *
 *  Wie beim Umbenennen ohne Owner-Filter: Team-Trainings darf jedes Mitglied
 *  bearbeiten, die RLS entscheidet. */
export async function setTrainingZiel(
  trainingId: string,
  ziel: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const wert = ziel.trim() === "" ? null : ziel.trim();
  if (wert && wert.length > ZIEL_MAX)
    return { ok: false, error: `Das Ziel darf höchstens ${ZIEL_MAX} Zeichen lang sein.` };

  const { data, error } = await supabase
    .from("trainings")
    .update({ ziel: wert })
    .eq("id", trainingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!data) return { ok: false, error: "Training nicht gefunden." };
  revalidiereTraining(trainingId);
  return { ok: true };
}

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

  // Direktes Update statt RPC: Die frühere `set_training_stufen` übertrug beim
  // Wechsel des Trainingsschemas alle Fassungen und merkte sich ihre bisherige
  // Einordnung. Den Wechsel gibt es nicht mehr — die Altersstufe eines
  // Trainings steht ab dem Anlegen fest (Story 1). Die Berechtigung trägt die
  // RLS-Policy `tr_update`, den Wertebereich der CHECK.
  const { data: training } = await supabase
    .from("trainings")
    .select("altersstufe")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return { ok: false, error: "Training nicht gefunden." };

  // Vorgelagert statt am Constraint-Fehler: die Datenebene würde denselben
  // Versuch abweisen, aber ohne den Hinweis auf den gangbaren Weg.
  const erlaubt = kategorienFuer(
    istAltersstufe(training.altersstufe) ? training.altersstufe : "kinderfussball",
  );
  if (valid.some((s) => !erlaubt.includes(s)))
    return {
      ok: false,
      error:
        "Diese Alterskategorie gehört nicht zur Altersstufe dieses Trainings. " +
        "Lege für die andere Altersstufe ein neues Training an.",
    };

  const { data, error } = await supabase
    .from("trainings")
    .update({ stufen: valid })
    .eq("id", trainingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!data) return { ok: false, error: "Training nicht gefunden." };

  // Abweichende Fassungen ermitteln — anhand IHRER Alterskategorien: die
  // Fassung ist im Training frei bearbeitbar und die einzige Quelle. Das ist
  // der Stufen-Abgleich innerhalb eines Schemas und unabhängig vom Wechsel.
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
  // `wechsel` bleibt im Ergebnis, ist aber ab jetzt immer false: Ein Training
  // wechselt die Altersstufe nicht mehr. Das Feld — und der Wechsel-Dialog des
  // Editors, der daran hängt — fällt mit Story 5.
  return { ok: true, mismatched, wechsel: false };
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

  // `select` zeigt, ob wirklich eine Zeile fiel: ein Nulltreffer (die RLS liess
  // nichts durch, etwa in einem fremden Training) kommt ohne Fehler zurück.
  // Ohne diese Prüfung fiele gleich darauf die Bilddatei — und die Fassung
  // bliebe mit toter bild_url stehen.
  const { data: geloescht, error } = await supabase
    .from("training_exercises")
    .delete()
    .eq("id", trainingExerciseId)
    .select("id")
    .maybeSingle();
  // War es die letzte Fassung, die ein öffentliches Training braucht, weist die
  // Datenebene ab; die Meldung nennt den Weg über den Entwurf (Story A AK 7).
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!geloescht) return { ok: false, error: "Zuordnung nicht gefunden." };

  // Erst nach erfolgreichem Löschen die eigene Bilddatei entfernen — nie das
  // Bild einer noch existierenden Fassung, und nie das Bild der Vorlage.
  await entferneFassungsBild(supabase, pe.bild_url, trainingExerciseId);

  revalidiereTraining(trainingId);
  return { ok: true };
}

/** Gesamtes Training löschen (Story #12 AC6/AC7); die Zuordnungen kaskadieren.
 *  Ist das Training öffentlich, verschwindet es damit auch aus dem öffentlichen
 *  Bestand — der Löschdialog sagt das (Story A AK 8). Bereits übernommene
 *  Kopien anderer bleiben bestehen, sie sind eigenständig.
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
    revalidiereTeam(training.team_id);
    // Zurück in die Ansicht, aus der das Training verschwunden ist — dort
    // erwartet der Trainer den Beleg, dass es weg ist (Story 17).
    redirect(`/team/${training.team_id}/trainings`);
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
  einordnung: string,
  opts: { form?: string[]; hkat?: string[]; typ?: string[]; q?: string } = {},
): Promise<ExerciseListRow[]> {
  // Der Picker eines Blocks zeigt, was die Abbildungsregel dorthin führt —
  // im Junioren-Hauptteil etwa die Übungen zweier Kinderfussball-Kategorien.
  const filter = heimatFilterFuerEinordnung(einordnung);
  if (filter.trainingsteile.length === 0) return [];
  return getExercises({
    teil: filter.trainingsteile,
    form: opts.form,
    typ: opts.typ,
    // Der Block schränkt die Kategorie bereits ein; eine zusätzliche
    // Nutzerwahl darf sie nur weiter verengen, nie erweitern.
    hkat:
      filter.hauptteilkategorien && opts.hkat?.length
        ? opts.hkat.filter((k) => filter.hauptteilkategorien!.includes(k))
        : (filter.hauptteilkategorien ?? opts.hkat),
    q: opts.q,
  });
}
