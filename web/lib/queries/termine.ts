import { createClient } from "@/lib/supabase/server";
import { getTeamPlanFuer, getTerminZuTrainingFuer, type TerminZeile } from "@/lib/queries/termine-fuer";

/**
 * Query-Layer für Termine (Team-Epic Stories 7–9) — die Cookie-Wrapper.
 * Abfrage, Mapping, Typen und die Teilung des Plans stehen in
 * termine-fuer.ts (Epic #190), damit der Fachkern sie mit einem beliebigen
 * Nutzer-Client aufrufen kann.
 */

export {
  kurzeZeit,
  teilePlan,
  type Plan,
  type TerminZeile,
} from "@/lib/queries/termine-fuer";

/** Der Trainingsplan eines Teams mit der Anmeldung aus den Cookies —
 *  chronologisch aufsteigend (`getTeamPlanFuer`). */
export async function getTeamPlan(teamId: string): Promise<TerminZeile[]> {
  return getTeamPlanFuer(await createClient(), teamId);
}

/** Der Termin eines einzelnen Trainings, falls es einen hat. Für den Kopf der
 *  Durchführen-Ansicht (AK 19) und die Vorbelegung beim erneuten Ansetzen. */
export async function getTerminZuTraining(trainingId: string): Promise<TerminZeile | null> {
  return getTerminZuTrainingFuer(await createClient(), trainingId);
}
