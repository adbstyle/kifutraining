"use server";

import {
  aendereTermin,
  entferneTermin as entferneTerminImKern,
  setzeAn,
  setzeErneutAn as setzeErneutAnImKern,
} from "@/lib/kern/termine";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";
import type { TerminFelder } from "@/lib/termin";

/**
 * Termine ansetzen, ändern, entfernen (Team-Epic Stories 7–9) — dünne
 * Adapter über den Fachkern (lib/kern/termine.ts), dieselben Funktionen wie
 * die KI-Werkzeuge «termin_*» und «training_erneut_ansetzen» (#198).
 *
 * Ein Training trägt höchstens einen Termin; wer es erneut ansetzt, bekommt
 * eine eigenständige Kopie (Begründung im Kern). Der Kern liefert Training
 * und Team zurück — die Adapter revalidieren damit, ohne sie nachzulesen.
 */

export type { TerminFelder } from "@/lib/termin";

export type TerminResult = { ok: true; terminId: string } | { ok: false; error: string };

/** Ein Team-Training auf ein Datum ansetzen (Story 7 AK 1–4). */
export async function erstelleTermin(
  teamTrainingId: string,
  felder: TerminFelder,
): Promise<TerminResult> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeAn(a.supabase, a.userId, { ...felder, trainingId: teamTrainingId });
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };

  revalidiereTeam(r.wert.teamId);
  revalidiereTraining(r.wert.trainingId);
  return { ok: true, terminId: r.wert.terminId };
}

/** Datum, Beginn, Ort oder Bemerkung eines Termins ändern (Story 7 AK 5).
 *  Der Dialog sendet immer alle Felder; ein leeres heisst «leeren». */
export async function aktualisiereTermin(
  terminId: string,
  felder: TerminFelder,
): Promise<{ ok: boolean; error?: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTermin(a.supabase, a.userId, {
    terminId,
    datum: felder.datum,
    beginn: felder.beginn ?? null,
    ort: felder.ort ?? null,
    bemerkung: felder.bemerkung ?? null,
  });
  if (!r.ok) return { ok: false, error: r.meldung };

  if (r.wert.teamId) revalidiereTeam(r.wert.teamId);
  revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

/** Einen Termin entfernen (Story 9). Das Training bleibt im Team-Bestand. Ein
 *  bereits entfernter Termin gilt als erledigt, nicht als Fehler. */
export async function entferneTermin(
  terminId: string,
): Promise<{ ok: boolean; error?: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneTerminImKern(a.supabase, a.userId, { terminId });
  if (!r.ok) return { ok: false, error: r.meldung };

  if (r.wert.teamId) revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

/** Ein bereits angesetztes Team-Training erneut ansetzen (Story 8): eine
 *  eigenständige Kopie im selben Team mit dem neuen Termin — das bisherige
 *  Training behält seinen. */
export async function setzeErneutAn(
  teamTrainingId: string,
  felder: TerminFelder,
): Promise<TerminResult> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeErneutAnImKern(a.supabase, a.userId, { ...felder, trainingId: teamTrainingId });
  // Wie beim Entfernen aus dem Team-Bestand: Was nicht sichtbar oder nicht
  // bearbeitbar ist, heisst in dieser Ansicht weiter «Team-Training nicht
  // gefunden.» — der Trainer steht im Team-Bereich, nicht vor einem
  // beliebigen Training. Alle anderen Regeln kommen übersetzt aus dem Kern.
  if (!r.ok)
    return {
      ok: false,
      error:
        r.art === "nicht_gefunden" || r.art === "keine_rechte"
          ? "Team-Training nicht gefunden."
          : oberflaechenMeldung(r),
    };

  revalidiereTeam(r.wert.teamId);
  revalidiereTraining(r.wert.trainingId);
  return { ok: true, terminId: r.wert.terminId };
}
