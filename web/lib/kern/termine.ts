import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  KONFLIKT_MARKER,
  TERMIN_MELDUNG,
  kopieGebliebenText,
  leerZuNull,
  terminProblem,
  type TerminProblem,
} from "@/lib/termin";
import { kalenderMeldung } from "@/lib/veraltet";
import { kurzeZeit } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { ladeTrainingZumBearbeiten, pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { HINWEIS_NICHTS_ENTSTANDEN, hinweisRest, kopiereTraining } from "@/lib/kern/kopie";
import { loescheTrainingMitBildern } from "@/lib/kern/loeschen";
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
  "id, team_id, training_id, datum, beginn, ende, ort, bemerkung, serie_id, zeit_abweichend, ort_abweichend, bemerkung_abweichend";

export type TerminRoh = {
  id: string;
  team_id: string;
  training_id: string | null;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  /** Nur Serientermine tragen eine Serie; die Flags zeigen, welche Angaben
   *  von ihr abweichen. */
  serie_id: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
};

function feldFehler(p: TerminProblem | null): KernFehler | null {
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
};

/** Einen einzelnen Termin ohne Training festlegen (AK 1–6), auch in der
 *  Vergangenheit (AK 4). */
export async function legeTerminFest(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminFestlegen,
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const problem = feldFehler(terminProblem(e));
  if (problem) return problem;
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

/** Datum, Zeit, Ort und Bemerkung eines Termins ändern (AK 7–10, 23). Der
 *  Termin wird mit seinem Stand zusammengeführt und als Ganzes geprüft;
 *  geschrieben werden aber nur die übergebenen Felder (Beginn und Ende stets
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
  const problem = feldFehler(terminProblem(neu, { beginn: t.beginn, ende: t.ende }));
  if (problem) return problem;

  const aenderung: Partial<typeof neu> = {};
  if (e.datum !== undefined) aenderung.datum = neu.datum;
  if (e.beginn !== undefined || e.ende !== undefined) {
    aenderung.beginn = neu.beginn;
    aenderung.ende = neu.ende;
  }
  if (e.ort !== undefined) aenderung.ort = neu.ort;
  if (e.bemerkung !== undefined) aenderung.bemerkung = neu.bemerkung;

  // «Nur dieser» (#326 AK 1, PC 1): Jede Angabe eines Serientermins, die sich
  // ändert, weicht danach ab — bis man sie wieder der Serie folgen lässt. Nur
  // was übergeben wird und sich vom Stand unterscheidet, setzt ein Flag; ein
  // schon gesetztes bleibt ungeschrieben stehen. Das Datum braucht keines: Es
  // weicht ab, sobald es nicht mehr auf dem Serientag liegt.
  const flags: Record<string, boolean> = {};
  if (t.serie_id) {
    if ("beginn" in aenderung && (neu.beginn !== t.beginn || neu.ende !== t.ende)) flags.zeit_abweichend = true;
    if ("ort" in aenderung && neu.ort !== t.ort) flags.ort_abweichend = true;
    if ("bemerkung" in aenderung && neu.bemerkung !== t.bemerkung) flags.bemerkung_abweichend = true;
  }

  const erwartet = e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id;
  const basis = supabase.from("training_termine").update({ ...aenderung, ...flags }).eq("id", t.id);
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

/** Einen Termin entfernen (AK 11–13, 23). Sein Training bleibt im
 *  Team-Bestand (PC 6); `trainingId` nennt es. */
export async function entferneTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ teamId: string; trainingId: string | null }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase.rpc("termin_entfernen", {
    p_termin: e.terminId,
    p_erwartet: e.erwartetesTraining === undefined ? null : { termin_training: e.erwartetesTraining },
  });
  if (error) return kalenderFehler(error);
  const r = data as { training: string | null; team: string };
  return ok({ teamId: r.team, trainingId: r.training });
}

// ── Zuordnen und lösen (#323) ────────────────────────────────────────────────

export type Zuordnung = {
  terminId: string;
  trainingId: string;
  /** Nur für ein Training, das schon einem anderen Termin gehört: `kopie`
   *  legt eine eigenständige Kopie an, `verschieben` nimmt es vom bisherigen
   *  — nur anstehenden — Termin weg (AK 10, 11). */
  art?: "kopie" | "verschieben";
  /** Was die Oberfläche bei der Auswahl sah (AK 14); `undefined` beim KI-Weg. */
  erwartet?: { terminTraining: string | null; trainingTermin: string | null };
};

