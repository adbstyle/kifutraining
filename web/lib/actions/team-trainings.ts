"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kopiereTraining } from "@/lib/training-kopie";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { istAltersstufe, kategorienFuer } from "@/lib/altersstufe";
import { fehlerMeldung } from "@/lib/training-bedingungen";

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

  revalidiereTeam(teamId);
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

  revalidiereTeam(training.team_id);
  return { ok: true };
}

/** Ein leeres Training direkt im Team anlegen (AK 5) — analog zum
 *  persönlichen Anlegen, nur gehört es von Anfang an dem Team.
 *
 *  «Analog» heisst auch: dieselben Pflichtangaben. Die Altersstufe wird hier
 *  gewählt und steht danach fest, und mindestens eine Alterskategorie gehört
 *  dazu (Story 5 AK 1/2, Übungswelten) — die Datenebene führt die Spalte ohne
 *  Default und verlangt die Kategorie per Trigger. */
export async function erstelleTeamTraining(
  teamId: string,
  name: string,
  altersstufe: string,
  stufen: string[],
): Promise<{ ok: false; error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bitte einen Namen angeben." };
  if (!istAltersstufe(altersstufe))
    return { ok: false, error: "Bitte die Altersstufe wählen." };

  const erlaubt = kategorienFuer(altersstufe);
  const gewaehlt = stufen.filter((s) => erlaubt.includes(s));
  if (gewaehlt.length === 0)
    return { ok: false, error: "Bitte mindestens eine Alterskategorie wählen." };
  if (gewaehlt.length !== stufen.length)
    return {
      ok: false,
      error:
        "Diese Alterskategorie gehört nicht zur gewählten Altersstufe. " +
        "Wähle nur Kategorien dieser Altersstufe.",
    };

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      name: trimmed,
      team_id: teamId,
      altersstufe,
      stufen: gewaehlt,
      visibility: "private",
    })
    .select("id")
    .single();
  // Ein stilles `return` liesse den Dialog wortlos stehen: der Erfolg zeigt
  // sich nur an der Weiterleitung, ein Fehlschlag an gar nichts. Übersetzt statt
  // roh: die Marker der Datenebene versteht sonst niemand.
  if (error || !data)
    return {
      ok: false,
      error: error ? fehlerMeldung(error.message) : "Erstellen fehlgeschlagen.",
    };

  revalidiereTeam(teamId);
  revalidiereTraining(data.id);
  redirect(`/training/${data.id}/edit`);
}

/** Ein öffentliches Training übernehmen (Story 11) — zu sich selbst oder in ein
 *  Team.
 *
 *  Es entsteht eine eigenständige Kopie mit eigenen Bild- und Diagrammkopien.
 *  Das Original bleibt unberührt, spätere Änderungen wirken in keine Richtung,
 *  und mehrfaches Übernehmen ist ausdrücklich möglich — jede Kopie ist ein
 *  eigenes Trainingsobjekt. */
export async function uebernimmTraining(
  quelleId: string,
  ziel: { art: "persoenlich" } | { art: "team"; teamId: string },
): Promise<TeamTrainingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const kopie = await kopiereTraining(
    supabase,
    quelleId,
    ziel.art === "team" ? { art: "team", teamId: ziel.teamId } : { art: "persoenlich", ownerId: user.id },
  );
  if (!kopie.ok) return { ok: false, error: kopie.error };

  if (ziel.art === "team") revalidiereTeam(ziel.teamId);
  revalidatePath("/trainings");
  return { ok: true, trainingId: kopie.neueId };
}
