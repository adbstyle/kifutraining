"use server";

import { legeTeamInfosFest } from "@/lib/kern/team-infos";
import { revalidiereTeam } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/** Infos zum Team (#598) — dünner Adapter über den Fachkern
 *  (lib/kern/team-infos.ts), dieselbe Funktion wie das KI-Werkzeug. Leerer
 *  Text entfernt die Infos (AK 1). */
export async function legeTeamInfosFestAktion(
  teamId: string,
  text: string | null,
): Promise<{ ok: true; entfernt: boolean } | { ok: false; error: string; feld?: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeTeamInfosFest(a.supabase, a.userId, { teamId, text });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  return { ok: true, entfernt: r.wert.text === null };
}
