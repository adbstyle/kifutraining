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
import { aendereTrainer, setzeAbsage, type AbsageSetzen, type TrainerAendern } from "@/lib/kern/trainer";
import type { KernErgebnis } from "@/lib/kern/ergebnis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Reichweite, Wochentag } from "@/lib/serie";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";
import type { TerminFelder, TerminTreffpunkt } from "@/lib/termin";
import type { Felder } from "@/lib/termin-felder";
import type { Mindestbesetzung } from "@/lib/besetzung";
import type { TerminZeile } from "@/lib/queries/termine";

/**
 * Der Kalender eines Teams (#322, #323) — dünne Adapter über den Fachkern
 * (lib/kern/termine.ts), dieselben Funktionen wie die KI-Werkzeuge. Die
 * Oberfläche sendet mit, was sie bei der Auswahl sah (PO 17): das Training
 * und, beim Ändern, nur die Felder, die sich geändert haben.
 */

export type { TerminFelder } from "@/lib/termin";

/** `verfallend`: Das Verlegen liesse so viele Abmeldungen verfallen (#437
 *  AK 1), davon `nachtraege` Nachträge zur Anwesenheit (#475 AK 12); erneut
 *  mit `bestaetigt` senden, wenn das gewollt ist. */
type Fehler = {
  ok: false;
  error: string;
  verfallend?: number;
  nachtraege?: number;
  /** Davon Absagen von Trainer:innen (#520 AK 11). */
  absagen?: number;
  /** Ein Spiel (#463 AK 26): Die Verlegung rückt die Meldefrist ins Abgelaufene. */
  fristAbgelaufen?: boolean;
  /** Ein Spiel entfernen (#463 AK 27): so viele Meldungen verschwinden. */
  verschwindend?: number;
  /** Davon Kennzeichnungen als nicht aufgeboten (#464 AK 10). */
  kennzeichnungen?: number;
  /** Davon Anmeldungen von Probe-Spieler:innen (#555 AK 14). */
  anmeldungen?: number;
  /** Ein Training (#561 PC 5): Mit dem neuen Beginn entfiele der Treffpunkt. */
  treffpunktEntfaellt?: boolean;
};

