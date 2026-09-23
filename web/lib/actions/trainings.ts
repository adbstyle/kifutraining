"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseListRow } from "@/lib/queries/exercises";
import { ZIEL_MAX } from "@/lib/training";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { kategorienSlugs } from "@/lib/vocab";
import { alsAltersstufe } from "@/lib/altersstufe";
import { NICHT_GEFUNDEN, ausDbFehler } from "@/lib/kern/ergebnis";
import { benenneTrainingUm, legeTrainingAn, setzeStufen, setzeZiel } from "@/lib/kern/training";
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
import {
  type Bedingung,
  bedingungAusFehler,
  type FehlendeBedingung,
  fehlendeBedingungenAus,
  varianteAusFehler,
} from "@/lib/training-bedingungen";

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

/** Welche Bedingungen dem Training fehlen, um öffentlich zu sein. Die Datenbank
 *  prüft dieselben und ist die letzte Instanz; hier geht es darum, das Fehlende
 *  in Klartext benennen zu können, statt einen rohen Trigger-Fehler zu zeigen. */
async function fehlendeBedingungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  ownerId: string,
): Promise<{ missing: FehlendeBedingung[] } | { error: string }> {
  // Ohne owner_id-Filter lesen: sonst käme ein Team-Training gar nicht zurück
  // und der Trainer bekäme «nicht gefunden» statt des Hinweises, dass er es
  // zuerst zu sich übernehmen muss.
  const { data: training } = await supabase
    .from("trainings")
    .select(
      "owner_id, team_id, altersstufe, stufen, training_exercises ( trainingsteil, hauptteilkategorie, variante_id ), training_varianten ( id, position )",
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

  // Die Hauptteil-Bedingung gilt je Variante (#204 AK 1) — darum kommen die
  // Varianten mit. Sortiert wird hier: PostgREST garantiert für einen
  // eingebetteten Satz keine Reihenfolge, und die Meldung soll die Varianten in
  // derselben Folge nennen wie die Oberfläche (`position`, bei Gleichstand
  // `id`, wie in `training_fehlende_bedingungen`).
  const fassungen = (training.training_exercises ?? []).map((f) => ({
    trainingsteil: f.trainingsteil,
    hauptteilkategorie: f.hauptteilkategorie,
    varianteId: f.variante_id,
  }));
  const varianten = (training.training_varianten ?? [])
    .slice()
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return {
    missing: fehlendeBedingungenAus(
      alsAltersstufe(training.altersstufe),
      training.stufen ?? [],
      fassungen,
      varianten,
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
  if (!user) return { status: "error", error: NICHT_ANGEMELDET };

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
    // Die Datenebene nennt genau eine verletzte Bedingung — und bei einer
    // Hauptteil-Bedingung die Variante dazu (#204 AK 2). Mehr als die erste gibt
    // ein `raise` nicht her; die Vorabprüfung oben zeigt dafür alle.
    return bedingung
      ? {
          status: "incomplete",
          missing: [{ bedingung, varianteId: varianteAusFehler(error.message) }],
        }
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
  if (!user) return { ok: false, error: NICHT_ANGEMELDET };

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
