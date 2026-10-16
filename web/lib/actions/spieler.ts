"use server";

import { aendereSpieler, entferneSpieler, nimmSpielerAuf } from "@/lib/kern/spieler";
import type { SpielerEingabe, SpielerFeld } from "@/lib/spieler";
import { revalidiereTeam } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Die Spielerliste eines Teams (#434) — dünne Adapter über den Fachkern
 * (lib/kern/spieler.ts), dieselben Funktionen wie die KI-Werkzeuge.
 */

type Fehler = { ok: false; error: string; feld?: SpielerFeld };

function fehler(r: { meldung: string; feld?: string }): Fehler {
  return { ok: false, error: r.meldung, feld: r.feld as SpielerFeld | undefined };
}

export async function nimmSpielerAufAktion(
  teamId: string,
  e: SpielerEingabe,
): Promise<{ ok: true; ersetzt: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await nimmSpielerAuf(a.supabase, a.userId, { ...e, teamId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, ersetzt: r.wert.ersetzt };
}

export async function aendereSpielerAktion(spielerId: string, e: SpielerEingabe): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereSpieler(a.supabase, a.userId, { ...e, spielerId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}

export async function entferneSpielerAktion(spielerId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneSpieler(a.supabase, a.userId, { spielerId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}
