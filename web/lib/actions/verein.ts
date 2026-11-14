"use server";

import { ordneSpielerZu } from "@/lib/kern/verein";
import { revalidiereTeam, revalidiereVerein } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Der Spielerbestand des Vereins (Story #579) — dünne Adapter über den
 * Fachkern (lib/kern/verein.ts). Nur die Vereinsverwaltung; die Datenebene
 * prüft die Rolle, die Seite zeigt es nur ihr.
 */

/** Spieler:innen einem Team zuordnen, alle oder keine (#579 AK 2, 20, 21).
 *  `ersetzt`: anstehende Termine, die ihre erwartete Spielerzahl verloren. */
export async function ordneSpielerZuAktion(
  teamId: string,
  teamName: string,
  spielerIds: string[],
): Promise<{ ok: true; anzahl: number; ersetzt: number } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneSpielerZu(a.supabase, a.userId, { teamId, teamName, spielerIds });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  revalidiereVerein();
  return { ok: true, anzahl: r.wert.anzahl, ersetzt: r.wert.ersetzt };
}