export async function legeTerminFestAktion(
  teamId: string,
  felder: TerminFelder,
  /** Für welche Kader der Termin gilt (#453 AK 1); leer = für alle. */
  kaderIds: string[],
  /** Die Eingeladenen und die Verantwortliche (#519 AK 1). */
  trainer: { eingeladene: string[]; verantwortlich: string | null },
): Promise<{ ok: true; terminId: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeTerminFest(a.supabase, a.userId, {
    teamId,
    art: felder.art ?? "training",
    bezeichnung: felder.bezeichnung,
    richtwertMin: felder.richtwertMin,
    richtwertMax: felder.richtwertMax,
    meldefrist: felder.meldefrist,
    treffpunkte: felder.treffpunkte,
    datum: felder.datum,
    beginn: felder.beginn ?? "",
    ende: felder.ende ?? "",
    ort: felder.ort,
    ortLink: felder.ortLink,
    bemerkung: felder.bemerkung,
    hinweisEltern: felder.hinweisEltern,
    treffpunkt: felder.treffpunkt,
    felder: felder.felder,
    spielerzahl: felder.spielerzahl,
    mindestbesetzung: felder.mindestbesetzung ?? null,
    kaderIds,
    eingeladene: trainer.eingeladene,
    verantwortlich: trainer.verantwortlich,
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
  /** Die bestätigte Zahl verfallender Abmeldungen (#437 AK 1); sie
   *  bestätigt auch einen entfallenden Treffpunkt (#561 PC 5). */
  bestaetigt: number | false = false,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTermin(a.supabase, a.userId, {
    bestaetigt,
    treffpunktWeg: bestaetigt !== false,
    terminId,
    datum: felder.datum,
    beginn: felder.beginn,
    ende: felder.ende,
    ort: felder.ort,
    ortLink: felder.ortLink,
    bemerkung: felder.bemerkung,
    hinweisEltern: felder.hinweisEltern,
    felder: felder.felder,
    spielerzahl: felder.spielerzahl,
    mindestbesetzung: felder.mindestbesetzung,
    bezeichnung: felder.bezeichnung ?? undefined,
    richtwertMin: felder.richtwertMin,
    richtwertMax: felder.richtwertMax,
    meldefrist: felder.meldefrist,
    treffpunkte: felder.treffpunkte,
    treffpunkt: felder.treffpunkt,
    erwartetesTraining,
  });
  if (!r.ok)
    return {
      ok: false,
      error: r.meldung,
      verfallend: r.verfallend,
      nachtraege: r.nachtraege,
      absagen: r.absagen,
      fristAbgelaufen: r.fristAbgelaufen,
      kennzeichnungen: r.kennzeichnungen,
      anmeldungen: r.anmeldungen,
      treffpunktEntfaellt: r.treffpunktEntfaellt,
    };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function entferneTerminAktion(
  terminId: string,
  erwartetesTraining: string | null,
  /** Ein Spiel: die bestätigte Zahl verschwindender Meldungen und
   *  Kennzeichnungen (#463 AK 27, #464 AK 10). */
  bestaetigt: number | false = false,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneTermin(a.supabase, a.userId, { terminId, erwartetesTraining, bestaetigt });
  if (!r.ok) return { ok: false, error: r.meldung, verschwindend: r.verschwindend, kennzeichnungen: r.kennzeichnungen };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.training) revalidiereTraining(r.wert.training.trainingId);
  return { ok: true };
}

/** Einen Termin ausfallen lassen oder den Grund eines ausgefallenen ändern
 *  (#327). Die Oberfläche sendet den Grund immer als Text — «» leert ihn —,
 *  also ist das der ausdrückliche Weg «Grund setzen». `erwartetAusgefallen`
 *  ist, was sie bei der Auswahl sah: Ein inzwischen geänderter Ausfall weist
 *  ab (PO 17). Ein Training bleibt am Termin. */
export async function lasseAusfallenAktion(
  terminId: string,
  grund: string,
  erwartetAusgefallen: boolean,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await lasseAusfallen(a.supabase, a.userId, { terminId, grund, erwartetAusgefallen });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
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

/** Einem Termin ein Training zuordnen — immer als stille Kopie, die ein
 *  Termin-Training wird (PO 2026-10-06). */
export async function ordneTrainingZuAktion(e: Zuordnung): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneTrainingZu(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };
  revalidiereTeam(r.wert.teamId);
  for (const id of [r.wert.trainingId, r.wert.ersetzt?.trainingId, e.trainingId])
    if (id) revalidiereTraining(id);
  return { ok: true };
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
  if (r.wert.training) revalidiereTraining(r.wert.training.trainingId);
  return { ok: true };
}

/** Eine Terminserie festlegen (#324): die Termine entstehen ohne Training,
 *  aber mit den Eingeladenen und der Verantwortlichen (#519 AK 2), Feldern und erwarteter
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
    /** Der Kartenlink zum Ort (#533 AK 2). */
    ortLink: string;
    bemerkung: string;
    /** Der Hinweis für Eltern jedes Termins (#590 AK 2). */
    hinweisEltern: string;
    /** Der Treffpunkt jedes Termins (#561 AK 2); `null`: keiner. */
    treffpunkt: TerminTreffpunkt | null;
    eingeladene: string[];
    verantwortlich: string | null;
    /** Felder und erwartete Spielerzahl jedes Termins (#391 AK 1). */
    felder: Felder | null;
    spielerzahl: number | null;
    /** Für welche Kader jeder Termin gilt (#453 AK 2). */
    kaderIds: string[];
    /** Die Mindestbesetzung jedes Termins (#521 AK 1, 2). */
    mindestbesetzung: Mindestbesetzung;
  },
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeSerieFest(a.supabase, a.userId, { ...f, teamId });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}

/** Trainer:innen eines Termins einladen, ausladen und die Verantwortung
 *  übertragen (#519 AK 5–10). Die Oberfläche nimmt diesen Weg für einen
 *  einzelnen Termin (`reichweite` fehlt) und für «nur dieser» an einem
 *  Serientermin; für folgende und alle gehen die Eingeladenen und die
 *  Verantwortung mit der Serienänderung durch Vorschau und Ausführung
 *  (`aendereSerieAktion`). */
export async function aendereTrainerAktion(
  terminId: string,
  aenderung: Pick<TrainerAendern, "einladen" | "ausladen" | "ausladenEintraege" | "verantwortlich">,
  reichweite: Reichweite | undefined,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTrainer(a.supabase, a.userId, { ...aenderung, terminId, reichweite });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}

/** Eine Trainer:in für einen Termin absagen oder wieder zusagen (#520 AK 1,
 *  10, 18, 19) — mit dem, was die Oberfläche zeigte (`gesehen`). */
export async function setzeAbsageAktion(e: AbsageSetzen): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeAbsage(a.supabase, a.userId, e);
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
/** `verfallend`: die Summe verfallender Abmeldungen aus der Vorschau (#453
 *  AK 12) und der Termine, deren Treffpunkt entfällt (#561 PC 5). */
type Erwartet = { version: number; entfallend: string[]; verfallend?: number };

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
export async function folgeDerSerieAktion(
  terminId: string,
  angaben: FolgeAngabe[],
  /** `true` bestätigt eine Verlegung (#437), eine Zahl verfallende
   *  Abmeldungen durch Kader (#453 AK 10, 12). */
  bestaetigt: boolean | number = false,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await folgeDerSerie(a.supabase, a.userId, { terminId, angaben, bestaetigt });
  if (!r.ok)
    return {
      ok: false,
      error: r.meldung,
      verfallend: r.verfallend,
      nachtraege: r.nachtraege,
      absagen: r.absagen,
      treffpunktEntfaellt: r.treffpunktEntfaellt,
    };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}
