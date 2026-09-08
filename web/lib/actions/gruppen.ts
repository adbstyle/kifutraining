"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidiereTraining } from "@/lib/revalidate";
import { nameProblem } from "@/lib/gruppen";
import type { TrainingActionResult } from "@/lib/actions/trainings";

/**
 * Gruppen eines Trainings anlegen, umbenennen, entfernen (Story #149).
 *
 * Alle drei Aktionen verzichten auf einen Owner-Filter: die RLS-Policies
 * `tg_*` entscheiden, wer an eine Gruppe darf — der Eigentümer des Trainings
 * oder ein Mitglied des Teams, dem es gehört. Ein `.select().maybeSingle()`
 * deckt den Nulltreffer auf; ohne ihn meldete eine von der RLS weggefilterte
 * Zeile stillen Erfolg (dasselbe Muster wie `renameTraining`).
 *
 * Die Bezeichnung wird zweimal geprüft: hier gegen den gelesenen Bestand, damit
 * die Meldung am Feld die Regel nennt, und in der Datenbank durch den
 * Unique-Index `tg_name_je_training`. Nur die Datenbank kann zwei gleichzeitige
 * Anlagen auseinanderhalten — deshalb ist ihr Fehler `23505` hier ebenfalls
 * behandelt und nicht bloss durchgereicht.
 */

/** Die Bezeichnung ist im Training bereits vergeben — Meldung und
 *  SQLSTATE-Erkennung an einer Stelle, damit Vorabprüfung und Datenbankfehler
 *  denselben Satz erzeugen. */
const VERGEBEN = "Diese Bezeichnung gibt es in diesem Training schon.";
const UNIQUE_VERLETZUNG = "23505";

/** Die bestehenden Gruppen des Trainings — Grundlage der Vorabprüfung. */
async function bestehendeGruppen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("training_gruppen")
    .select("id, name")
    .eq("training_id", trainingId);
  return data ?? [];
}

/** Eine Gruppe am Training anlegen (AK 1/4). Liefert die angelegte Zeile, damit
 *  der Editor sie ohne Neuladen in seine Liste hängen kann. */
export async function legeGruppeAn(
  trainingId: string,
  name: string,
): Promise<{ ok: true; gruppe: { id: string; name: string } } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const getrimmt = name.trim();
  const problem = nameProblem(getrimmt, await bestehendeGruppen(supabase, trainingId));
  if (problem) return { ok: false, error: problem };

  const { data, error } = await supabase
    .from("training_gruppen")
    .insert({ training_id: trainingId, name: getrimmt })
    .select("id, name")
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VERLETZUNG) return { ok: false, error: VERGEBEN };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Training nicht gefunden." };

  revalidiereTraining(trainingId);
  return { ok: true, gruppe: { id: data.id, name: data.name } };
}

/** Die Bezeichnung einer Gruppe ändern (AK 2). Die eigene Bezeichnung zählt
 *  dabei nicht als vergeben (AK 8) — dafür kennt `nameProblem` die eigene ID. */
export async function benenneGruppe(
  gruppeId: string,
  name: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Das Training der Gruppe ist die Grundlage beider Folgeschritte: es sagt,
  // gegen welchen Bestand geprüft wird und welche Ansichten danach neu zu
  // validieren sind. Findet die RLS die Zeile nicht, ist hier Schluss.
  const { data: gruppe, error: leseFehler } = await supabase
    .from("training_gruppen")
    .select("training_id")
    .eq("id", gruppeId)
    .maybeSingle();
  if (leseFehler) return { ok: false, error: leseFehler.message };
  if (!gruppe) return { ok: false, error: "Gruppe nicht gefunden." };

  const getrimmt = name.trim();
  const problem = nameProblem(
    getrimmt,
    await bestehendeGruppen(supabase, gruppe.training_id),
    gruppeId,
  );
  if (problem) return { ok: false, error: problem };

  const { data, error } = await supabase
    .from("training_gruppen")
    .update({ name: getrimmt })
    .eq("id", gruppeId)
    .select("training_id")
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VERLETZUNG) return { ok: false, error: VERGEBEN };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Gruppe nicht gefunden." };

  revalidiereTraining(data.training_id);
  return { ok: true };
}

/** Eine Gruppe entfernen (AK 3). */
export async function entferneGruppe(gruppeId: string): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data, error } = await supabase
    .from("training_gruppen")
    .delete()
    .eq("id", gruppeId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Gruppe nicht gefunden." };

  revalidiereTraining(data.training_id);
  return { ok: true };
}
