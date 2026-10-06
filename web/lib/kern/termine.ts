import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  KONFLIKT_MARKER,
  TERMIN_MELDUNG,
  ausfallProblem,
  kopieGebliebenText,
  TERMIN_TEXT,
  leerZuNull,
  spielerzahlProblem,
  terminProblem,
  type TerminProblem,
} from "@/lib/termin";
import {
  felderPfad,
  felderProblem,
  gleicheFelder,
  normalisiereFelder,
  type FeldEingabe,
  type Felder,
} from "@/lib/termin-felder";
import { kalenderMeldung } from "@/lib/veraltet";
import { kurzeZeit } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { ladeTrainingZumBearbeiten, pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { HINWEIS_NICHTS_ENTSTANDEN, hinweisRest, kopiereTraining, type KopieErgebnis } from "@/lib/kern/kopie";
import { gibtEsTraining, loescheTrainingMitBildern, raeumeBilderAb, terminTrainingBilder } from "@/lib/kern/loeschen";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
  type KernFehler,
} from "@/lib/kern/ergebnis";

/**
 * Der Kalender eines Teams (Epic #321): Termine festlegen, ändern und
 * entfernen (#322), Trainings zuordnen und lösen (#323).
 *
 * Zeitrahmen und Inhalt sind getrennt (PO 15): Ein Termin gehört dem Team und
 * besteht auch ohne Training; ein Training kommt nur durch Zuordnen an einen
 * bestehenden Termin auf ein Datum. Ein Termin trägt höchstens ein Training,
 * ein Training ist höchstens für einen Termin eingeplant — ein weiterer Termin
 * bekommt eine eigenständige Kopie, oder das Training wird verschoben.
 *
 * Gleichzeitige Änderungen (PO 17): Die Oberfläche sendet mit, was sie bei der
 * Auswahl sah (`erwartet…`), und wird abgewiesen, wenn sich genau das geändert
 * hat. Der KI-Weg kennt keine Auswahl; er prüft gegen den eben gelesenen Stand
 * und bekommt bei einem Wettlauf `wiederholbar: true`.
 *
 * Wer schreiben darf, entscheidet die RLS (`tt_*`: jedes Mitglied des Teams)
 * bzw. die Mitgliedschaftsprüfung der RPCs.
 */

export const TERMIN_FELD = { feld: "termin_id" } as const;

export const TERMIN_ROH =
  "id, team_id, training_id, datum, beginn, ende, ort, bemerkung, felder, erwartete_spielerzahl, serie_id, zeit_abweichend, ort_abweichend, bemerkung_abweichend, ausgefallen, ausfall_grund";

