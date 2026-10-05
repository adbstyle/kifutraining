"use server";

import {
  aendereTermin,
  entferneTermin,
  lasseAusfallen,
  legeTerminFest,
  loeseTraining,
  nimmAusfallZurueck,
  ordneTrainingZu,
  type Zuordnung,
} from "@/lib/kern/termine";
import {
  aendereSerie,
  entferneSerie,
  folgeDerSerie,
  legeSerieFest,
  type FolgeAngabe,
  type SerienAenderung,
  type SerienFolge,
} from "@/lib/kern/serien";
import { teamPlan } from "@/lib/kern/team";
import { setzeVerantwortliche } from "@/lib/kern/verantwortliche";
import type { KernErgebnis } from "@/lib/kern/ergebnis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Reichweite, Wochentag } from "@/lib/serie";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";
import type { TerminFelder } from "@/lib/termin";
import type { Felder } from "@/lib/termin-felder";
import type { TerminZeile } from "@/lib/queries/termine";

/**
 * Der Kalender eines Teams (#322, #323) — dünne Adapter über den Fachkern
 * (lib/kern/termine.ts), dieselben Funktionen wie die KI-Werkzeuge. Die
 * Oberfläche sendet mit, was sie bei der Auswahl sah (PO 17): das Training
 * und, beim Ändern, nur die Felder, die sich geändert haben.
 */

export type { TerminFelder } from "@/lib/termin";

type Fehler = { ok: false; error: string };

