"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExercises, type ExerciseListRow } from "@/lib/queries/exercises";
import { TRAININGSTEIL_SLUGS, stufenAbgedeckt } from "@/lib/plan";
import { kategorienSlugs, type TrainingsteilSlug } from "@/lib/vocab";

export type PlanFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Ergebnis einer feingranularen Editor-Aktion (sofort-persistent). */
export type PlanActionResult = { ok: boolean; error?: string };

/** Ergebnis mit Auto-Privat-Hinweis (Story #12 Postcondition 2). */
export type AutoPrivateResult = PlanActionResult & { becamePrivate?: boolean };

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

// ── Story #14: Sichtbarkeit steuern & teilen ────────────────────────────────

export type PublishResult =
  | { status: "published" }
  | { status: "incomplete"; missing: string[] }
  | { status: "needs_confirmation"; count: number; names: string[] }
  | { status: "error"; error: string };

/** Plan öffentlich schalten (Story #14). Ohne Mitveröffentlichungs-Zustimmung
 *  liefert die RPC bei eigenen privaten Übungen `needs_confirmation` (Anzahl +
 *  Namen) und bei fehlenden Voraussetzungen `incomplete` (welche fehlen) —
 *  jeweils ohne Mutation. */
export async function publishPlanAction(
  planId: string,
  includePrivate: boolean,
): Promise<PublishResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Nicht angemeldet." };

  const { data, error } = await supabase.rpc("publish_plan", {
    p_plan_id: planId,
    p_include_private: includePrivate,
  });
  if (error) return { status: "error", error: error.message };

  const result = data as PublishResult;
  if (result.status === "published") revalidatePlan(planId);
  return result;
}

/** Öffentlichen Plan wieder privat schalten (Story #14 AC2). Mitveröffentlichte
 *  Übungen bleiben öffentlich (Postcondition 4). */
export async function unpublishPlanAction(planId: string): Promise<PlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase.rpc("unpublish_plan", { p_plan_id: planId });
  if (error) return { ok: false, error: error.message };
  revalidatePlan(planId);
  return { ok: true };
}

// ── Story #12: Plan bearbeiten, umsortieren, entfernen, löschen ──────────────

/** Plannamen ändern (Story #12 AC1); leerer Name unzulässig. */
export async function renamePlan(
  planId: string,
  name: string,
): Promise<PlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bitte einen Namen angeben." };

  const { error } = await supabase
    .from("training_plans")
    .update({ name: trimmed })
    .eq("id", planId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePlan(planId);
  return { ok: true };
}

/** Stufen eines Plans setzen/ergänzen/entfernen (Story #12 AC2). Liefert die
 *  bereits zugeordneten Übungen zurück, die keine der neuen Stufen abdecken
 *  (AC3), sowie ob der Plan dadurch auf privat gesetzt wurde (Postcondition 2,
 *  durch den DB-Trigger bei leeren Stufen). */
export async function setPlanStufen(
  planId: string,
  stufen: string[],
): Promise<StufenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const valid = validStufen(stufen);

  const { data: before } = await supabase
    .from("training_plans")
    .select("visibility")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { ok: false, error: "Plan nicht gefunden." };

  const { data: after, error } = await supabase
    .from("training_plans")
    .update({ stufen: valid })
    .eq("id", planId)
    .eq("owner_id", user.id)
    .select("visibility")
    .maybeSingle();
  if (error || !after) return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen." };

  // Abweichende, noch auflösbare Übungen ermitteln (Platzhalter ohne Kategorien
  // werden nicht bewertet).
  let mismatched: { id: string; name: string }[] = [];
  if (valid.length > 0) {
    const { data: rows } = await supabase
      .from("plan_exercises")
      .select("id, exercise_name_cache, exercises ( name, kategorien )")
      .eq("plan_id", planId);
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

  revalidatePlan(planId);
  return {
    ok: true,
    becamePrivate: before.visibility === "public" && after.visibility === "private",
    mismatched,
  };
}

/** Zuordnung innerhalb ihres Trainingsteils umsortieren (Story #12 AC4). */
export async function movePlanExercise(
  planExerciseId: string,
  dir: -1 | 1,
): Promise<PlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: pe } = await supabase
    .from("plan_exercises")
    .select("plan_id")
    .eq("id", planExerciseId)
    .maybeSingle();
  if (!pe) return { ok: false, error: "Zuordnung nicht gefunden." };

  const { error } = await supabase.rpc("move_plan_exercise", {
    p_plan_exercise_id: planExerciseId,
    p_dir: dir,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePlan(pe.plan_id);
  return { ok: true };
}

/** Eine Zuordnung aus ihrem Trainingsteil entfernen (Story #12 AC5). Meldet,
 *  wenn der Plan dadurch auf privat gesetzt wurde (Postcondition 2). */
export async function removePlanExercise(
  planExerciseId: string,
): Promise<AutoPrivateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: pe } = await supabase
    .from("plan_exercises")
    .select("plan_id")
    .eq("id", planExerciseId)
    .maybeSingle();
  if (!pe) return { ok: false, error: "Zuordnung nicht gefunden." };
  const planId = pe.plan_id;

  const { data: before } = await supabase
    .from("training_plans")
    .select("visibility")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { ok: false, error: "Plan nicht gefunden." };

  const { error } = await supabase
    .from("plan_exercises")
    .delete()
    .eq("id", planExerciseId);
  if (error) return { ok: false, error: error.message };

  const { data: after } = await supabase
    .from("training_plans")
    .select("visibility")
    .eq("id", planId)
    .maybeSingle();

  revalidatePlan(planId);
  return {
    ok: true,
    becamePrivate: before.visibility === "public" && after?.visibility === "private",
  };
}

/** Gesamten Plan löschen (Story #12 AC6/AC7); die Zuordnungen kaskadieren.
 *  Die Bestätigung erfolgt im UI. */
export async function deletePlan(planId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("training_plans").delete().eq("id", planId).eq("owner_id", user.id);
  revalidatePath("/meine-plaene");
  redirect("/meine-plaene?deleted=1");
}

// ── Story #11: Dauer je Zuordnung erfassen/ändern/entfernen ──────────────────

/** Dauer einer Zuordnung setzen (Vielfaches von 5 min) oder entfernen (null).
 *  Persistiert unmittelbar (Story #11 AC1/AC2). RLS stellt sicher, dass nur der
 *  Eigentümer schreibt. */
export async function setExerciseDuration(
  planExerciseId: string,
  minutes: number | null,
): Promise<PlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes % 5 !== 0))
    return { ok: false, error: "Dauer muss ein Vielfaches von 5 Minuten sein." };

  const { data, error } = await supabase
    .from("plan_exercises")
    .update({ duration_min: minutes })
    .eq("id", planExerciseId)
    .select("plan_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data) revalidatePlan(data.plan_id);
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