export type TerminRoh = {
  id: string;
  team_id: string;
  training_id: string | null;
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  bemerkung: string | null;
  /** Die Felder des Platzes (#389); `null` = unbekannt. */
  felder: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null` = unbekannt. */
  erwartete_spielerzahl: number | null;
  /** Nur Serientermine tragen eine Serie; die Flags zeigen, welche Angaben
   *  von ihr abweichen. */
  serie_id: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
  /** Ein ausgefallener Termin trägt kein Training (#327). */
  ausgefallen: boolean;
  ausfall_grund: string | null;
};

/** Kennungen von Verantwortlichen vorab prüfen und von Doppelten befreien
 *  (#325): Jede muss eine UUID sein, sonst wiese Postgres mit einem rohen
 *  Fehler ab. Geteilt von Einzeltermin, Serie und Festlegen. */
export function bereinigeVerantwortliche(ids: readonly unknown[]): { ok: true; ids: string[] } | { ok: false; fehler: KernFehler } {
  if (!Array.isArray(ids) || !ids.every((x) => istUuid(x)))
    return {
      ok: false,
      fehler: fehlschlag("eingabe", TERMIN_TEXT.verantwortlicheUngueltig, { feld: "verantwortliche" }),
    };
  return { ok: true, ids: [...new Set((ids as string[]).map((x) => x.toLowerCase()))] };
}

function feldFehler(p: TerminProblem | null): KernFehler | null {
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Die Felder des Platzes in die gespeicherte Form bringen und prüfen
 *  (#389 AK 5, 9, 15): fehlende Angaben werden unbekannt, eine leere Liste
 *  heisst «ohne Felder». Die Meldung ist die der Oberfläche; `feld` nennt die
 *  Stelle mit dem Eingabenamen des Werkzeugs («felder[1].laenge_m»). */
export function pruefeFelder(
  felder: readonly FeldEingabe[] | null | undefined,
): { ok: true; felder: Felder | null } | KernFehler {
  const n = normalisiereFelder(felder);
  const p = felderProblem(n);
  if (p) return fehlschlag("eingabe", p.text, { feld: felderPfad(p) });
  return { ok: true, felder: n };
}

/** Die erwartete Spielerzahl prüfen (#390 AK 3, 7) — mit dem Satz der
 *  Oberfläche und dem Eingabenamen des Werkzeugs. */
export function spielerzahlFehler(n: number | null | undefined): KernFehler | null {
  const p = n === undefined ? null : spielerzahlProblem(n);
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Ein Fehler der Kalender-RPCs als Kern-Fehler. «Nicht gefunden» und «seit
 *  der Auswahl geändert» ordnet nur der Kalender ein; alle übrigen Marker
 *  übersetzt `ausDbFehler` als Regel mit demselben Satz. */
export function kalenderFehler(e: { message: string; code?: string }, wiederholbar = false): KernFehler {
  if (e.message.includes("TERMIN_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (e.message.includes("TRAINING_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const konflikt = KONFLIKT_MARKER.find((m) => e.message.includes(m));
  if (konflikt)
    return fehlschlag("konflikt", meldungZu(konflikt), wiederholbar ? { wiederholbar: true } : {});
  return ausDbFehler(e);
}

/** Der Satz zu einem Konflikt-Marker, aus den Tabellen der Termine und Serien. */
function meldungZu(marker: string): string {
  return kalenderMeldung(marker) ?? marker;
}

/** Einen Termin lesen, soweit die RLS ihn zeigt (nur Mitglieder des Teams).
 *  Unsichtbar und nicht vorhanden bleiben ununterscheidbar. */
export async function ladeTermin(
  supabase: SupabaseClient,
  terminId: string,
): Promise<KernErgebnis<TerminRoh>> {
  if (!istUuid(terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase
    .from("training_termine")
    .select(TERMIN_ROH)
    .eq("id", terminId)
    .maybeSingle<TerminRoh>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  return ok({ ...data, beginn: kurzeZeit(data.beginn), ende: kurzeZeit(data.ende) });
}

// ── Festlegen, ändern, entfernen (#322) ─────────────────────────────────────

export type TerminFestlegen = {
  teamId: string;
  datum: string;
  beginn: string;
  ende: string;
  ort?: string | null;
  bemerkung?: string | null;
  /** Die Felder des Platzes (#389); ohne Angabe oder leer: keine. */
  felder?: readonly FeldEingabe[] | null;
  /** Die erwartete Spielerzahl (#390); ohne Angabe: unbekannt. */
  spielerzahl?: number | null;
};

/** Einen einzelnen Termin ohne Training festlegen (AK 1–6), auch in der
 *  Vergangenheit (AK 4), auf Wunsch mit seinen Feldern (#389 AK 1, 8) und
 *  der erwarteten Spielerzahl (#390 AK 1). */
export async function legeTerminFest(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminFestlegen,
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const problem = feldFehler(terminProblem(e));
  if (problem) return problem;
  const felder = pruefeFelder(e.felder);
  if (!felder.ok) return felder;
  const zahl = spielerzahlFehler(e.spielerzahl);
  if (zahl) return zahl;
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;

  const { data, error } = await supabase
    .from("training_termine")
    .insert({
      team_id: e.teamId,
      datum: e.datum,
      beginn: leerZuNull(e.beginn),
      ende: leerZuNull(e.ende),
      ort: leerZuNull(e.ort),
      bemerkung: leerZuNull(e.bemerkung),
      felder: felder.felder,
      erwartete_spielerzahl: e.spielerzahl ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return ausDbFehler(error);
  return ok({ terminId: data.id, teamId: e.teamId });
}

export type TerminAendern = {
  terminId: string;
  /** `undefined` = unverändert. Das Datum lässt sich nicht leeren. */
  datum?: string;
  /** `undefined` = unverändert. Beginn und Ende sind eine Angabe (AK 8–10). */
  beginn?: string | null;
  ende?: string | null;
  /** `undefined` = unverändert, `null` oder `""` = leeren. */
  ort?: string | null;
  bemerkung?: string | null;
  /** Die Felder als ganze Liste (#389 AK 7): `undefined` = unverändert,
   *  `null` oder `[]` = entfernen. */
  felder?: readonly FeldEingabe[] | null;
  /** Die erwartete Spielerzahl (#390 AK 2): `undefined` = unverändert,
   *  `null` = entfernen. */
  spielerzahl?: number | null;
  /** Das Training, das der Termin bei der Auswahl trug (AK 23). `undefined`
   *  beim KI-Weg: geprüft wird dann gegen den eben gelesenen Stand. */
  erwartetesTraining?: string | null;
};

/** Warum ein bedingtes Schreiben keine Zeile traf: Der Termin ist weg, oder
 *  sein Training hat sich seit der Auswahl geändert (AK 23). */
async function warumNichtGeschrieben(
  supabase: SupabaseClient,
  terminId: string,
  wiederholbar: boolean,
): Promise<KernFehler> {
  const { data } = await supabase.from("training_termine").select("id").eq("id", terminId).maybeSingle();
  return data
    ? fehlschlag("konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT, wiederholbar ? { wiederholbar: true } : {})
    : fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
}

/** Datum, Zeit, Ort, Bemerkung, Felder (#389) und erwartete Spielerzahl
 *  (#390) eines Termins ändern (AK 7–10, 23). Der Termin wird mit seinem
 *  Stand zusammengeführt und als Ganzes geprüft; geschrieben werden aber nur die übergebenen Felder (Beginn und Ende stets
 *  zusammen). So überschreibt eine gleichzeitige Änderung eines anderen
 *  Feldes nichts still mit dem alten Stand (PO 17). */
export async function aendereTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminAendern,
): Promise<KernErgebnis<{ terminId: string; teamId: string; trainingId: string | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;

  const neu = {
    datum: e.datum ?? t.datum,
    beginn: e.beginn !== undefined ? leerZuNull(e.beginn) : t.beginn,
    ende: e.ende !== undefined ? leerZuNull(e.ende) : t.ende,
    ort: e.ort !== undefined ? leerZuNull(e.ort) : t.ort,
    bemerkung: e.bemerkung !== undefined ? leerZuNull(e.bemerkung) : t.bemerkung,
  };
  const problem = feldFehler(terminProblem(neu));
  if (problem) return problem;
  const felder = e.felder === undefined ? null : pruefeFelder(e.felder);
  if (felder && !felder.ok) return felder;
  const zahl = spielerzahlFehler(e.spielerzahl);
  if (zahl) return zahl;

  const aenderung: Partial<typeof neu & { felder: Felder | null; erwartete_spielerzahl: number | null }> = {};
  if (e.datum !== undefined) aenderung.datum = neu.datum;
  if (e.beginn !== undefined || e.ende !== undefined) {
    aenderung.beginn = neu.beginn;
    aenderung.ende = neu.ende;
  }
  if (e.ort !== undefined) aenderung.ort = neu.ort;
  if (e.bemerkung !== undefined) aenderung.bemerkung = neu.bemerkung;
  // Die Felder sind EINE Angabe und gehen als ganze Liste (#389 AK 7).
  if (felder) aenderung.felder = felder.felder;
  if (e.spielerzahl !== undefined) aenderung.erwartete_spielerzahl = e.spielerzahl;

  // «Nur dieser» (#326 AK 1, PC 1): Jede Angabe eines Serientermins, die sich
  // ändert, weicht danach ab — bis man sie wieder der Serie folgen lässt. Nur
  // was übergeben wird und sich vom Stand unterscheidet, setzt ein Flag; ein
  // schon gesetztes bleibt ungeschrieben stehen. Das Datum braucht keines: Es
  // weicht ab, sobald es nicht mehr auf dem Serientag liegt. Felder und
  // Spielerzahl (#391 PC 4, 5) ebenso — auch beim Entfernen: Der Termin ist
  // dann bewusst leer und weicht mit unbekannter Angabe ab.
  const flags: Record<string, boolean> = {};
  if (t.serie_id) {
    if ("beginn" in aenderung && (neu.beginn !== t.beginn || neu.ende !== t.ende)) flags.zeit_abweichend = true;
    if ("ort" in aenderung && neu.ort !== t.ort) flags.ort_abweichend = true;
    if ("bemerkung" in aenderung && neu.bemerkung !== t.bemerkung) flags.bemerkung_abweichend = true;
    if (felder && !gleicheFelder(felder.felder, t.felder)) flags.felder_abweichend = true;
    if (e.spielerzahl !== undefined && e.spielerzahl !== t.erwartete_spielerzahl) flags.spielerzahl_abweichend = true;
  }

  // #327 PO 6, PC 4: Ein einzeln auf heute oder später verlegter Termin findet
  // wieder statt. Ein Tausch der Serie verlegt nicht einzeln (PC 5). Das
  // Zurücksetzen gehört zur Änderung des Datums und steht darum nur dann im
  // Schreiben, wenn es sie gibt.
  const ausfallEndet =
    t.ausgefallen && "datum" in aenderung && neu.datum !== t.datum && neu.datum >= heuteAmTrainingsort();
  const ausfall = ausfallEndet ? { ausgefallen: false, ausfall_grund: null } : {};

  const erwartet = e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id;
  const basis = supabase.from("training_termine").update({ ...aenderung, ...flags, ...ausfall }).eq("id", t.id);
  const { data, error } = await (erwartet === null
    ? basis.is("training_id", null)
    : basis.eq("training_id", erwartet)
  )
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return warumNichtGeschrieben(supabase, t.id, e.erwartetesTraining === undefined);
  return ok({ terminId: t.id, teamId: t.team_id, trainingId: erwartet });
}

/** Was mit dem Training geschah, das einen Termin verliess: Ein
 *  Termin-Training ist gelöscht, ein Training aus dem Bestand bleibt dort. */
export type Verlassen = { trainingId: string; geloescht: boolean } | null;

async function verlassen(supabase: SupabaseClient, trainingId: string | null): Promise<Verlassen> {
  return trainingId ? { trainingId, geloescht: !(await gibtEsTraining(supabase, trainingId)) } : null;
}

/** Einen Termin entfernen (AK 11–13, 23). Ein Termin-Training geht mit ihm,
 *  ein Training aus dem Bestand bleibt dort (`training`). */
export async function entferneTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ teamId: string; training: Verlassen }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data: vorher } = await supabase.from("training_termine").select("training_id").eq("id", e.terminId).maybeSingle();
  const bilder = await terminTrainingBilder(supabase, [vorher?.training_id]);
  const { data, error } = await supabase.rpc("termin_entfernen", {
    p_termin: e.terminId,
    p_erwartet: e.erwartetesTraining === undefined ? null : { termin_training: e.erwartetesTraining },
  });
  if (error) return kalenderFehler(error);
  const r = data as { training: string | null; team: string };
  await raeumeBilderAb(supabase, bilder);
  return ok({ teamId: r.team, training: await verlassen(supabase, r.training) });
}

// ── Zuordnen und lösen (#323; Termin-Trainings, PO 2026-10-06) ───────────────

export type Zuordnung = {
  terminId: string;
  /** Die Quelle: ein Training aus dem Bestand des Teams, ein eigenes
   *  persönliches oder ein anderes Termin-Training des Teams. */
  trainingId: string;
  /** Was die Oberfläche bei der Auswahl sah (AK 14); `undefined` beim KI-Weg. */
  erwartet?: { terminTraining: string | null };
};

export type Zugeordnet = {
  terminId: string;
  teamId: string;
  /** Die Kopie, die jetzt als Termin-Training am Termin steht. */
  trainingId: string;
  /** Das Training, das der Termin vorher trug. */
  ersetzt: Verlassen;
};

/** Eine gescheiterte Zuordnung räumt ihre Kopie wieder weg (Story 2 PC 8,
 *  Story 7 PC 8). Bleibt sie stehen, nennt die Meldung sie — in der
 *  Oberfläche und beim Assistenten (PC 9). */
export async function mitAufgeraeumterKopie(
  supabase: SupabaseClient,
  f: KernFehler,
  kopieId: string,
): Promise<KernFehler> {
  if (await loescheTrainingMitBildern(supabase, kopieId)) return { ...f, hinweis: HINWEIS_NICHTS_ENTSTANDEN };
  const { data } = await supabase.from("trainings").select("name").eq("id", kopieId).maybeSingle<{ name: string }>();
  return { ...f, meldung: `${f.meldung} ${kopieGebliebenText(data?.name ?? "Kopie")}`, hinweis: hinweisRest(kopieId) };
}

/** Das Scheitern der Kopie selbst. Räumte sie nicht auf, nennt schon die
 *  Meldung die stehen gebliebene Teilkopie — die Oberfläche zeigt `hinweis`
 *  nie (Story 7 PC 8), wie bei `mitAufgeraeumterKopie`. */
async function kopierFehler(
  supabase: SupabaseClient,
  kopie: Extract<KopieErgebnis, { ok: false }>,
): Promise<KernFehler> {
  if (kopie.nichtsEntstanden) return fehlschlag(kopie.art, kopie.error, { hinweis: HINWEIS_NICHTS_ENTSTANDEN });
  const { data } = await supabase.from("trainings").select("name").eq("id", kopie.rest).maybeSingle<{ name: string }>();
  return fehlschlag(kopie.art, `${kopie.error} ${kopieGebliebenText(data?.name ?? "Kopie")}`, {
    hinweis: hinweisRest(kopie.rest),
  });
}

/** Einem Termin ein Training zuordnen (AK 1–9, 14–17; PO 2026-10-06): Er
 *  bekommt immer still eine eigene Kopie — ein Termin-Training. Die Quelle
 *  bleibt unberührt, ob aus dem Bestand, persönlich (#328) oder das Training
 *  eines anderen Termins; in den Bestand kommt dabei nichts. Trägt der Termin
 *  schon ein Training, wird es ersetzt (AK 9): Ein Termin-Training geht dabei
 *  verloren, eines aus dem Bestand bleibt dort.
 *
 *  Erst die Datenebene macht die Kopie im selben Schritt, in dem sie sie
 *  verknüpft, zum Termin-Training (`termin_training_setzen`). Scheitert das
 *  Verknüpfen, wird die Kopie wieder entfernt; misslingt auch das, steht sie
 *  sichtbar im Bestand statt unauffindbar ohne Termin. */
export async function ordneTrainingZu(
  supabase: SupabaseClient,
  userId: string,
  e: Zuordnung,
): Promise<KernErgebnis<Zugeordnet>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;
  // AK 9 (#327): Vor jeder Kopie abweisen, sonst bliebe eine Kopie zurück.
  if (t.ausgefallen) return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN, TERMIN_FELD);

  const training = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!training.ok) return training;
  const { ziel } = training.wert;
  if (ziel.art === "team" && ziel.teamId !== t.team_id)
    return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM, { feld: "training_id" });
  if (t.training_id === e.trainingId) return ok({ terminId: t.id, teamId: t.team_id, trainingId: e.trainingId, ersetzt: null });

  // Eine veraltete Auswahl legt keine Kopie an.
  if (e.erwartet && t.training_id !== e.erwartet.terminTraining)
    return fehlschlag("konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);

  const bilder = await terminTrainingBilder(supabase, [t.training_id]);
  const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: t.team_id });
  if (!kopie.ok) return kopierFehler(supabase, kopie);
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: kopie.neueId,
    p_erwartet: { termin_training: e.erwartet ? e.erwartet.terminTraining : t.training_id },
  });
  if (error) return mitAufgeraeumterKopie(supabase, await kalenderFehler(error, !e.erwartet), kopie.neueId);
  await raeumeBilderAb(supabase, bilder);
  const bisher = (data as { bisher: string | null }).bisher;
  return ok({ terminId: t.id, teamId: t.team_id, trainingId: kopie.neueId, ersetzt: await verlassen(supabase, bisher) });
}

/** Das Training von seinem Termin lösen (AK 12, PC 6). Ein Termin-Training
 *  wird dabei gelöscht, eines aus dem Bestand bleibt dort (`training`). */
export async function loeseTraining(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ terminId: string; teamId: string; training: Verlassen }>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;
  const bilder = await terminTrainingBilder(supabase, [t.training_id]);
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: null,
    p_erwartet: { termin_training: e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id },
  });
  if (error) return kalenderFehler(error, e.erwartetesTraining === undefined);
  await raeumeBilderAb(supabase, bilder);
  return ok({ terminId: t.id, teamId: t.team_id, training: await verlassen(supabase, (data as { bisher: string | null }).bisher) });
}

// ── Ausfall (#327) ───────────────────────────────────────────────────────────

/** Einen Termin als ausgefallen markieren oder den Grund eines ausgefallenen
 *  ändern (#327 AK 1–5, 11; PC 2). Ein zugeordnetes Training bleibt am Termin
 *  und ruht, bis der Ausfall zurückgenommen wird (PO 2026-10-06). */
export async function lasseAusfallen(
  supabase: SupabaseClient,
  _userId: string,
  e: {
    terminId: string;
    grund?: string | null;
    /** Ob der Termin bei der Auswahl ausgefallen war (nur die Oberfläche sendet
     *  es, PO 17): Hat ein anderes Mitglied den Ausfall inzwischen gesetzt oder
     *  zurückgenommen, wird nicht geschrieben (`AUSFALL_GEAENDERT`). */
    erwartetAusgefallen?: boolean;
  },
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const p = ausfallProblem(e.grund);
  if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  // `grund` weggelassen heisst bei einem schon ausgefallenen Termin «Grund
  // unverändert» (kein Schreiben); `null` oder «» leert ihn. Beim Markieren
  // gibt es ohne Angabe keinen Grund.
  const grund = e.grund === undefined && t.ausgefallen ? {} : { ausfall_grund: leerZuNull(e.grund) };
  const basis = supabase.from("training_termine").update({ ausgefallen: true, ...grund }).eq("id", t.id);
  const { data, error } = await (e.erwartetAusgefallen === undefined ? basis : basis.eq("ausgefallen", e.erwartetAusgefallen))
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) {
    const { data: da } = await supabase.from("training_termine").select("id").eq("id", t.id).maybeSingle();
    return da
      ? fehlschlag("konflikt", TERMIN_MELDUNG.AUSFALL_GEAENDERT)
      : fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  }
  return ok({ terminId: t.id, teamId: t.team_id });
}

/** Den Ausfall zurücknehmen (#327 AK 6, PC 3): wieder ein normaler Termin,
 *  ohne Grund; ein Training, das am Termin ruhte, ist wieder da. */
export async function nimmAusfallZurueck(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  if (!geladen.wert.ausgefallen) return fehlschlag("regel", TERMIN_MELDUNG.NICHT_AUSGEFALLEN, TERMIN_FELD);
  // Bedingt schreiben: Hat ein anderes Mitglied den Ausfall inzwischen
  // zurückgenommen, trifft das Update keine Zeile.
  const { data, error } = await supabase
    .from("training_termine")
    .update({ ausgefallen: false, ausfall_grund: null })
    .eq("id", e.terminId)
    .eq("ausgefallen", true)
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) {
    const { data: da } = await supabase.from("training_termine").select("id").eq("id", e.terminId).maybeSingle();
    return da
      ? fehlschlag("regel", TERMIN_MELDUNG.NICHT_AUSGEFALLEN, TERMIN_FELD)
      : fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  }
  return ok({ terminId: e.terminId, teamId: geladen.wert.team_id });
}
