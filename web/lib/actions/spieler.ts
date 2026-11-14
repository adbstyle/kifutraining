"use server";

import {
  aendereSpieler,
  erneuereAbholung,
  erneuereSpielerLink,
  holeSpielerLink,
  importiereSpieler,
  ladeSpielerTeams,
  nimmSpielerAuf,
  nimmSpielerAusTeam,
  pruefeSpielerImport,
  schalteAbholung,
} from "@/lib/kern/spieler";
import { abholUrl, spielerLinkUrl, type SpielerEingabe, type SpielerFeld, type SpielerTeams } from "@/lib/spieler";
import type { ImportEintrag, ImportErwartet, ImportVorschau } from "@/lib/spieler-import";
import { oeffentlicherOrigin } from "@/lib/origin";
import { revalidiereAlleTeams, revalidiereTeam, revalidiereVerein } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";

/**
 * Die Spielerliste eines Teams (#434) — dünne Adapter über den Fachkern
 * (lib/kern/spieler.ts), dieselben Funktionen wie die KI-Werkzeuge.
 */

/** `feld`: eines der vier Felder oder, wo kein Feld gemeint ist, das Ziel
 *  (`spieler_id`: inzwischen herausgenommen oder gelöscht; `team_id`). */
type Fehler = { ok: false; error: string; feld?: SpielerFeld | "spieler_id" | "team_id" };

function fehler(r: { meldung: string; feld?: string }): Fehler {
  return { ok: false, error: r.meldung, feld: r.feld as Fehler["feld"] };
}

export async function nimmSpielerAufAktion(
  teamId: string,
  e: SpielerEingabe,
): Promise<{ ok: true; spielerId: string; ersetzt: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await nimmSpielerAuf(a.supabase, a.userId, { ...e, teamId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(teamId);
  return { ok: true, spielerId: r.wert.spielerId, ersetzt: r.wert.ersetzt };
}

export async function aendereSpielerAktion(teamId: string, spielerId: string, e: SpielerEingabe): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereSpieler(a.supabase, a.userId, { ...e, spielerId, teamId });
  if (!r.ok) return fehler(r);
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}

/** Die Teams einer Spieler:in samt Stand, für die Bestätigung des
 *  Herausnehmens (#579 AK 14–16). */
export async function ladeSpielerTeamsAktion(teamId: string, spielerId: string): Promise<({ ok: true } & SpielerTeams) | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ladeSpielerTeams(a.supabase, a.userId, { teamId, spielerId });
  if (!r.ok) return fehler(r);
  return { ok: true, ...r.wert };
}

/** Eine Spieler:in aus dem Team nehmen, nicht löschen (#579 AK 10). `stand`
 *  ist der, den die Bestätigung zeigte; `geaendert`: Er galt nicht mehr, es
 *  wurde nichts geändert — die Bestätigung zeigt den neuen Stand. */
export async function nimmSpielerAusTeamAktion(
  teamId: string,
  spielerId: string,
  stand: string,
): Promise<{ ok: true } | (Fehler & { geaendert?: boolean })> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await nimmSpielerAusTeam(a.supabase, a.userId, { teamId, spielerId, stand });
  if (!r.ok) return { ...fehler(r), geaendert: r.art === "konflikt" && r.feld === "stand" };
  revalidiereTeam(teamId);
  revalidiereVerein();
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
  if (!r.ok) return { ...fehler(r), geaendert: r.art === "konflikt" && !r.wiederholbar };
  revalidiereTeam(teamId);
  return { ok: true, neu: r.wert.neu, js: r.wert.js, ersetzt: r.wert.ersetzt };
}

/** Den privaten Link einer Spieler:in holen (#436 AK 1) — als Adresse. Im
 *  Team, in dessen Liste man sie sieht (#583 AK 14): in jedem ihrer Teams. */
export async function holeSpielerLinkAktion(teamId: string, spielerId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await holeSpielerLink(a.supabase, a.userId, { teamId, spielerId });
  if (!r.ok) return fehler(r);
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token) };
}

/** Den privaten Link erneuern (#436 AK 3): Der bisherige gilt nie wieder, in
 *  allen Teams der Spieler:in (#583 AK 15). «Bezogen» steht in jeder Liste
 *  zurückgesetzt; die Antwort nennt die anderen Teams nicht, darum laden alle
 *  neu, dazu der Spielerbestand des Vereins. */
export async function erneuereSpielerLinkAktion(teamId: string, spielerId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await erneuereSpielerLink(a.supabase, a.userId, { teamId, spielerId });
  if (!r.ok) return fehler(r);
  revalidiereAlleTeams();
  revalidiereVerein();
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
