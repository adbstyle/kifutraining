import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { ladeSpieler, ladeSpielerliste } from "@/lib/kern/spieler";
import { ausDbFehler, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";
import {
  fasseFensterZusammen,
  keineMediane,
  meldeMediane,
  type MeldeAnzahlen,
  type Meldeart,
  type MeldeMediane,
  type MeldeZeile,
} from "@/lib/meldezeitpunkte";
import {
  teamSummen,
  teilnahmeZahlen,
  zeitraumFehler,
  type TeamSummen,
  type TeilnahmeArt,
  type TeilnahmeZahlen,
  type TeilnahmeZeile,
  type Zeitraum,
} from "@/lib/teilnahme";

/**
 * Die Teilnahme-Statistik einer Spieler:in im Team (#700) — für die Spalte
 * neben der Spielerliste und das KI-Werkzeug «spieler_teilnahme_abrufen».
 * Beide rufen diese Funktion, damit sie für dieselbe Spieler:in und denselben
 * Zeitraum dieselben Zahlen liefern (NFR 3).
 *
 * Nur Mitglieder des Teams (NFR 2): `pruefeTeamMitglied` und die Zuordnung der
 * Spieler:in zum Team (`ladeSpieler`); gezählt wird in `spieler_teilnahme`
 * unter derselben RLS. Ohne Zeitraum zählt die ganze Zeit im Team, ein
 * einzelner Tag lässt die andere Seite offen (AK 2, 7).
 */
export type SpielerTeilnahme = {
  team: { id: string; name: string };
  spieler: { id: string; vorname: string; nachname: string };
  zeitraum: Zeitraum;
  zahlen: Record<TeilnahmeArt, TeilnahmeZahlen>;
};

export async function spielerTeilnahme(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<SpielerTeilnahme>> {
  const zeitraum: Zeitraum = { von: e.von || null, bis: e.bis || null };
  const problem = zeitraumFehler(zeitraum);
  if (problem) return fehlschlag("eingabe", problem.text, { feld: problem.feld });

  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const spieler = await ladeSpieler(supabase, e.teamId, e.spielerId);
  if (!spieler.ok) return spieler;

  const { data, error } = await supabase.rpc("spieler_teilnahme", {
    p_team: e.teamId,
    p_spieler: e.spielerId,
    p_von: zeitraum.von,
    p_bis: zeitraum.bis,
  });
  if (error) return ausDbFehler(error);
  return ok({
    team: team.wert,
    spieler: { id: spieler.wert.id, vorname: spieler.wert.vorname, nachname: spieler.wert.nachname },
    zeitraum,
    zahlen: teilnahmeZahlen((data ?? []) as TeilnahmeZeile[]),
  });
}

/**
 * Die Teilnahme aller Spieler:innen eines Teams (#702) — für den Reiter
 * «Teilnahme» und, über `teamTeilnahme`, das KI-Werkzeug
 * «team_teilnahme_abrufen». Gezählt wird in `team_teilnahme` mit derselben
 * Zählregel wie `spieler_teilnahme` (`teilnahme_kern`), darum liefern
 * Übersicht, Einzelteilnahme und KI für dieselbe Spieler:in und denselben
 * Zeitraum dieselben Zahlen (NFR 3). Nur Mitglieder des Teams (NFR 2).
 *
 * `zahlen` nennt nur Spieler:innen mit mindestens einem gezählten Termin;
 * wer fehlt, hat überall 0 (`teilnahmeZahlen([])`).
 */
export type TeamTeilnahmeZahlen = {
  team: { id: string; name: string };
  zeitraum: Zeitraum;
  zahlen: Map<string, Record<TeilnahmeArt, TeilnahmeZahlen>>;
};

export async function teamTeilnahmeZahlen(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<TeamTeilnahmeZahlen>> {
  const zeitraum: Zeitraum = { von: e.von || null, bis: e.bis || null };
  const problem = zeitraumFehler(zeitraum);
  if (problem) return fehlschlag("eingabe", problem.text, { feld: problem.feld });

  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;

  const { data, error } = await supabase.rpc("team_teilnahme", {
    p_team: e.teamId,
    p_von: zeitraum.von,
    p_bis: zeitraum.bis,
  });
  if (error) return ausDbFehler(error);
  const zahlen = new Map(
    ((data ?? []) as { spieler_id: string; zeilen: unknown }[]).map((z) => [
      z.spieler_id,
      teilnahmeZahlen(Array.isArray(z.zeilen) ? (z.zeilen as TeilnahmeZeile[]) : []),
    ]),
  );
  return ok({ team: team.wert, zeitraum, zahlen });
}

/** Die Teilnahme jeder Spieler:in, die aktuell im Team ist (auch
 *  Schnuppernde), nach Name — wer im Zeitraum nichts gezählt hat, mit 0. Für
 *  das KI-Werkzeug; die Seite nimmt die Spielerliste aus ihrer Ansicht. */
export type TeamTeilnahme = {
  team: { id: string; name: string };
  zeitraum: Zeitraum;
  spieler: { id: string; vorname: string; nachname: string; zahlen: Record<TeilnahmeArt, TeilnahmeZahlen> }[];
};

export async function teamTeilnahme(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<TeamTeilnahme>> {
  const [zahlen, liste] = await Promise.all([
    teamTeilnahmeZahlen(supabase, userId, e),
    ladeSpielerliste(supabase, userId, { teamId: e.teamId }),
  ]);
  if (!zahlen.ok) return zahlen;
  if (!liste.ok) return liste;
  const leer = teilnahmeZahlen([]);
  return ok({
    team: zahlen.wert.team,
    zeitraum: zahlen.wert.zeitraum,
    spieler: liste.wert.spieler.map((s) => ({
      id: s.id,
      vorname: s.vorname,
      nachname: s.nachname,
      zahlen: zahlen.wert.zahlen.get(s.id) ?? leer,
    })),
  });
}

/**
 * Die Meldezeitpunkte aller Spieler:innen eines Teams (#703) — für den Reiter
 * «Meldezeitpunkte» und, über `teamMeldezeitpunkte`, das KI-Werkzeug
 * «team_meldezeitpunkte_abrufen». Gezählt wird in `team_meldezeitpunkte` auf
 * derselben Zählbasis wie die Teilnahme (`teilnahme_kern`): je Spieler:in und
 * Meldeart Anzahl, Median und die fünf Fenster. Nur Mitglieder des Teams
 * (NFR 2). Wer keine Meldung mit festgehaltenem Zeitpunkt hat, fehlt.
 */
export type TeamMeldeZahlen = {
  team: { id: string; name: string };
  zeitraum: Zeitraum;
  zeilen: MeldeZeile[];
};

export async function teamMeldeZahlen(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<TeamMeldeZahlen>> {
  const zeitraum: Zeitraum = { von: e.von || null, bis: e.bis || null };
  const problem = zeitraumFehler(zeitraum);
  if (problem) return fehlschlag("eingabe", problem.text, { feld: problem.feld });

  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;

  const { data, error } = await supabase.rpc("team_meldezeitpunkte", {
    p_team: e.teamId,
    p_von: zeitraum.von,
    p_bis: zeitraum.bis,
  });
  if (error) return ausDbFehler(error);
  return ok({ team: team.wert, zeitraum, zeilen: (data ?? []) as MeldeZeile[] });
}

/** Die Meldezeitpunkte für den KI-Assistenten (AK 13): je Spieler:in, die
 *  aktuell im Team ist, die Mediane (ohne Meldung: keine Angabe), und für das
 *  Team die Fenster sowie «ohne Abmeldung gefehlt» und «nicht gemeldet» — die
 *  aus `team_teilnahme`, damit sie der Teilnahme-Übersicht gleichen (NFR 3). */
export type TeamMeldezeitpunkte = {
  team: { id: string; name: string };
  zeitraum: Zeitraum;
  spieler: { id: string; vorname: string; nachname: string; mediane: MeldeMediane; anzahl: MeldeAnzahlen }[];
  fenster: Record<Meldeart, number[]>;
  summen: TeamSummen;
};

export async function teamMeldezeitpunkte(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<TeamMeldezeitpunkte>> {
  const [melde, teilnahme, liste] = await Promise.all([
    teamMeldeZahlen(supabase, userId, e),
    teamTeilnahmeZahlen(supabase, userId, e),
    ladeSpielerliste(supabase, userId, { teamId: e.teamId }),
  ]);
  if (!melde.ok) return melde;
  if (!teilnahme.ok) return teilnahme;
  if (!liste.ok) return liste;
  const ids = liste.wert.spieler.map((s) => s.id);
  const je = meldeMediane(melde.wert.zeilen);
  return ok({
    team: melde.wert.team,
    zeitraum: melde.wert.zeitraum,
    spieler: liste.wert.spieler.map((s) => ({
      id: s.id,
      vorname: s.vorname,
      nachname: s.nachname,
      ...(je.get(s.id) ?? keineMediane()),
    })),
    fenster: fasseFensterZusammen(melde.wert.zeilen, ids),
    summen: teamSummen(teilnahme.wert.zahlen, ids),
  });
}
