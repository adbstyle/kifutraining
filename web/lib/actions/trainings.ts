"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseListRow } from "@/lib/queries/exercises";
import { ZIEL_MAX } from "@/lib/training";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { loescheTraining } from "@/lib/kern/loeschen";
import { kategorienSlugs } from "@/lib/vocab";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag } from "@/lib/kern/ergebnis";
import {
  TEAM_OHNE_ENTWURF,
  benenneTrainingUm,
  legeTrainingAn,
  setzeAufEntwurf,
  setzeStufen,
  setzeZiel,
  veroeffentliche,
} from "@/lib/kern/training";
import {
  entferneUebung,
  ordneUebungZu,
  setzeDauer,
  setzeNotiz as setzeNotizImKern,
  vorlagenFuerBlock,
} from "@/lib/kern/fassung";
import {
  NICHT_ANGEMELDET,
  alsActionResult,
  angemeldet,
  editorAktion,
  oberflaechenMeldung,
} from "@/lib/actions/adapter";
import type { Bedingung, FehlendeBedingung } from "@/lib/training-bedingungen";

export type TrainingFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Ergebnis einer feingranularen Editor-Aktion (sofort-persistent).
 *
 *  `error` ist immer eine fertige Meldung. `bedingung` und `varianteId` stehen
 *  zusätzlich dort, wo die Datenebene eine Veröffentlichungs-Bedingung
 *  verweigert hat (#204 AK 3): Die Action kennt die Variantennamen nicht — die
 *  Oberfläche kennt sie und kann die Meldung damit auf Variante UND Block
 *  zuspitzen, statt nur «in jeder Variante» zu sagen. */
export type TrainingActionResult = {
  ok: boolean;
  error?: string;
  bedingung?: Bedingung;
  varianteId?: string;
};

/** Ergebnis des Stufen-Setzens inkl. abweichender Übungen (Story #12 AC3).
 *
 *  `varianteId` sagt, in welcher Variante des Hauptteils die Übung steht
 *  (`null` ausserhalb): Der Abgleich umfasst ALLE Varianten, auch die gerade
 *  nicht angezeigte (#201 AK 11) — und eine Übung, die der Trainer nirgends
 *  sieht, muss benannt werden, sonst sucht er sie vergeblich. */
export type StufenResult = TrainingActionResult & {
  mismatched?: { id: string; name: string; varianteId: string | null }[];
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

// ── Story #10: Training anlegen ──────────────────────────────────────────────────

/** Neues Training anlegen (Story #10 AC1/AC2/AC3, Story 5 AK 1/2). Standardmässig
 *  privat, der USER ist Eigentümer. Leitet in den Editor weiter. */
export async function createTraining(
  _prev: TrainingFormState,
  form: FormData,
): Promise<TrainingFormState> {
  const a = await angemeldet();
  if (!a) return { status: "error", message: NICHT_ANGEMELDET };

  // Das Formular liefert Rohwerte; die Regeln — Name, Altersstufe, Kategorien —
  // stehen im Fachkern, den auch das KI-Werkzeug «training_anlegen» nutzt.
  // `zielWert` kürzt still auf ZIEL_MAX wie bisher; `validStufen` lässt nur
  // bekannte Kategorien durch.
  const r = await legeTrainingAn(a.supabase, a.userId, {
    name: clean(form.get("name")),
    altersstufe: clean(form.get("altersstufe")),
    stufen: validStufen(csv(form.get("stufen"))),
    ziel: zielWert(form.get("ziel")),
  });
  // Nur der Name hat ein eigenes Feld; alles andere steht über dem Formular.
  if (!r.ok)
    return r.feld === "name"
      ? { status: "error", errors: { name: oberflaechenMeldung(r) } }
      : { status: "error", message: oberflaechenMeldung(r) };

  revalidatePath("/trainings");
  redirect(`/training/${r.wert.id}/edit`);
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
  /** Die Variante des Hauptteils, in die die Übung kommt (#201 AK 8). Ohne sie
   *  die erste — dieselbe Regel wie `te_variante_ausrichten`; der Editor gibt
   *  sie immer ausdrücklich mit. Ausserhalb des Hauptteils ohne Bedeutung. */
  varianteId?: string,
): Promise<TrainingActionResult> {
  return editorAktion((supabase, userId) =>
    ordneUebungZu(supabase, userId, {
      trainingId,
      einordnung: trainingsteil,
      exerciseId,
      hauptteilkategorie,
      varianteId,
    }),
  );
}

// ── Story A: Veröffentlichen ist ein Zustand, keine Kopie ────────────────────

export type PublishResult =
  | { status: "published" }
  | { status: "incomplete"; missing: FehlendeBedingung[] }
  | { status: "error"; error: string };

/** Ein persönliches Training öffentlich schalten (Story A AK 1).
 *
 *  Es entsteht keine Kopie: dasselbe Training wird sichtbar und bleibt
 *  bearbeitbar. Die Community sieht damit immer den aktuellen Stand.
 *
 *  Die Bestätigung der Tragweite — inklusive des öffentlich werdenden
 *  Anzeigenamens — erfolgt in der Oberfläche (AK 2); die Regeln stehen im
 *  Fachkern (`veroeffentliche`), den auch das KI-Werkzeug
 *  «training_veroeffentlichen» nutzt. */
export async function veroeffentlicheTraining(
  trainingId: string,
): Promise<PublishResult> {
  const a = await angemeldet();
  if (!a) return { status: "error", error: NICHT_ANGEMELDET };

  const r = await veroeffentliche(a.supabase, a.userId, { trainingId });
  if (!r.ok)
    return r.art === "bedingung"
      ? { status: "incomplete", missing: r.fehlend ?? [] }
      : { status: "error", error: oberflaechenMeldung(r) };

  revalidatePath("/trainings");
  revalidiereTraining(trainingId);
  return { status: "published" };
}

/** Ein öffentliches Training auf Entwurf zurücknehmen (Story A AK 3).
 *
 *  Es verschwindet aus der Öffentlichkeit und bleibt im Übrigen unberührt.
 *  Kopien, die andere übernommen haben, bleiben bestehen — sie sind
 *  eigenständige Trainings, das Übernehmen kopiert. Die Regeln stehen in
 *  `setzeAufEntwurf`. */
export async function setzeTrainingAufEntwurf(
  trainingId: string,
): Promise<TrainingActionResult> {
  const r = await editorAktion(async (supabase, userId) => {
    const k = await setzeAufEntwurf(supabase, userId, { trainingId });
    // Die Oberfläche bietet das Zurücknehmen an einem Team-Training nie an;
    // kommt der Aufruf trotzdem, bleibt es beim bisherigen Text.
    return !k.ok && k.meldung === TEAM_OHNE_ENTWURF
      ? fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training)
      : k;
  });
  if (r.ok) revalidatePath("/trainings");
  return r;
}

// ── Story #12: Training bearbeiten, umsortieren, entfernen, löschen ──────────────

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
  return editorAktion((supabase, userId) => setzeZiel(supabase, userId, { trainingId, ziel }));
}

