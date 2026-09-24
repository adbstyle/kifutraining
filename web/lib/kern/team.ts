import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMeineTeamsFuer } from "@/lib/queries/teams-fuer";
import { getTeamPlanFuer, teilePlan, type TerminZeile } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Die eigenen Teams und ihr Trainingsplan lesen (#198 AK 1/3, AK 11, NFR 1)
 * — für die KI-Werkzeuge «teams_abrufen» und «team_plan_abrufen». Dieselben
 * Queries wie die Team-Übersicht und der Plan im Team-Bereich
 * (lib/queries/*-fuer.ts); was sichtbar ist, entscheidet die RLS: Teams und
 * ihre Termine sehen nur Mitglieder.
 *
 * Verwalten lassen sich Teams über den KI-Client nicht (#198 OoS 1) — dieses
 * Modul liest nur.
 */

const TECHNISCH = "Das Team liess sich gerade nicht lesen. Bitte versuche es noch einmal.";

async function ohneWurf<T>(was: string, f: () => Promise<T>): Promise<KernErgebnis<T>> {
  try {
    return ok(await f());
  } catch (e) {
    console.error(`[kern] ${was}:`, e instanceof Error ? e.message : e);
    return fehlschlag("technisch", TECHNISCH, { wiederholbar: true });
  }
}

/** Die Teams, in denen dieses Konto Mitglied ist, alphabetisch (#198 AK 1). */
export async function meineTeams(
  supabase: SupabaseClient,
  _userId: string,
): Promise<KernErgebnis<{ teams: { id: string; name: string; mitglieder: number }[] }>> {
  const r = await ohneWurf("meineTeams", () => getMeineTeamsFuer(supabase));
  if (!r.ok) return r;
  return ok({ teams: r.wert.map((t) => ({ id: t.id, name: t.name, mitglieder: t.mitgliederAnzahl })) });
}

export type TeamPlan = {
  team: { id: string; name: string };
  /** Der Tag, an dem geteilt wurde (`YYYY-MM-DD`, am Trainingsort). */
  heute: string;
  /** Ab heute, aufsteigend — der heutige Tag zählt ganz dazu. */
  kommend: TerminZeile[];
  /** Vor heute, die jüngste Einheit zuerst. */
  vergangen: TerminZeile[];
};

/** Der Trainingsplan eines eigenen Teams, bereits in Kommendes und
 *  Vergangenes geteilt (#198 AK 3, NFR 1): Der Assistent soll nicht selbst
 *  rechnen — und schon gar nicht in seiner eigenen Zeitzone. Die Grenze ist
 *  dieselbe wie im Team-Bereich (`teilePlan` am Tag des Trainingsorts). */
export async function teamPlan(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; heute?: string },
): Promise<KernErgebnis<TeamPlan>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const termine = await ohneWurf("teamPlan", () => getTeamPlanFuer(supabase, e.teamId));
  if (!termine.ok) return termine;
  const heute = e.heute ?? heuteAmTrainingsort();
  return ok({ team: team.wert, heute, ...teilePlan(termine.wert, heute) });
}
