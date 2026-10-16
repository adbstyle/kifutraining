"use server";

import { setzeAbmeldung, type AbmeldungSetzen } from "@/lib/kern/abmeldungen";
import { revalidiereTeam } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Ab- und Anmelden am Termin (#435) — ein dünner Adapter über den Fachkern
 * (lib/kern/abmeldungen.ts), derselbe wie das KI-Werkzeug. Die Oberfläche
 * sendet mit, wie sie den Termin sah (`gesehen`), damit eine inzwischen
 * erfolgte Verlegung abgewiesen wird (#437 AK 5).
 */
export async function setzeAbmeldungAktion(
  teamId: string,
  e: AbmeldungSetzen,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeAbmeldung(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}
