"use server";

import { legeProbetrainingFest, probeFolgen, schalteProbe } from "@/lib/kern/probe";
import type { ProbeFolgen } from "@/lib/probe";
import { revalidiereTeam } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Probetraining (#555) — dünne Adapter über den Fachkern (lib/kern/probe.ts),
 * dieselben Funktionen wie die KI-Werkzeuge.
 */

type Fehler = { ok: false; error: string; feld?: string; verfallend?: number };

/** Die Anzahl Probetrainings und das Info-Schreiben des Teams festlegen oder
 *  ändern (#555 AK 1, 2; #556 AK 1, 2). */
export async function legeProbetrainingFestAktion(
  teamId: string,
  anzahl: number,
  info: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeProbetrainingFest(a.supabase, a.userId, { teamId, anzahl, info });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  return { ok: true };
}

/** Was das Einschalten verfallen liesse — vor dem Speichern (AK 5, 16). */
export async function probeFolgenAktion(
  spielerId: string,
): Promise<{ ok: true; folgen: ProbeFolgen & { anzahlFestgelegt: boolean; probe: boolean } } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await probeFolgen(a.supabase, a.userId, { spielerId });
  if (!r.ok) return { ok: false, error: r.meldung };
  return { ok: true, folgen: r.wert };
}

/** Den Probe-Modus schalten (AK 3–5). `bestaetigt`: die Zahl verfallender
 *  Meldungen, die die Oberfläche zeigte; stimmt sie nicht mehr, kommt der
 *  aktuelle Stand mit `verfallend` zurück. */
export async function schalteProbeAktion(
  teamId: string,
  spielerId: string,
  probe: boolean,
  bestaetigt: number | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await schalteProbe(a.supabase, a.userId, { spielerId, probe, bestaetigt: bestaetigt ?? undefined });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld, verfallend: r.verfallend };
  revalidiereTeam(teamId);
  return { ok: true };
}
