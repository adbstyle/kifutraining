"use server";

import {
  aendereSpieler,
  entferneSpieler,
  erneuereAbholung,
  erneuereSpielerLink,
  holeSpielerLink,
  importiereSpieler,
  nimmSpielerAuf,
  pruefeSpielerImport,
  schalteAbholung,
} from "@/lib/kern/spieler";
import { abholUrl, spielerLinkUrl, type SpielerEingabe, type SpielerFeld } from "@/lib/spieler";
import type { ImportEintrag, ImportErwartet, ImportVorschau } from "@/lib/spieler-import";
import { oeffentlicherOrigin } from "@/lib/origin";
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

/** Die Vorschau eines Imports aus einer Datei (#455) — nur die vier Angaben
 *  je Zeile kommen hierher, die Datei bleibt im Browser. */
export async function pruefeSpielerImportAktion(
  teamId: string,
  zeilen: ImportEintrag[],
): Promise<{ ok: true; vorschau: ImportVorschau } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await pruefeSpielerImport(a.supabase, a.userId, { teamId, zeilen });
  if (!r.ok) return fehler(r);
  return { ok: true, vorschau: r.wert };
}

/** Den Import übernehmen (#455), ganz oder gar nicht. `geaendert`: Die Liste
 *  traf nicht mehr die bestätigte Vorschau. */
export async function importiereSpielerAktion(
  teamId: string,
  zeilen: ImportEintrag[],
  erwartet: ImportErwartet,
): Promise<{ ok: true; neu: number; js: number; ersetzt: number } | (Fehler & { geaendert?: boolean })> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await importiereSpieler(a.supabase, a.userId, { teamId, zeilen, erwartet });
  if (!r.ok) return { ...fehler(r), geaendert: r.art === "konflikt" };
  revalidiereTeam(teamId);
  return { ok: true, neu: r.wert.neu, js: r.wert.js, ersetzt: r.wert.ersetzt };
}

/** Den privaten Link einer Spieler:in holen (#436 AK 1) — als Adresse. */
export async function holeSpielerLinkAktion(spielerId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await holeSpielerLink(a.supabase, a.userId, { spielerId });
  if (!r.ok) return fehler(r);
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token) };
}

/** Den privaten Link erneuern (#436 AK 3): Der bisherige gilt nie wieder. */
export async function erneuereSpielerLinkAktion(spielerId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await erneuereSpielerLink(a.supabase, a.userId, { spielerId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token) };
}

/** Die Selbstabholung ein- oder ausschalten (#438 AK 1) — mit der Adresse. */
export async function schalteAbholungAktion(
  teamId: string,
  aktiv: boolean,
): Promise<{ ok: true; url: string; aktiv: boolean } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await schalteAbholung(a.supabase, a.userId, { teamId, aktiv });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, url: abholUrl(await oeffentlicherOrigin(), r.wert.token), aktiv: r.wert.aktiv };
}

/** Die Abholadresse erneuern (#438 AK 4). */
export async function erneuereAbholungAktion(teamId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await erneuereAbholung(a.supabase, a.userId, { teamId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, url: abholUrl(await oeffentlicherOrigin(), r.wert.token) };
}
