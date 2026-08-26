"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { kopiereTraining } from "@/lib/training-kopie";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";

/**
 * Termine ansetzen, ändern, entfernen (Team-Epic Stories 7–9).
 *
 * Ein Training trägt höchstens einen Termin — das ist Schema-Invariante
 * (UNIQUE auf training_id). Wer dasselbe Training erneut ansetzt, bekommt
 * deshalb eine eigenständige Kopie: so bleibt jedes Datum bei dem Stand, mit
 * dem es tatsächlich durchgeführt wurde, und spätere Anpassungen für den
 * nächsten Termin ändern die Vergangenheit nicht.
 */

export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

export type TerminResult = { ok: true; terminId: string } | { ok: false; error: string };

/** Leere Eingaben sind „nicht erfasst", nicht „leerer Text". */
function leerZuNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function pruefeFelder(f: TerminFelder): { ok: true } | { ok: false; error: string } {
  // `YYYY-MM-DD` kommt vom nativen Datumsfeld; alles andere ist ein
  // manipulierter Aufruf und wird hier abgewiesen statt in der DB.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.datum ?? ""))
    return { ok: false, error: "Bitte ein Datum angeben." };
  const beginn = leerZuNull(f.beginn);
  if (beginn && !/^\d{2}:\d{2}$/.test(beginn))
    return { ok: false, error: "Bitte eine gültige Uhrzeit angeben." };
  return { ok: true };
}

async function revalidiereTeamPlan(supabase: Awaited<ReturnType<typeof createClient>>, trainingId: string) {
  const { data } = await supabase
    .from("trainings")
    .select("team_id")
    .eq("id", trainingId)
    .maybeSingle();
  if (data?.team_id) revalidiereTeam(data.team_id);
  revalidiereTraining(trainingId);
}

/** Ein Team-Training auf ein Datum ansetzen (Story 7 AK 1–4). Nur für
 *  Trainings ohne Termin — die UNIQUE-Bedingung fängt das Wettrennen zweier
 *  gleichzeitiger Ansetzungen ab. */
export async function erstelleTermin(
  teamTrainingId: string,
  felder: TerminFelder,
): Promise<TerminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const geprueft = pruefeFelder(felder);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase
    .from("training_termine")
    .insert({
      training_id: teamTrainingId,
      datum: felder.datum,
      beginn: leerZuNull(felder.beginn),
      ort: leerZuNull(felder.ort),
      bemerkung: leerZuNull(felder.bemerkung),
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      error: error?.code === "23505"
        ? "Dieses Training ist bereits angesetzt. Setze es erneut an, um eine weitere Einheit zu planen."
        : (error?.message ?? "Ansetzen fehlgeschlagen."),
    };

  await revalidiereTeamPlan(supabase, teamTrainingId);
  return { ok: true, terminId: data.id };
}

/** Datum, Beginn, Ort oder Bemerkung eines Termins ändern (Story 7 AK 5). */
export async function aktualisiereTermin(
  terminId: string,
  felder: TerminFelder,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const geprueft = pruefeFelder(felder);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase
    .from("training_termine")
    .update({
      datum: felder.datum,
      beginn: leerZuNull(felder.beginn),
      ort: leerZuNull(felder.ort),
      bemerkung: leerZuNull(felder.bemerkung),
    })
    .eq("id", terminId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Termin nicht gefunden." };

  await revalidiereTeamPlan(supabase, data.training_id);
  return { ok: true };
}

/** Einen Termin entfernen (Story 9). Das Training bleibt im Team-Bestand — es
 *  ist danach nur nicht mehr angesetzt. Ein bereits entfernter Termin gilt als
 *  erledigt, nicht als Fehler. */
export async function entferneTermin(
  terminId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("training_termine")
    .delete()
    .eq("id", terminId)
    .select("training_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true };

  await revalidiereTeamPlan(supabase, data.training_id);
  return { ok: true };
}

/** Ein bereits angesetztes Team-Training erneut ansetzen (Story 8).
 *
 *  Es entsteht eine eigenständige Kopie im selben Team, die den neuen Termin
 *  bekommt — das bisherige Training behält seinen. Scheitert etwas, räumt der
 *  Kopier-Baustein auf; ein Termin ohne Training kann so nicht entstehen. */
export async function setzeErneutAn(
  teamTrainingId: string,
  felder: TerminFelder,
): Promise<TerminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const geprueft = pruefeFelder(felder);
  if (!geprueft.ok) return geprueft;

  const { data: quelle } = await supabase
    .from("trainings")
    .select("team_id")
    .eq("id", teamTrainingId)
    .maybeSingle();
  if (!quelle?.team_id) return { ok: false, error: "Team-Training nicht gefunden." };

  // Herkunft nur erben, nicht stempeln: die neue Einheit IST dasselbe Training
  // zu einem neuen Datum, nicht die Übernahme eines fremden. Ein frischer
  // Stempel trüge den Namen der Quelle — also den eigenen — und ergäbe in der
  // Anzeige ein «basiert auf sich selbst».
  const kopie = await kopiereTraining(
    supabase,
    teamTrainingId,
    { art: "team", teamId: quelle.team_id },
    { herkunft: "erben" },
  );
  if (!kopie.ok) return { ok: false, error: kopie.error };

  const termin = await erstelleTermin(kopie.neueId, felder);
  if (!termin.ok) {
    // Kein Training ohne Zweck stehen lassen: die Kopie war nur für diesen
    // Termin gedacht — samt ihrer Bilddateien wieder abräumen.
    await loescheTrainingMitBildern(supabase, kopie.neueId);
    return termin;
  }

  revalidiereTeam(quelle.team_id);
  return termin;
}
