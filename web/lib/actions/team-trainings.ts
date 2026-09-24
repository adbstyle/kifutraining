"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kopiereTrainingNach, type KopieNach } from "@/lib/kern/kopie";
import { loescheTraining } from "@/lib/kern/loeschen";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { legeTrainingAn } from "@/lib/kern/training";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";

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

/** Eine Kopie über den Kern (`kopiereTrainingNach`) — der Ablauf, den alle
 *  drei Kopier-Actions teilen. Die Meldung ist die der Oberfläche; der
 *  `hinweis` für den Assistenten bleibt hier unbeachtet. Die Revalidierung
 *  übernimmt der Aufrufer, weil nur er weiss, welche Ansichten betroffen
 *  sind. */
async function kopie(e: KopieNach): Promise<TeamTrainingResult> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await kopiereTrainingNach(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };
  return { ok: true, trainingId: r.wert.id };
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
  const r = await kopie({ quelleId: trainingId, teamId });
  if (r.ok) revalidiereTeam(teamId);
  return r;
}

/** Ein Team-Training als persönliche Kopie zu sich übernehmen (AK 6).
 *
 *  Die Kopie ist privat und gehört dem Übernehmenden allein — spätere
 *  Änderungen am Team-Training erreichen sie nicht mehr. */
export async function uebernimmZuMir(teamTrainingId: string): Promise<TeamTrainingResult> {
  const r = await kopie({ quelleId: teamTrainingId });
  if (r.ok) revalidatePath("/trainings");
  return r;
}

/** Ein Training aus dem Team-Bestand entfernen (AK 7). Ein angesetzter Termin
 *  entfällt dabei — die Kaskade nimmt ihn mit; der Dialog nennt ihn vorher.
 *  Persönliche Kopien, die jemand übernommen hat, bleiben unberührt. */
export async function entferneTeamTraining(
  teamTrainingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };

  const r = await loescheTraining(a.supabase, a.userId, { trainingId: teamTrainingId, nurTeam: true });
  // Die bisherigen Texte des Team-Bestands: unsichtbar oder persönlich heisst
  // hier «Team-Training nicht gefunden.», ein abgewiesenes Löschen
  // «Entfernen fehlgeschlagen.».
  if (!r.ok)
    return {
      ok: false,
      error:
        r.art === "nicht_gefunden" || r.art === "keine_rechte"
          ? "Team-Training nicht gefunden."
          : "Entfernen fehlgeschlagen.",
    };

  revalidiereTeam(r.wert.teamId!);
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
  const a = await angemeldet();
  if (!a) return { ok: false, error: "Nicht angemeldet." };

  // Dieselben Regeln wie beim persönlichen Anlegen und beim KI-Werkzeug
  // (lib/kern/training.ts) — seit #192 auch die Namensgrenze von 80 Zeichen.
  const r = await legeTrainingAn(a.supabase, a.userId, { name, altersstufe, stufen, teamId });
  // Ein stilles `return` liesse den Dialog wortlos stehen: der Erfolg zeigt
  // sich nur an der Weiterleitung, ein Fehlschlag an gar nichts.
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };

  revalidiereTeam(teamId);
  revalidiereTraining(r.wert.id);
  redirect(`/training/${r.wert.id}/edit`);
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
  const r = await kopie({ quelleId, teamId: ziel.art === "team" ? ziel.teamId : undefined });
  if (!r.ok) return r;

  if (ziel.art === "team") revalidiereTeam(ziel.teamId);
  revalidatePath("/trainings");
  return r;
}
