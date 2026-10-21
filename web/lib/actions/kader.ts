"use server";

import {
  aendereZuteilung,
  benenneKaderUm,
  entferneKader,
  kaderEntfernenFolgen,
  legeKaderAn,
  setzeTerminKader,
  type KaderEntfernenFolgen,
} from "@/lib/kern/kader";
import { revalidiereTeam } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Die Kader eines Teams (#452) — dünne Adapter über den Fachkern
 * (lib/kern/kader.ts), dieselben Funktionen wie die KI-Werkzeuge.
 *
 * `verfallend`: Die Änderung liesse so viele Abmeldungen verfallen (#453
 * AK 10) — die Oberfläche fragt nach und sendet die Zahl als `bestaetigt`
 * zurück. Stimmt sie inzwischen nicht mehr, kommt die neue (AK 12).
 */

type Fehler = { ok: false; error: string; feld?: string; verfallend?: number; verfallendSpiele?: number; kennzeichnungen?: number };

function fehler(r: { meldung: string; feld?: string; verfallend?: number; verfallendSpiele?: number; kennzeichnungen?: number }): Fehler {
  return {
    ok: false,
    error: r.meldung,
    feld: r.feld,
    verfallend: r.verfallend,
    verfallendSpiele: r.verfallendSpiele,
    kennzeichnungen: r.kennzeichnungen,
  };
}

export async function legeKaderAnAktion(teamId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeKaderAn(a.supabase, a.userId, { teamId, name });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, name: r.wert.name };
}

export async function benenneKaderUmAktion(kaderId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await benenneKaderUm(a.supabase, a.userId, { kaderId, name });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true, name: r.wert.name };
}

export async function entferneKaderAktion(
  kaderId: string,
  bestaetigt: number | false = false,
): Promise<{ ok: true; name: string; verfallen: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneKader(a.supabase, a.userId, { kaderId, bestaetigt: bestaetigt === false ? undefined : bestaetigt });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true, name: r.wert.name, verfallen: r.wert.verfallen };
}

/** Spieler:innen Kadern zuteilen und aus Kadern nehmen (AK 5, 6). */
export async function aendereZuteilungAktion(
  teamId: string,
  e: { spielerIds: string[]; dazu: string[]; weg: string[] },
  bestaetigt: number | false = false,
): Promise<{ ok: true; verfallen: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereZuteilung(a.supabase, a.userId, {
    teamId,
    ...e,
    bestaetigt: bestaetigt === false ? undefined : bestaetigt,
  });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, verfallen: r.wert.verfallen };
}

/** Was das Entfernen eines Kaders bewirkte (#453 AK 11) — vor der Rückfrage. */
export async function kaderEntfernenFolgenAktion(kaderId: string): Promise<{ ok: true; folgen: KaderEntfernenFolgen } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await kaderEntfernenFolgen(a.supabase, a.userId, { kaderId });
  if (!r.ok) return fehler(r);
  return { ok: true, folgen: r.wert };
}

/** Die Kader eines einzelnen Termins setzen (#453 AK 1, 3) — auch «nur
 *  dieser» an einem Serientermin. */
export async function setzeTerminKaderAktion(
  terminId: string,
  kaderIds: string[],
  bestaetigt: number | false = false,
): Promise<{ ok: true; verfallen: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeTerminKader(a.supabase, a.userId, {
    terminId,
    kaderIds,
    bestaetigt: bestaetigt === false ? undefined : bestaetigt,
  });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true, verfallen: r.wert.verfallen };
}
