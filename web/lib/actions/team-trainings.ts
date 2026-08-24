"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kopiereTraining } from "@/lib/training-kopie";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { revalidiereTraining } from "@/lib/revalidate";

/**
 * Trainings zwischen Person und Team bewegen (Team-Epic Story 5).
 *
 * Bewegt wird nie — kopiert immer. Ein Training ins Team zu stellen erzeugt
 * eine eigenständige Team-Kopie; das eigene Training bleibt unverändert
 * bestehen. Umgekehrt genauso. Dadurch gibt es keinen „geteilt"-Zustand, den
 * jemand zurücknehmen könnte, und keine Frage, wessen Änderung gewinnt.
 */

export type TeamTrainingResult =
  | { ok: true; trainingId: string }
  | { ok: false; error: string };

function revalidiereTeamBereich(teamId: string) {
  revalidatePath("/teams");
  revalidatePath(`/team/${teamId}`);
}

/** Ein eigenes Training als Kopie ins Team stellen (AK 1–4).
 *
 *  Auch Entwürfe: für das Team gilt kein Vollständigkeits-Gate — das gibt es
 *  nur beim Veröffentlichen, weil dort Fremde mitlesen. Mehrfaches Stellen
 *  erzeugt mehrere unabhängige Kopien; das ist gewollt und nicht verhindert. */
export async function stelleInsTeam(
  trainingId: string,
  teamId: string,
): Promise<TeamTrainingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const kopie = await kopiereTraining(supabase, trainingId, { art: "team", teamId });
  if (!kopie.ok) return { ok: false, error: kopie.error };

  revalidiereTeamBereich(teamId);
  return { ok: true, trainingId: kopie.neueId };
}

/** Ein Team-Training als persönliche Kopie zu sich übernehmen (AK 6).
 *
 *  Die Kopie ist privat und gehört dem Übernehmenden allein — spätere
 *  Änderungen am Team-Training erreichen sie nicht mehr. */
export async function uebernimmZuMir(teamTrainingId: string): Promise<TeamTrainingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const kopie = await kopiereTraining(supabase, teamTrainingId, {
    art: "persoenlich",
    ownerId: user.id,
  });
  if (!kopie.ok) return { ok: false, error: kopie.error };

  revalidatePath("/trainings");
  return { ok: true, trainingId: kopie.neueId };
}

/** Ein Training aus dem Team-Bestand entfernen (AK 7). Ein angesetzter Termin
 *  entfällt dabei — die Kaskade nimmt ihn mit; der Dialog nennt ihn vorher.
 *  Persönliche Kopien, die jemand übernommen hat, bleiben unberührt. */
export async function entferneTeamTraining(
  teamTrainingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: training } = await supabase
    .from("trainings")
    .select("team_id")
    .eq("id", teamTrainingId)
    .maybeSingle();
  if (!training?.team_id) return { ok: false, error: "Team-Training nicht gefunden." };

  const geloescht = await loescheTrainingMitBildern(supabase, teamTrainingId);
  if (!geloescht) return { ok: false, error: "Entfernen fehlgeschlagen." };

  revalidiereTeamBereich(training.team_id);
  return { ok: true };
}

/** Ein leeres Training direkt im Team anlegen (AK 5) — analog zum
 *  persönlichen Anlegen, nur gehört es von Anfang an dem Team. */
export async function erstelleTeamTraining(teamId: string, name: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const trimmed = name.trim();
  if (!trimmed) return;

  const { data, error } = await supabase
    .from("trainings")
    .insert({ name: trimmed, team_id: teamId, stufen: [], visibility: "private" })
    .select("id")
    .single();
  if (error || !data) return;

  revalidiereTeamBereich(teamId);
  revalidiereTraining(data.id);
  redirect(`/training/${data.id}/edit`);
}
