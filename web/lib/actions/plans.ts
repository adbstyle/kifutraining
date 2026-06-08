"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { TRAININGSTEIL_SLUGS } from "@/lib/plan";
import { kategorienSlugs, type TrainingsteilSlug } from "@/lib/vocab";

export type PlanFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Ergebnis einer feingranularen Editor-Aktion (sofort-persistent). */
export type PlanActionResult = { ok: boolean; error?: string };

function csv(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Editor- und Ansichtspfade eines Plans nach einer Mutation neu validieren. */
function revalidatePlan(planId: string) {
  revalidatePath(`/plan/${planId}/edit`);
  revalidatePath(`/plan/${planId}`);
  revalidatePath(`/plan/${planId}/durchfuehren`);
  revalidatePath(`/plan/${planId}/druck`);
  revalidatePath("/meine-plaene");
  revalidatePath("/plaene");
}

function validStufen(values: string[]): string[] {
  return values.filter((s) => kategorienSlugs.includes(s as never));
}

// ── Story #10: Plan anlegen ──────────────────────────────────────────────────

/** Neuen Plan anlegen (Story #10 AC1/AC2/AC3). Standardmässig privat, der USER
 *  ist Eigentümer. Leitet in den Editor weiter. */
export async function createPlan(
  _prev: PlanFormState,
  form: FormData,
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const name = clean(form.get("name"));
  const stufen = validStufen(csv(form.get("stufen")));
  if (!name) return { status: "error", errors: { name: "Bitte einen Namen angeben." } };

  const { data, error } = await supabase
    .from("training_plans")
    .insert({ name, owner_id: user.id, stufen, visibility: "private" })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Speichern fehlgeschlagen." };
  }

  revalidatePath("/meine-plaene");
  redirect(`/plan/${data.id}/edit`);
}

// ── Story #10: Übung einem Trainingsteil zuordnen ────────────────────────────

/** Eine sichtbare Übung dem passenden Trainingsteil des Plans zuordnen
 *  (Story #10 AC4/AC5/AC6). Persistiert unmittelbar. Der Phasen-Guard-Trigger
 *  erzwingt die Trainingsteil-Übereinstimmung zusätzlich auf DB-Ebene. */
export async function addPlanExercise(
  planId: string,
  trainingsteil: string,
  exerciseId: string,
): Promise<PlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!TRAININGSTEIL_SLUGS.includes(trainingsteil as TrainingsteilSlug))
    return { ok: false, error: "Ungültiger Trainingsteil." };

  // Eigentum prüfen (UX-Guard; RLS setzt es ohnehin serverseitig durch).
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan nicht gefunden." };

  // Übung holen: Name für den Platzhalter-Cache, Trainingsteil-Abgleich.
  const { data: ex } = await supabase
    .from("exercises")
    .select("id, name, trainingsteil")
    .eq("id", exerciseId)
    .maybeSingle();
  if (!ex) return { ok: false, error: "Übung nicht verfügbar." };
  if (ex.trainingsteil !== trainingsteil)
    return { ok: false, error: "Übung passt nicht zum Trainingsteil." };

  // Nächste Position im Trainingsteil bestimmen (eindeutige Reihenfolge).
  const { data: last } = await supabase
    .from("plan_exercises")
    .select("position")
    .eq("plan_id", planId)
    .eq("trainingsteil", trainingsteil)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("plan_exercises").insert({
    plan_id: planId,
    trainingsteil,
    exercise_id: exerciseId,
    exercise_name_cache: ex.name,
    position,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePlan(planId);
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