/** Trainingsnamen ändern (Story #12 AC1); leerer Name unzulässig. Die Regel
 *  steht im Fachkern (`benenneTrainingUm`), den auch das KI-Werkzeug
 *  «training_umbenennen» nutzt. */
export async function renameTraining(
  trainingId: string,
  name: string,
): Promise<TrainingActionResult> {
  return editorAktion((supabase, userId) => benenneTrainingUm(supabase, userId, { trainingId, name }));
}

/** Stufen eines Trainings setzen/ergänzen/entfernen (Story #12 AC2). Liefert die
 *  bereits zugeordneten Übungen zurück, die keine der neuen Stufen abdecken
 *  (AC3). */
export async function setTrainingStufen(
  trainingId: string,
  stufen: string[],
): Promise<StufenResult> {
  // Unbekannte Werte fallen still weg wie bisher; alles Weitere — mindestens
  // eine, passend zur Altersstufe — prüft der Kern (`setzeStufen`).
  return editorAktion(
    (supabase, userId) => setzeStufen(supabase, userId, { trainingId, stufen: validStufen(stufen) }),
    {
      zusatz: (w) => ({
        mismatched: w.nichtMehrPassend.map((f) => ({
          id: f.fassungId,
          name: f.name,
          varianteId: f.varianteId,
        })),
      }),
    },
  );
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
  if (!user) return { ok: false, error: NICHT_ANGEMELDET };

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
  // Übersetzt statt roh: Die RPC meldet fehlendes Schreibrecht und — seit #201 —
  // eine fremde Variante im Klartext der Datenebene, nicht in dem des Trainers.
  if (error) return alsActionResult(ausDbFehler(error), NICHT_GEFUNDEN.fassung);
  revalidiereTraining(pe.training_id);
  return { ok: true };
}

