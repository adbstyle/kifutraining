import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { leerZuNull, terminProblem } from "@/lib/termin";
import { kurzeZeit } from "@/lib/queries/termine-fuer";
import { TERMIN_NUR_FUER_TEAM } from "@/lib/training-bedingungen";
import { ladeTrainingZumBearbeiten } from "@/lib/kern/zugriff";
import { HINWEIS_NICHTS_ENTSTANDEN, hinweisRest, kopiereTraining } from "@/lib/kern/kopie";
import { loescheTrainingMitBildern } from "@/lib/kern/loeschen";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
  type KernFehler,
} from "@/lib/kern/ergebnis";

/**
 * Termine ansetzen, ändern, entfernen und erneut ansetzen (Team-Epic
 * Stories 7–9, #198 AK 7–10, PC 3/4).
 *
 * Eine Regelquelle für den Team-Bereich (lib/actions/termine.ts) und die
 * KI-Werkzeuge «termin_ansetzen», «termin_aendern», «termin_entfernen» und
 * «training_erneut_ansetzen».
 *
 * Ein Training trägt höchstens einen Termin — das ist Schema-Invariante
 * (UNIQUE auf training_id). Wer dasselbe Training erneut ansetzt, bekommt
 * deshalb eine eigenständige Kopie: so bleibt jedes Datum bei dem Stand, mit
 * dem es tatsächlich durchgeführt wurde, und spätere Anpassungen für den
 * nächsten Termin ändern die Vergangenheit nicht.
 *
 * Wer schreiben darf, entscheidet die RLS (`tt_*`: jedes Mitglied des Teams);
 * hier steht kein Owner-Filter.
 */

/** Die bestehende Meldung, wenn ein Training schon einen Termin trägt. */
export const BEREITS_ANGESETZT =
  "Dieses Training ist bereits angesetzt. Setze es erneut an, um eine weitere Einheit zu planen.";