export async function legeTerminFestAktion(
  teamId: string,
  felder: TerminFelder,
): Promise<{ ok: true; terminId: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeTerminFest(a.supabase, a.userId, {
    teamId,
    datum: felder.datum,
    beginn: felder.beginn ?? "",
    ende: felder.ende ?? "",
    ort: felder.ort,
    bemerkung: felder.bemerkung,
    felder: felder.felder,
    spielerzahl: felder.spielerzahl,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true, terminId: r.wert.terminId };
}

/** Der Dialog sendet nur, was sich gegenüber seinen Startwerten geändert hat
 *  (`geaenderteFelder`, PO 17): `undefined` heisst unverändert, ein leerer
 *  Text «leeren». Beginn und Ende kommen als Paar, die Felder des Platzes
 *  als ganze Liste (`null` = entfernen, #389). */
export async function aendereTerminAktion(
  terminId: string,
  felder: Partial<TerminFelder>,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTermin(a.supabase, a.userId, {
    terminId,
    datum: felder.datum,
    beginn: felder.beginn,
    ende: felder.ende,
    ort: felder.ort,
    bemerkung: felder.bemerkung,
    felder: felder.felder,
    spielerzahl: felder.spielerzahl,
    erwartetesTraining,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function entferneTerminAktion(
  terminId: string,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneTermin(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

/** Einen Termin ausfallen lassen oder den Grund eines ausgefallenen ändern
 *  (#327). Die Oberfläche sendet den Grund immer als Text — «» leert ihn —,
 *  also ist das der ausdrückliche Weg «Grund setzen». `erwartetesTraining`
 *  und `erwartetAusgefallen` sind, was sie bei der Auswahl sah: Das Training
 *  wird gelöst, ein inzwischen geänderter Ausfall weist ab (PO 17). */
export async function lasseAusfallenAktion(
  terminId: string,
  grund: string,
  erwartetesTraining: string | null,
  erwartetAusgefallen: boolean,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await lasseAusfallen(a.supabase, a.userId, { terminId, grund, erwartetesTraining, erwartetAusgefallen });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.geloestesTraining) revalidiereTraining(r.wert.geloestesTraining);
  return { ok: true };
}

/** Den Ausfall eines Termins zurücknehmen (#327 AK 6). */
export async function nimmAusfallZurueckAktion(terminId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await nimmAusfallZurueck(a.supabase, a.userId, { terminId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}

export async function ordneTrainingZuAktion(
  e: Zuordnung,
): Promise<{ ok: true; kopie: boolean; imBestand: string | null } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneTrainingZu(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };
  revalidiereTeam(r.wert.teamId);
  for (const id of [r.wert.trainingId, r.wert.imBestand, e.trainingId])
    if (id) revalidiereTraining(id);
  return { ok: true, kopie: r.wert.kopie, imBestand: r.wert.imBestand };
}

/** Die Termine eines Teams zur Wahl, wenn ein persönliches Training einem
 *  Termin zugeordnet werden soll (#328 AK 2): anstehende aufsteigend, dann
 *  vergangene absteigend — wie der Trainingsplan. Gebraucht wird die Liste
 *  erst, wenn der USER das Team gewählt hat; darum eine Aktion statt einer
 *  Seitenabfrage für alle Teams. Mitglied-Prüfung und Rechte macht der Kern. */
export async function termineFuerZuordnungAktion(
  teamId: string,
): Promise<{ ok: true; termine: TerminZeile[]; heute: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await teamPlan(a.supabase, a.userId, { teamId });
  if (!r.ok) return { ok: false, error: r.meldung };
  return { ok: true, termine: [...r.wert.kommend, ...r.wert.vergangen], heute: r.wert.heute };
}

export async function loeseTrainingAktion(
  terminId: string,
  erwartetesTraining: string,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await loeseTraining(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

/** Eine Terminserie festlegen (#324): die Termine entstehen ohne Training,
 *  aber mit den Verantwortlichen (#325 AK 3, PC 1), Feldern und erwarteter
 *  Spielerzahl der Serie (#391 AK 1, PC 1); die Oberfläche
 *  bestätigt ohne Anzahl (Story 3 PC 4). */
export async function legeSerieFestAktion(
  teamId: string,
  f: {
    wochentage: Wochentag[];
    von: string;
    bis: string;
    beginn: string;
    ende: string;
    ort: string;
    bemerkung: string;
    verantwortliche: string[];
    /** Felder und erwartete Spielerzahl jedes Termins (#391 AK 1). */
    felder: Felder | null;
    spielerzahl: number | null;
  },
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeSerieFest(a.supabase, a.userId, { ...f, teamId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}

/** Die Verantwortlichen eines Termins festlegen (#325 AK 1, 2, 5, 9). Die
 *  Oberfläche nimmt diesen Weg für einen einzelnen Termin (`reichweite`
 *  fehlt) und für «nur dieser» an einem Serientermin; für folgende und alle
 *  gehen die Verantwortlichen mit der Serienänderung durch Vorschau und
 *  Ausführung (`aendereSerieAktion`, PC 3, 11). `anonyme` sind die Einträge
 *  gelöschter Konten, die bleiben sollen (PC 8). */
export async function setzeVerantwortlicheAktion(
  terminId: string,
  wert: { userIds: string[]; anonyme: string[] },
  reichweite: Reichweite | undefined,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeVerantwortliche(a.supabase, a.userId, {
    terminId,
    userIds: wert.userIds,
    anonyme: wert.anonyme,
    reichweite,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}

// ── Serien mit Reichweite (#326) ──────────────────────────────────────────────
//
// «Nur dieser» läuft über `aendereTerminAktion` / `entferneTerminAktion`. Die
// Oberfläche fährt erst die Vorschau (dieselbe Rechnung, danach zurückgerollt)
// und sendet beim Ausführen mit, was sie dort sah (PO 17): die Version der
// Serie und die entfallenden Termine mit Training.

type Serienweit = "dieser_und_folgende" | "alle";
type Erwartet = { version: number; entfallend: string[] };

async function serienLauf(
  f: (s: SupabaseClient, u: string) => Promise<KernErgebnis<SerienFolge>>,
): Promise<{ ok: true; folge: SerienFolge } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await f(a.supabase, a.userId);
  if (!r.ok) return { ok: false, error: r.meldung };
  return { ok: true, folge: r.wert };
}

/** Was eine Änderung bewirkte, ohne sie zu behalten. `version` ist die der
 *  geladenen Serie: So fällt ein veralteter Plan schon hier auf, nicht erst
 *  nach der Bestätigung. Die entfallenden Termine vergleicht die Vorschau
 *  nicht — sie liefert sie erst. */
export async function vorschauSerieAktion(terminId: string, reichweite: Serienweit, aenderung: SerienAenderung, version: number) {
  return serienLauf((s, u) => aendereSerie(s, u, { terminId, reichweite, aenderung, vorschau: true, erwartet: { version, entfallend: [] } }));
}

export async function aendereSerieAktion(terminId: string, reichweite: Serienweit, aenderung: SerienAenderung, erwartet: Erwartet) {
  const r = await serienLauf((s, u) => aendereSerie(s, u, { terminId, reichweite, aenderung, erwartet }));
  if (r.ok) revalidiereTeam(r.folge.teamId);
  return r;
}

export async function vorschauSerieEntfernenAktion(terminId: string, reichweite: Serienweit, version: number) {
  return serienLauf((s, u) => entferneSerie(s, u, { terminId, reichweite, vorschau: true, erwartet: { version, entfallend: [] } }));
}

export async function entferneSerieAktion(terminId: string, reichweite: Serienweit, erwartet: Erwartet) {
  const r = await serienLauf((s, u) => entferneSerie(s, u, { terminId, reichweite, erwartet }));
  if (r.ok) revalidiereTeam(r.folge.teamId);
  return r;
}

/** Abweichende Angaben wieder der Serie folgen lassen (#326 AK 6). */
export async function folgeDerSerieAktion(terminId: string, angaben: FolgeAngabe[]): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await folgeDerSerie(a.supabase, a.userId, { terminId, angaben });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}