/** Eine Zuordnung aus ihrem Trainingsteil entfernen (Story #12 AC5). Scheitert
 *  sie am Gate eines öffentlichen Trainings, trägt das Ergebnis die verletzte
 *  Bedingung samt Variante mit (#204 AK 3). */
export async function removeTrainingExercise(
  trainingExerciseId: string,
): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => entferneUebung(supabase, userId, { fassungId: trainingExerciseId }),
    { nichtGefunden: NICHT_GEFUNDEN.fassung },
  );
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
  const a = await angemeldet();
  if (!a) return;

  // Kein Erfolgssignal ohne tatsächliche Löschung: Unsichtbar, fremd oder von
  // der Datenbank abgewiesen endet still wie bisher — der Dialog bleibt stehen.
  const r = await loescheTraining(a.supabase, a.userId, { trainingId });
  if (!r.ok) return;

  if (r.wert.teamId) {
    revalidiereTeam(r.wert.teamId);
    // Zurück in die Ansicht, aus der das Training verschwunden ist — dort
    // erwartet der Trainer den Beleg, dass es weg ist (Story 17).
    redirect(`/team/${r.wert.teamId}/trainings`);
  }
  revalidatePath("/trainings");
  redirect("/trainings?mine=1&deleted=1");
}

// ── Story #11: Dauer je Zuordnung erfassen/ändern/entfernen ──────────────────

/** Dauer einer Zuordnung setzen (ganze Minuten ab 0) oder entfernen (null).
 *  Persistiert unmittelbar (Story #11 AC1/AC2); die Regeln stehen in
 *  `setzeDauer`. */
export async function setExerciseDuration(
  trainingExerciseId: string,
  minutes: number | null,
): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) =>
      setzeDauer(supabase, userId, { fassungId: trainingExerciseId, minuten: minutes }),
    { nichtGefunden: NICHT_GEFUNDEN.fassung },
  );
}

// ── Story #152: Notiz je Übung des Trainings ─────────────────────────────────

/** Die Notiz einer Zuordnung setzen, ändern oder entfernen (AK 1/2); leer
 *  heisst entfernen. Die Regeln stehen in `setzeNotiz` des Fachkerns. */
export async function setzeNotiz(
  trainingExerciseId: string,
  notiz: string,
): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => setzeNotizImKern(supabase, userId, { fassungId: trainingExerciseId, notiz }),
    { nichtGefunden: NICHT_GEFUNDEN.fassung },
  );
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
 *  `zielblock` (über `vorlagenFuerBlock`) — derselben Funktion, nach der
 *  `ordneUebungZu` entscheidet, sonst zeigte der Picker Treffer, die das
 *  Hinzufügen abweist.
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
  // Anonym bleibt die Abfrage möglich (öffentliche Trainings, RLS) — darum
  // hier ohne `angemeldet()`.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Dieselbe Abfrage wie das KI-Werkzeug «training_uebungen_fuer_block», ohne
  // Leer-Grund (der Picker kennt seine Filter selbst). Ein Fehler (Training
  // unsichtbar, Block unbekannt) heisst hier wie bisher: keine Vorschläge.
  const r = await vorlagenFuerBlock(supabase, user?.id ?? null, {
    trainingId,
    einordnung,
    hauptteilkategorie,
    form: opts.form,
    typ: opts.typ,
    q: opts.q,
  });
  return r.ok ? r.wert.treffer : [];
}
