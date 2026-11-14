"use server";

import { eigeneBildPfade } from "@/lib/fassung";
import {
  benenneTeamUm,
  benenneVereinUm,
  entferneAusTeam,
  entferneAusVerwaltung,
  findePerson,
  legeTeamAn,
  loeseTeamAuf,
  nimmInVerwaltungAuf,
  nimmInsTeamAuf,
  nimmMichInsTeam,
  nimmSpielerAusTeamImVerein,
  ordneSpielerZu,
} from "@/lib/kern/verein";
import { revalidiereMitgliedschaften, revalidiereTeam, revalidiereVerein } from "@/lib/revalidate";
import { raeumeVerwaisteBilder } from "@/lib/storage-aufraeumen";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";
import type { PersonSchritt } from "@/lib/verein";

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

// ── Vereinsverwaltung (Story #581) ──────────────────────────────────────────

/** Ergebnis einer Action der Vereinsverwaltung: `error` ist der fertige Satz;
 *  `feld` nennt, wo er hingehört (`name`). */
type Fehler = { ok: false; error: string; feld?: string };

const keinKonto: Fehler = { ok: false, error: NICHT_ANGEMELDET };

/** Ein Team anlegen; die Verwaltung wird dabei nicht Trainer:in. */
export async function legeTeamAnAktion(
  vereinId: string,
  name: string,
): Promise<{ ok: true; teamId: string; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await legeTeamAn(a.supabase, a.userId, { vereinId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, teamId: r.wert.teamId, name: r.wert.name };
}

/** Ein Team umbenennen (Verwaltung). */
export async function benenneTeamUmAktion(teamId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await benenneTeamUm(a.supabase, a.userId, { teamId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, name: r.wert.name };
}

/** Den Verein umbenennen. */
export async function benenneVereinUmAktion(vereinId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await benenneVereinUm(a.supabase, a.userId, { vereinId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, name: r.wert.name };
}

/** Ein Team auflösen, nur mit dem bestätigten Namen. Danach räumt die Action
 *  die Bilder aus dem Speicher (die Datenebene liefert die Pfade; mit dem Team
 *  erlischt das Recht daran, darum der Service-Role-Nachlauf). `name_falsch`
 *  nennt den aktuellen Namen (`aktuellerName`). */
export async function loeseTeamAufAktion(
  teamId: string,
  teamname: string,
): Promise<{ ok: true; spielerBleiben: number } | (Fehler & { aktuellerName?: string })> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await loeseTeamAuf(a.supabase, a.userId, { teamId, teamname });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  if (r.wert.status === "name_falsch") {
    revalidiereTeam(teamId);
    return {
      ok: false,
      error: `Das Team heisst inzwischen «${r.wert.name}». Gib diesen Namen ein, um fortzufahren.`,
      feld: "teamname",
      aktuellerName: r.wert.name,
    };
  }
  // Die Ansichten des aufgelösten Teams nicht neu rendern: ihr Rahmen leitete
  // schon in der Antwort um.
  revalidiereVerein();
  revalidiereMitgliedschaften();
  await raeumeVerwaisteBilder(eigeneBildPfade(r.wert.bilder));
  return { ok: true, spielerBleiben: r.wert.spielerBleiben };
}

/** Nachsehen, wer hinter der Adresse steckt — mit `teamId` für ein Team, ohne
 *  für die Verwaltung. */
export async function sucheVereinPersonAktion(
  vereinId: string,
  email: string,
  teamId?: string,
): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await findePerson(a.supabase, a.userId, { vereinId, email, teamId });
  return r.ok ? r.wert : { ok: false, meldung: r.meldung };
}

/** Eine Person ins Team aufnehmen (Verwaltung). */
export async function nimmInsTeamAufAktion(teamId: string, email: string): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await nimmInsTeamAuf(a.supabase, a.userId, { teamId, email });
  if (!r.ok) return { ok: false, meldung: r.meldung };
  if (r.wert.ok) {
    revalidiereTeam(teamId);
    revalidiereVerein();
    revalidiereMitgliedschaften();
  }
  return r.wert;
}

/** Sich selbst ins Team aufnehmen («Mich aufnehmen»). */
export async function nimmMichInsTeamAktion(teamId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await nimmMichInsTeam(a.supabase, a.userId, { teamId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true };
}

/** Eine Trainer:in aus dem Team entfernen — auch sich selbst. */
export async function entferneAusTeamAktion(teamId: string, userId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await entferneAusTeam(a.supabase, a.userId, { teamId, userId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true };
}

/** Eine Person in die Vereinsverwaltung aufnehmen. */
export async function nimmInVerwaltungAufAktion(vereinId: string, email: string): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await nimmInVerwaltungAuf(a.supabase, a.userId, { vereinId, email });
  if (!r.ok) return { ok: false, meldung: r.meldung };
  if (r.wert.ok) {
    revalidiereVerein();
    revalidiereMitgliedschaften();
  }
  return r.wert;
}

/** Eine Person aus der Verwaltung entfernen, auch sich selbst (austreten).
 *  Die letzte Person geht nicht (Text `LETZTE_VERWALTUNG`, `feld: "user_id"`). */
export async function entferneAusVerwaltungAktion(vereinId: string, userId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await entferneAusVerwaltung(a.supabase, a.userId, { vereinId, userId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true };
}

/** Eine Spieler:in aus einem Team nehmen; `ohneTeam`: danach in keinem mehr. */
export async function nimmSpielerAusTeamImVereinAktion(
  teamId: string,
  spielerId: string,
): Promise<{ ok: true; ohneTeam: boolean } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await nimmSpielerAusTeamImVerein(a.supabase, a.userId, { teamId, spielerId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  revalidiereVerein();
  return { ok: true, ohneTeam: r.wert.ohneTeam };
}
