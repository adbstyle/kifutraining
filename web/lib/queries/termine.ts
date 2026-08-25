import { createClient } from "@/lib/supabase/server";
import { sortStufen } from "@/lib/training";
import type { KategorieSlug } from "@/lib/vocab";

/**
 * Query-Layer für Termine (Team-Epic Stories 7–9).
 *
 * Ein Termin hängt an genau einem Team-Training (UNIQUE) — das erneute
 * Ansetzen kopiert deshalb, statt den Termin zu verschieben. Datum und Beginn
 * sind bewusst ohne Zeitzone gespeichert: gemeint ist die Uhrzeit am
 * Trainingsort, nicht ein Zeitpunkt in UTC.
 */

export type TerminZeile = {
  id: string;
  datum: string;
  /** `HH:MM`, wenn erfasst — der Beginn ist optional (AK 17). */
  beginn: string | null;
  ort: string | null;
  bemerkung: string | null;
  training: { id: string; name: string; stufen: KategorieSlug[] };
};

type RawTermin = {
  id: string;
  datum: string;
  beginn: string | null;
  ort: string | null;
  bemerkung: string | null;
  created_at: string;
  trainings: { id: string; name: string; stufen: string[] | null; team_id: string };
};

/** Beginn auf `HH:MM` kürzen — Postgres liefert `HH:MM:SS`.
 *
 *  Exportiert, weil jede Abfrage, die einen Beginn ausliefert, ihn so kürzen
 *  MUSS: das Zeitfeld der Oberfläche und die serverseitige Prüfung akzeptieren
 *  ausschliesslich `HH:MM`. Ein roh durchgereichter Wert wird sonst erst beim
 *  Speichern als «ungültige Uhrzeit» abgewiesen. */
export function kurzeZeit(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

/** Der Trainingsplan eines Teams: alle Termine chronologisch aufsteigend.
 *
 *  Ein Select mit Embed statt zwei Abfragen — der Plan soll auch bei hundert
 *  Terminen in einem Rutsch stehen. Sortiert wird in der DB nach Datum und
 *  Beginn (ohne Beginn zuletzt am selben Tag); `created_at` ist der stabile
 *  Tiebreaker, damit zwei gleich angesetzte Termine nicht bei jedem Laden die
 *  Plätze tauschen. */
export async function getTeamPlan(teamId: string): Promise<TerminZeile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_termine")
    .select("id, datum, beginn, ort, bemerkung, created_at, trainings!inner ( id, name, stufen, team_id )")
    .eq("trainings.team_id", teamId)
    .order("datum", { ascending: true })
    .order("beginn", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as RawTermin[]).map((t) => ({
    id: t.id,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: {
      id: t.trainings.id,
      name: t.trainings.name,
      stufen: sortStufen(t.trainings.stufen ?? []),
    },
  }));
}

/** Der Termin eines einzelnen Trainings, falls es einen hat. Für den Kopf der
 *  Durchführen-Ansicht (AK 19) und die Vorbelegung beim erneuten Ansetzen. */
export async function getTerminZuTraining(trainingId: string): Promise<TerminZeile | null> {
  const supabase = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(trainingId)) return null;

  const { data, error } = await supabase
    .from("training_termine")
    .select("id, datum, beginn, ort, bemerkung, created_at, trainings!inner ( id, name, stufen, team_id )")
    .eq("training_id", trainingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const t = data as unknown as RawTermin;
  return {
    id: t.id,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: {
      id: t.trainings.id,
      name: t.trainings.name,
      stufen: sortStufen(t.trainings.stufen ?? []),
    },
  };
}