export type Zugeordnet = {
  terminId: string;
  teamId: string;
  /** Das Training, das jetzt am Termin steht — bei einer Kopie die Kopie. */
  trainingId: string;
  kopie: boolean;
  /** Das Training, das den Termin verlassen hat und ohne Termin im
   *  Team-Bestand bleibt (PC 5). */
  imBestand: string | null;
  /** Der Termin, den ein verschobenes Training verlassen hat (PC 4). */
  freierTermin: string | null;
};

type Erwartung = { termin_training: string | null; training_termin: string | null };

async function setze(
  supabase: SupabaseClient,
  t: TerminRoh,
  trainingId: string,
  verschieben: boolean,
  erwartet: Erwartung,
  wiederholbar: boolean,
  kopie: boolean,
): Promise<KernErgebnis<Zugeordnet>> {
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: trainingId,
    p_verschieben: verschieben,
    p_erwartet: erwartet,
  });
  if (error) return kalenderFehler(error, wiederholbar);
  const r = data as { bisher: string | null; frei: string | null };
  return ok({ terminId: t.id, teamId: t.team_id, trainingId, kopie, imBestand: r.bisher, freierTermin: r.frei });
}

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

/** Einem Termin ein Training aus dem Team-Bestand zuordnen (AK 1–11, 14–17;
 *  PC 1–9). Ersetzt ein Training, das der Termin schon trägt (AK 9). */
export async function ordneTrainingZu(
  supabase: SupabaseClient,
  userId: string,
  e: Zuordnung,
): Promise<KernErgebnis<Zugeordnet>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;

  const training = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!training.ok) return training;
  const { ziel } = training.wert;
  if (ziel.art !== "team" || ziel.teamId !== t.team_id)
    return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM, { feld: "training_id" });
  if (t.training_id === e.trainingId)
    return ok({ terminId: t.id, teamId: t.team_id, trainingId: e.trainingId, kopie: false, imBestand: null, freierTermin: null });

  // Eine veraltete Auswahl legt keine Kopie an.
  if (e.erwartet && t.training_id !== e.erwartet.terminTraining)
    return fehlschlag("konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);

  const { data: bisher, error } = await supabase
    .from("training_termine")
    .select("id, datum")
    .eq("training_id", e.trainingId)
    .maybeSingle<{ id: string; datum: string }>();
  if (error) return ausDbFehler(error);
  if (e.erwartet && (bisher?.id ?? null) !== e.erwartet.trainingTermin)
    return fehlschlag("konflikt", TERMIN_MELDUNG.TRAINING_EINPLANUNG_GEAENDERT);

  const wiederholbar = !e.erwartet;
  const erwartet: Erwartung = e.erwartet
    ? { termin_training: e.erwartet.terminTraining, training_termin: e.erwartet.trainingTermin }
    : { termin_training: t.training_id, training_termin: bisher?.id ?? null };

  // Ohne bisherigen Termin wird schlicht verknüpft (PC 1).
  if (!bisher) return setze(supabase, t, e.trainingId, false, erwartet, wiederholbar, false);

  const vergangen = bisher.datum < heuteAmTrainingsort();
  if (vergangen && e.art === "verschieben")
    return fehlschlag("regel", TERMIN_MELDUNG.NUR_KOPIE_BEI_VERGANGENEM, { feld: "art" });
  if (!vergangen && !e.art)
    return fehlschlag("regel", TERMIN_MELDUNG.TRAINING_SCHON_EINGEPLANT, {
      feld: "art",
      zulaessig: ["kopie", "verschieben"],
    });
  if (e.art === "verschieben") return setze(supabase, t, e.trainingId, true, erwartet, wiederholbar, false);

  // Kopie (PC 2, 3): eigenständig, gleichnamig, so vollständig wie jede Kopie.
  const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: t.team_id });
  if (!kopie.ok)
    return fehlschlag(kopie.art, kopie.error, {
      hinweis: kopie.nichtsEntstanden ? HINWEIS_NICHTS_ENTSTANDEN : hinweisRest(kopie.rest),
    });
  const r = await setze(supabase, t, kopie.neueId, false, { ...erwartet, training_termin: null }, wiederholbar, true);
  return r.ok ? r : mitAufgeraeumterKopie(supabase, r, kopie.neueId);
}

/** Das Training von seinem Termin lösen (AK 12, PC 6). */
export async function loeseTraining(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ terminId: string; teamId: string; trainingId: string | null }>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: null,
    p_verschieben: false,
    p_erwartet: {
      termin_training: e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id,
      training_termin: null,
    },
  });
  if (error) return kalenderFehler(error, e.erwartetesTraining === undefined);
  return ok({ terminId: t.id, teamId: t.team_id, trainingId: (data as { bisher: string | null }).bisher });
}
