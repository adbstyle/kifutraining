"use server";

import { setzeAbmeldung, setzeAnwesenheit, type AbmeldungSetzen, type AnwesenheitSetzen } from "@/lib/kern/abmeldungen";
import { setzeMeldung, type MeldungSetzen } from "@/lib/kern/spiele";
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

/** Eine Spieler:in für ein Spiel an- oder abmelden (#463 AK 2) — derselbe
 *  Fachkern wie das KI-Werkzeug «termin_abmeldung_setzen» an einem Spiel. */
export async function setzeMeldungAktion(
  teamId: string,
  e: MeldungSetzen,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeMeldung(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}

/** Ab Beginn nachtragen, ob eine Spieler:in da war (#475) — derselbe
 *  Fachkern wie das KI-Werkzeug «termin_anwesenheit_setzen». */
export async function setzeAnwesenheitAktion(
  teamId: string,
  e: AnwesenheitSetzen,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeAnwesenheit(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}
