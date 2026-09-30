"use server";

import {
  aendereTermin,
  entferneTermin,
  legeTerminFest,
  loeseTraining,
  ordneTrainingZu,
  type Zuordnung,
} from "@/lib/kern/termine";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";
import type { TerminFelder } from "@/lib/termin";

/**
 * Der Kalender eines Teams (#322, #323) — dünne Adapter über den Fachkern
 * (lib/kern/termine.ts), dieselben Funktionen wie die KI-Werkzeuge. Die
 * Oberfläche sendet stets mit, was sie bei der Auswahl sah (PO 17).
 */

export type { TerminFelder } from "@/lib/termin";

type Fehler = { ok: false; error: string };

export async function legeTerminFestAktion(
  teamId: string,
  felder: TerminFelder,
): Promise<{ ok: true; terminId: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeTerminFest(a.supabase, a.userId, {
    teamId,
    datum: felder.datum,
    beginn: felder.beginn ?? "",
    ende: felder.ende ?? "",
    ort: felder.ort,
    bemerkung: felder.bemerkung,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true, terminId: r.wert.terminId };
}

/** Der Dialog sendet immer alle Felder; ein leeres heisst «leeren». */
export async function aendereTerminAktion(
  terminId: string,
  felder: TerminFelder,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTermin(a.supabase, a.userId, {
    terminId,
    datum: felder.datum,
    beginn: felder.beginn ?? null,
    ende: felder.ende ?? null,
    ort: felder.ort ?? null,
    bemerkung: felder.bemerkung ?? null,
    erwartetesTraining,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function entferneTerminAktion(
  terminId: string,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneTermin(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function ordneTrainingZuAktion(
  e: Zuordnung,
): Promise<{ ok: true; kopie: boolean; imBestand: string | null } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneTrainingZu(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };
  revalidiereTeam(r.wert.teamId);
  for (const id of [r.wert.trainingId, r.wert.imBestand, e.trainingId])
    if (id) revalidiereTraining(id);
  return { ok: true, kopie: r.wert.kopie, imBestand: r.wert.imBestand };
}

export async function loeseTrainingAktion(
  terminId: string,
  erwartetesTraining: string,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await loeseTraining(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}
