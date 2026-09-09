"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { stufenAbgedeckt, teilTraegtDauer, NOTIZ_MAX, ZIEL_MAX } from "@/lib/training";
import { bildUrlToPath } from "@/lib/storage";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { bearbeitungszielVon, bildOrdnerFuer } from "@/lib/training-zugriff";
import {
  istEigeneFassungsDatei,
  kopiereBild,
  kopiereDiagrammVon,
  entferneStorageObjekt,
  inhaltFelder,
  VORLAGE_SELECT,
} from "@/lib/fassung";
import { kategorienSlugs, altersstufe as altersstufeLabels } from "@/lib/vocab";
import {
  alsAltersstufe,
  istAltersstufe,
  kategorienFuer,
  vorlagePasst,
  vorlagenFilterFuer,
} from "@/lib/altersstufe";
import {
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
  /** Nach welchem Lehrmittel die Vorlage geführt wird — der Guard beim
   *  Zuordnen prüft sie gegen die Altersstufe des Trainings (Story 6 AK 4). */
  altersstufe: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  /** Die Erscheinungsformen der Vorlage. Sie kommen als Inhaltsfeld ohnehin
   *  mit (`FASSUNG_INHALT_FELDER`); der Guard beim Zuordnen liest sie, weil ein
   *  Block auch über sie gefüllt werden darf (Story #134). */
  erscheinungsform: string[] | null;
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

/** Neues Training anlegen (Story #10 AC1/AC2/AC3, Story 5 AK 1/2). Standardmässig
 *  privat, der USER ist Eigentümer. Leitet in den Editor weiter. */
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

  // Die Altersstufe ist Pflicht und hat bewusst KEINEN Rückfall: Sie bindet
  // lebenslang (Story 5 AK 5), und eine stille Vorgabe wäre genau das
  // Durchrutschen, das die Story ausschliesst. Die Datenebene führt die Spalte
  // seit der Migration `training_altersstufe_default_drop` ohne Default.
  const altersstufe = clean(form.get("altersstufe"));
  if (!istAltersstufe(altersstufe))
    return { status: "error", message: "Bitte die Altersstufe wählen." };

  // Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30). Bestehende
  // Trainings ohne bleiben bearbeitbar; ein neues entsteht nicht mehr so. Die
  // Datenebene setzt es als Trigger `trainings_stufe_pflicht` ebenfalls durch.
  if (stufen.length === 0)
    return {
      status: "error",
      message: "Bitte mindestens eine Alterskategorie wählen.",
    };
  // Die Kategorien folgen der gewählten Altersstufe; sie bestimmen sie nicht
  // mehr (Story 5 AK 4). Ein stufenfremder Wert wird abgewiesen statt still
  // weggefiltert — sonst entstünde ein Training mit weniger Kategorien, als der
  // Trainer gewählt hat.
  const erlaubt = kategorienFuer(altersstufe);
  if (stufen.some((s) => !erlaubt.includes(s)))
    return {
      status: "error",
      message:
        "Diese Alterskategorie gehört nicht zur gewählten Altersstufe. " +
        "Wähle nur Kategorien dieser Altersstufe.",
    };

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      name,
      ziel: zielWert(form.get("ziel")),
      owner_id: user.id,
      stufen,
      altersstufe,
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
 *  Der Picker bleibt an die Altersstufe des Trainings und an den Zielblock (im
 *  Kinderfussball-Hauptteil an dessen Kategorie) gebunden und bietet nur
 *  Passendes an — samt der Übungen, die der Block über seine Erscheinungsform
 *  anzieht (Story #134); die Prüfung hier ist die Trust Boundary gegen jeden Aufruf,
 *  der die Oberfläche umgeht (Story 6 AK 4). Die Datenebene fängt Stufenfremdes
 *  zusätzlich über `te_kategorien_je_altersstufe` und
 *  `te_trainingsteil_je_altersstufe` — hier geht es um die verständliche
 *  Meldung davor. */
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

  // Schreibrecht prüfen (UX-Guard; RLS setzt es ohnehin serverseitig durch).
  // Team-Trainings sind für jedes Mitglied bearbeitbar (Story 6, Team-Epic) —
  // und ihre Bildkopien gehören in den Team-Ordner, nicht in den persönlichen.
  // Die Altersstufe kommt aus derselben Zeile: sie ist eine Eigenschaft des
  // Trainings und darf nie vom Aufrufer stammen.
  const { data: training } = await supabase
    .from("trainings")
    .select("owner_id, team_id, altersstufe")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return { ok: false, error: "Training nicht gefunden." };
  const ziel = bearbeitungszielVon(training, user.id);
  if (!ziel) return { ok: false, error: "Training nicht gefunden." };
  if (!istAltersstufe(training.altersstufe))
    return { ok: false, error: "Das Training hat keine gültige Altersstufe." };

  // Welche Übung dieser Block aufnehmen darf — dieselbe Quelle, aus der der
  // Picker anbietet (`vorlagenFilterFuer`).
  const filter = vorlagenFilterFuer(training.altersstufe, trainingsteil, hauptteilkategorie);
  if (!filter)
    return {
      ok: false,
      error: `Dieser Block gehört nicht zum Trainingsschema ${altersstufeLabels[training.altersstufe]}.`,
    };
  const hkat = filter.hauptteilkategorie ?? null;

  // Vorlage mit allen Inhalten holen (RLS lässt nur Sichtbares durch).
  const { data: ex } = await supabase
    .from("exercises")
    .select(VORLAGE_SELECT)
    .eq("id", exerciseId)
    .maybeSingle<Vorlage>();
  if (!ex) return { ok: false, error: "Übung nicht verfügbar." };
  // Passt die Vorlage zu diesem Block? Erst die Altersstufe — sie ist die
  // oberste Dimension, und ihre Verletzung braucht eine eigene Meldung: «passt
  // nicht zu diesem Block» liesse den Trainer einen anderen Block suchen, den
  // es für diese Übung gar nicht gibt.
  if (!istAltersstufe(ex.altersstufe) || ex.altersstufe !== filter.altersstufe)
    return {
      ok: false,
      error: `Diese Übung gehört zur Altersstufe ${
        istAltersstufe(ex.altersstufe) ? altersstufeLabels[ex.altersstufe] : "einer anderen"
      } und passt darum nicht in ein Training der Altersstufe ${altersstufeLabels[filter.altersstufe]}.`,
    };
  // Einordnung ODER anziehende Erscheinungsform — dieselbe Entscheidung, die
  // der Picker als Abfrage stellt (`vorlagePasst` liest denselben Filter).
  if (!vorlagePasst(filter, ex))
    return { ok: false, error: "Übung passt nicht zu diesem Block." };

  // Nächste Position bestimmen (eindeutige Reihenfolge je Unterkategorie im
  // Hauptteil, sonst je Trainingsteil).
  let posQuery = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil);
  posQuery = hkat ? posQuery.eq("hauptteilkategorie", hkat) : posQuery;
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
    // (Story 1).
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
      alsAltersstufe(training.altersstufe),
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

  // «Mindestens eine, immer — nicht erst beim Veröffentlichen» (PO 2026-08-30).
  // Der DB-Trigger `trainings_stufe_pflicht` greift bewusst nur beim Anlegen,
  // damit bestehende kategorielose Trainings bearbeitbar bleiben; das Leeren
  // der letzten Kategorie im Editor fiele sonst durch beide Netze.
  if (valid.length === 0)
    return { ok: false, error: "Bitte mindestens eine Alterskategorie wählen." };

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
  const erlaubt = kategorienFuer(alsAltersstufe(training.altersstufe));
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

/** Dauer einer Zuordnung setzen (ganze Minuten ab 0) oder entfernen (null).
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

  // Jede ganze Zahl ab 0 (PO-Entscheid 2026-09-08, Story #151). Die frühere
  // Fünferschranke ist weg; die Datenbank kannte sie ohnehin nie — ihr CHECK an
  // `duration_min` verlangt bloss `>= 0`.
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0))
    return { ok: false, error: "Die Dauer muss eine ganze Zahl in Minuten sein." };

  // Trust Boundary: Das „Auffangen" trägt keine Dauer (DB-CHECK erzwingt dies;
  // hier mit klarer Meldung statt Constraint-Fehler abfangen). Gefragt wird die
  // gespeicherte Einordnung — ein Kinderfussball-Trainingsteil oder ein
  // Junioren-Block —, denn seit Story #128 gibt es das Auffangen in beiden
  // Altersstufen. Das Leeren (null) bleibt immer erlaubt.
  if (minutes !== null) {
    const { data: row } = await supabase
      .from("training_exercises")
      .select("trainingsteil")
      .eq("id", trainingExerciseId)
      .maybeSingle();
    if (row && !teilTraegtDauer(row.trainingsteil))
      return { ok: false, error: "Für das Auffangen kann keine Dauer gesetzt werden." };
  }

  const { data, error } = await supabase
    .from("training_exercises")
    .update({ duration_min: minutes })
    .eq("id", trainingExerciseId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!data) return { ok: false, error: "Zuordnung nicht gefunden." };
  revalidiereTraining(data.training_id);
  return { ok: true };
}

// ── Story #152: Notiz je Übung des Trainings ─────────────────────────────────

/**
 * Die Notiz einer Zuordnung setzen, ändern oder entfernen (AK 1/2).
 *
 * Der leere Text ist kein Fehler, sondern das Entfernen: Wer die Notiz
 * auswischt, will sie los — in der Datenbank steht dann wieder `null` und nicht
 * eine leere Zeichenkette, sonst gäbe es zwei Schreibweisen für dasselbe
 * Nichts und die Anzeige müsste beide kennen.
 *
 * Kein Owner-Filter, wie bei der Dauer: Die RLS entscheidet, wer schreiben
 * darf — an einem Team-Training jedes Mitglied (Team-Epic Story 6). Der
 * `select` danach zeigt, ob wirklich eine Zeile getroffen wurde; ein
 * Nulltreffer meldete sonst stillen Erfolg.
 *
 * Die Notiz gilt an JEDER Übung: Anders als bei der Dauer gibt es keine
 * Einordnung, die sie nicht trägt.
 */
export async function setzeNotiz(
  trainingExerciseId: string,
  notiz: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const wert = notiz.trim() === "" ? null : notiz.trim();
  // Trust Boundary: Der CHECK an `training_exercises.notiz` weist zu langen
  // Text ohnehin ab — hier mit einem Satz, der ans Feld passt, statt mit einem
  // rohen Constraint-Fehler.
  if (wert && wert.length > NOTIZ_MAX)
    return { ok: false, error: `Höchstens ${NOTIZ_MAX} Zeichen.` };

  const { data, error } = await supabase
    .from("training_exercises")
    .update({ notiz: wert })
    .eq("id", trainingExerciseId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!data) return { ok: false, error: "Zuordnung nicht gefunden." };
  revalidiereTraining(data.training_id);
  return { ok: true };
}

// ── Story #10: Übungsauswahl (Picker) ────────────────────────────────────────

/** Für den Picker passende Übungen eines Blocks laden — alle für den USER
 *  sichtbaren (RLS), eingrenzbar nach Erscheinungsform, Übungstyp und Freitext
 *  (Story #10 AC5/AC6/AC7, #23).
 *
 *  Der Bestand ist doppelt eingegrenzt: auf die Altersstufe des Trainings und
 *  auf den Zielblock (Story 6 AK 1/2, Übungswelten). Zum Zielblock zählen seit
 *  Story #134 auch die Übungen, die seine Erscheinungsform anzieht — im
 *  Juniorenfussball füllt «Explosiv und dynamisch agieren» die Explosivität und
 *  «Den Körper stabil halten» das Aufwärmen. Alles kommt aus
 *  `vorlagenFilterFuer` — derselben Funktion, nach der `addTrainingExercise`
 *  entscheidet, sonst zeigte der Picker Treffer, die das Hinzufügen abweist.
 *
 *  Die Altersstufe stammt aus dem geladenen Training, nie vom Aufrufer: sonst
 *  liesse sich der Bestand der anderen Welt hereinholen — anzeigen liesse er
 *  sich, zuordnen nicht, und der Trainer sähe Übungen, die er nicht wählen
 *  kann. */
export async function pickExercises(
  trainingId: string,
  einordnung: string,
  hauptteilkategorie?: string | null,
  opts: { form?: string[]; typ?: string[]; q?: string } = {},
): Promise<ExerciseListRow[]> {
  const supabase = await createClient();
  const { data: training } = await supabase
    .from("trainings")
    .select("altersstufe")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training || !istAltersstufe(training.altersstufe)) return [];

  const filter = vorlagenFilterFuer(training.altersstufe, einordnung, hauptteilkategorie);
  if (!filter) return [];
  return getExercises({
    altersstufe: filter.altersstufe,
    // Einordnung und anziehende Erscheinungsform als EINE ODER-Dimension: der
    // Block zeigt seinen eigenen Bestand plus die Übungen, die er anzieht
    // (Story #134 AC 1/2/4/5).
    einordnung: {
      teile: [filter.trainingsteil],
      formen: filter.erscheinungsformen ? [...filter.erscheinungsformen] : undefined,
    },
    // Die Hauptteilkategorie bleibt der harte UND-Filter: Sie grenzt eine
    // Kinderfussball-Hauptteil-Zuordnung auf die fixierte Unterkategorie ein
    // (Story #23), sie ist keine Alternative zur Einordnung. Vorschläge gibt es
    // im Kinderfussball ohnehin keine.
    hkat: filter.hauptteilkategorie ? [filter.hauptteilkategorie] : undefined,
    // Nutzerfilter — sie grenzen die ganze Vorschlagsmenge weiter ein, egal
    // woher ein Treffer kommt (Story #134 AC 6). `opts.form` ist der
    // Erscheinungsform-Filter des Trainers, nicht die Vorschlagsquelle oben.
    form: opts.form,
    typ: opts.typ,
    q: opts.q,
  });
}
