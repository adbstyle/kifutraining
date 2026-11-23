"use server";

import {
  aendereSpieler,
  erneuereAbholung,
  erneuereSpielerLink,
  holeSpielerLink,
  ladeSpieler,
  ladeSpielerTeams,
  nimmSpielerAuf,
  nimmSpielerAusTeam,
  schalteAbholung,
  setzeLinkZugestellt,
} from "@/lib/kern/spieler";
import { abholUrl, spielerLinkUrl, type LinkStand, type SpielerEingabe, type SpielerFeld, type SpielerTeams } from "@/lib/spieler";
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

/** Den privaten Link einer Spieler:in holen (#436 AK 1) — als Adresse, mit
 *  dem frischen Stand (#657). Im Team, in dessen Liste man sie sieht (#583
 *  AK 14): in jedem ihrer Teams. Ohne lesbaren Stand bleibt der der Liste. */
export async function holeSpielerLinkAktion(teamId: string, spielerId: string): Promise<{ ok: true; url: string; stand?: LinkStand } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const [r, s] = await Promise.all([
    holeSpielerLink(a.supabase, a.userId, { teamId, spielerId }),
    ladeSpieler(a.supabase, teamId, spielerId),
  ]);
  if (!r.ok) return fehler(r);
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token), stand: s.ok ? s.wert.linkStand : undefined };
}

/** Den Link als zugestellt markieren oder zurücknehmen (#657 AK 1). Der
 *  Stand gilt in allen Teams der Spieler:in und im Verein (PC 1), darum laden
 *  alle neu. `geaendert` false: Er war inzwischen abgeholt. */
export async function setzeLinkZugestelltAktion(
  teamId: string,
  spielerId: string,
  zugestellt: boolean,
): Promise<{ ok: true; stand: LinkStand; geaendert: boolean } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeLinkZugestellt(a.supabase, a.userId, { teamId, spielerId, zugestellt });
  if (!r.ok) return fehler(r);
  revalidiereAlleTeams();
  revalidiereVerein();
  return { ok: true, stand: r.wert.linkStand, geaendert: r.wert.geaendert };
}

/** Den privaten Link erneuern (#436 AK 3): Der bisherige gilt nie wieder, in
 *  allen Teams der Spieler:in (#583 AK 15). Der Stand ist in jeder Liste
 *  wieder offen; die Antwort nennt die anderen Teams nicht, darum laden alle
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