export type TerminAnsetzen = {
  trainingId: string;
  datum: string;
  beginn?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

/** Feld-Probleme als Kern-Fehler — oder `null`. */
function felderFehler(f: { datum?: string | null; beginn?: string | null }): KernFehler | null {
  const p = terminProblem(f);
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Ein Team-Training auf ein Datum ansetzen (Story 7 AK 1–4, #198 AK 7/10).
 *  Nur für Trainings ohne Termin — die UNIQUE-Bedingung fängt auch das
 *  Wettrennen zweier gleichzeitiger Ansetzungen ab. */
export async function setzeAn(
  supabase: SupabaseClient,
  userId: string,
  e: TerminAnsetzen,
): Promise<KernErgebnis<{ terminId: string; trainingId: string; teamId: string }>> {
  const problem = felderFehler(e);
  if (problem) return problem;

  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  // Vorab statt am Trigger `termin_nur_fuer_team_trainings`: derselbe Satz,
  // ohne Umweg über die Datenbank. Der Trigger bleibt der Rückhalt.
  const { ziel } = zugriff.wert;
  if (ziel.art !== "team")
    return fehlschlag("regel", TERMIN_NUR_FUER_TEAM, { feld: "training_id" });

  const { data, error } = await supabase
    .from("training_termine")
    .insert({
      training_id: e.trainingId,
      datum: e.datum,
      beginn: leerZuNull(e.beginn),
      ort: leerZuNull(e.ort),
      bemerkung: leerZuNull(e.bemerkung),
    })
    .select("id")
    .single<{ id: string }>();
  // 23505 ist hier eine Regel, keine Nebenläufigkeit: höchstens ein Termin je
  // Training (#198 PC 3). Die Meldung nennt den Weg dazu.
  if (error?.code === "23505")
    return fehlschlag("regel", BEREITS_ANGESETZT, { feld: "training_id" });
  if (error) return ausDbFehler(error);
  return ok({ terminId: data.id, trainingId: e.trainingId, teamId: ziel.teamId });
}

/** Die Kennung eines Termins als Eingabe (Kern-Konvention: snake_case). */
const TERMIN_FELD = { feld: "termin_id" } as const;

type TerminRoh = {
  id: string;
  training_id: string;
  datum: string;
  beginn: string | null;
  ort: string | null;
  bemerkung: string | null;
  trainings: { team_id: string | null } | null;
};

/** Einen Termin lesen, soweit die RLS ihn zeigt (`tt_select`: nur Mitglieder
 *  des Teams). Unsichtbar und nicht vorhanden bleiben ununterscheidbar. */
async function ladeTermin(
  supabase: SupabaseClient,
  terminId: string,
): Promise<KernErgebnis<TerminRoh>> {
  if (!istUuid(terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase
    .from("training_termine")
    .select("id, training_id, datum, beginn, ort, bemerkung, trainings!inner ( team_id )")
    .eq("id", terminId)
    .maybeSingle<TerminRoh>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  return ok(data);
}

export type TerminAendern = {
  terminId: string;
  /** `undefined` = unverändert. Ein Datum ist Pflicht; leeren geht nicht. */
  datum?: string;
  /** `undefined` = unverändert, `null` oder `""` = leeren. */
  beginn?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

/** Datum, Beginn, Ort oder Bemerkung eines Termins ändern (Story 7 AK 5,
 *  #198 AK 8). Nur die übergebenen Felder ändern sich; der Termin wird mit
 *  seinem Stand zusammengeführt und als Ganzes geprüft. */
export async function aendereTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminAendern,
): Promise<KernErgebnis<{ trainingId: string; teamId: string | null }>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;

  const neu = {
    datum: e.datum !== undefined ? e.datum : t.datum,
    // Postgres liefert `HH:MM:SS`; geprüft und gespeichert wird `HH:MM`.
    beginn: e.beginn !== undefined ? e.beginn : kurzeZeit(t.beginn),
    ort: e.ort !== undefined ? e.ort : t.ort,
    bemerkung: e.bemerkung !== undefined ? e.bemerkung : t.bemerkung,
  };
  const problem = felderFehler(neu);
  if (problem) return problem;

  const { data, error } = await supabase
    .from("training_termine")
    .update({
      datum: neu.datum,
      beginn: leerZuNull(neu.beginn),
      ort: leerZuNull(neu.ort),
      bemerkung: leerZuNull(neu.bemerkung),
    })
    .eq("id", e.terminId)
    .select("training_id")
    .maybeSingle<{ training_id: string }>();
  if (error) return ausDbFehler(error);
  // Zwischen Lesen und Schreiben entfernt — «nicht gefunden», nicht Erfolg.
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  return ok({ trainingId: data.training_id, teamId: t.trainings?.team_id ?? null });
}

/** Einen Termin entfernen (Story 9, #198 AK 8). Das Training bleibt im
 *  Team-Bestand — es ist danach nur nicht mehr angesetzt. Ein bereits
 *  entfernter (oder nie sichtbarer) Termin gilt als erledigt, nicht als
 *  Fehler: `trainingId` ist dann `null`. */
export async function entferneTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
): Promise<KernErgebnis<{ trainingId: string | null; teamId: string | null }>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok)
    return termin.art === "nicht_gefunden" ? ok({ trainingId: null, teamId: null }) : termin;

  const { error } = await supabase.from("training_termine").delete().eq("id", e.terminId);
  if (error) return ausDbFehler(error);
  return ok({ trainingId: termin.wert.training_id, teamId: termin.wert.trainings?.team_id ?? null });
}

/** Ein bereits angesetztes Team-Training erneut ansetzen (Story 8, #198 AK 9,
 *  PC 4).
 *
 *  Es entsteht eine eigenständige Kopie im selben Team, die den neuen Termin
 *  bekommt — das bisherige Training behält seinen. Komponiert im Kern
 *  (`kopiereTraining` → `setzeAn`), nicht über eine verschachtelte Action.
 *  Scheitert das Ansetzen der Kopie, wird sie samt Bilddateien wieder
 *  entfernt: Eine Kopie ohne Termin hätte keinen Zweck. `hinweis` sagt dem
 *  Assistenten, ob nichts entstanden ist oder welche Kopie stehen blieb. */
export async function setzeErneutAn(
  supabase: SupabaseClient,
  userId: string,
  e: TerminAnsetzen,
): Promise<KernErgebnis<{ trainingId: string; terminId: string; teamId: string }>> {
  const nichts = { hinweis: HINWEIS_NICHTS_ENTSTANDEN };
  // Die Felder zuerst: ein falsches Datum soll keine Kopie kosten.
  const problem = felderFehler(e);
  if (problem) return { ...problem, ...nichts };

  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return { ...zugriff, ...nichts };
  const { ziel } = zugriff.wert;
  if (ziel.art !== "team")
    return fehlschlag("regel", TERMIN_NUR_FUER_TEAM, { feld: "training_id", ...nichts });

  const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: ziel.teamId });
  if (!kopie.ok)
    return fehlschlag(kopie.art, kopie.error, {
      hinweis: kopie.nichtsEntstanden ? HINWEIS_NICHTS_ENTSTANDEN : hinweisRest(kopie.rest),
    });

  const termin = await setzeAn(supabase, userId, { ...e, trainingId: kopie.neueId });
  if (!termin.ok) {
    const weg = await loescheTrainingMitBildern(supabase, kopie.neueId);
    return { ...termin, hinweis: weg ? HINWEIS_NICHTS_ENTSTANDEN : hinweisRest(kopie.neueId) };
  }
  return ok({ trainingId: kopie.neueId, terminId: termin.wert.terminId, teamId: ziel.teamId });
}
