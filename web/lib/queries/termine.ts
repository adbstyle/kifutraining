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
  nochNichtVorbereitet,
  teilePlan,
  type Abweichung,
  type Plan,
  type TerminSerie,
  type TerminZeile,
  type Verantwortlicher,
  verantwortlichenNamen,
} from "@/lib/queries/termine-fuer";

/** Der Trainingsplan eines Teams mit der Anmeldung aus den Cookies —
 *  chronologisch aufsteigend (`getTeamPlanFuer`). `nurMeine`: nur die Termine,
 *  für die dieses Konto verantwortlich ist (#325 AK 11). */
export async function getTeamPlan(teamId: string, o: { nurMeine?: string } = {}): Promise<TerminZeile[]> {
  return getTeamPlanFuer(await createClient(), teamId, { nurMeine: o.nurMeine });
}

/** Der Termin, dem ein Training zugeordnet ist, falls es einen hat. Für den
 *  Kopf der Durchführen-Ansicht (AK 19). */
export async function getTerminZuTraining(trainingId: string): Promise<TerminZeile | null> {
  return getTerminZuTrainingFuer(await createClient(), trainingId);
}
