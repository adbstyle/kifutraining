import "server-only";
import { KADER_MELDUNG } from "@/lib/kader";
import { verfallBestaetigen, type Spielstand } from "@/lib/spieler";
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
import {
  SPIEL_MELDUNG,
  SPIEL_TEXT,
  bezeichnungProblem,
  fristWirdAbgelaufen,
  istTerminArt,
  meldefristProblem,
  meldefristVorlauf,
  richtwertProblem,
  spielBestaetigen,
  spielEntfernenText,
  spielVerfallText,
  treffpunkteNormal,
  type TerminArt,
  type TreffpunktZeile,
} from "@/lib/spiel";
import { kurzeZeit } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort, jetztAmTrainingsort, terminBegonnen } from "@/lib/zeit";
import { ladeTrainingZumBearbeiten, pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { mitAbsagen } from "@/lib/trainer";
import { besetzungProblem, type Mindestbesetzung } from "@/lib/besetzung";
import { trainerBeimFestlegen, type TrainerWahl } from "@/lib/kern/trainer";
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
 * bestehenden Termin auf ein Datum. Ein Termin trägt höchstens ein Training:
 * immer eine eigene Kopie, ein Termin-Training, das mit ihm lebt; die Quelle
 * bleibt unberührt (PO 2026-10-06).
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
  "id, team_id, art, bezeichnung, richtwert_min, richtwert_max, meldefrist_vorlauf_min, training_id, datum, beginn, ende, ort, ort_link, bemerkung, felder, erwartete_spielerzahl, besetzung_art, besetzung_zahl, serie_id, zeit_abweichend, ort_abweichend, bemerkung_abweichend, ausgefallen, ausfall_grund";

export type TerminRoh = {
  id: string;
  team_id: string;
  /** Training oder Spiel (#459); die Art bleibt. */
  art: TerminArt;
  /** Nur an einem Spiel: Bezeichnung und Richtwert (#459). */
  bezeichnung: string | null;
  richtwert_min: number | null;
  richtwert_max: number | null;
  /** Nur an einem Spiel: die Meldefrist als Minuten vor dem Anpfiff (#463). */
  meldefrist_vorlauf_min: number | null;
  training_id: string | null;
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  /** Der Kartenlink zum Ort (#533); nur mit Ort. */
  ort_link: string | null;
  bemerkung: string | null;
  /** Die Felder des Platzes (#389); `null` = unbekannt. */
  felder: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null` = unbekannt. */
  erwartete_spielerzahl: number | null;
  /** Die Mindestbesetzung (#521). */
  besetzung_art: string | null;
  besetzung_zahl: number | null;
  /** Nur Serientermine tragen eine Serie; die Flags zeigen, welche Angaben
   *  von ihr abweichen. */
  serie_id: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
  /** Ein ausgefallener Termin behält sein Training; es ruht (PO 2026-10-06). */
  ausgefallen: boolean;
  ausfall_grund: string | null;
};

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
/** Die Mindestbesetzung vorab prüfen (#521 AK 5) — mit dem Satz der Oberfläche. */
export function besetzungFehler(m: Mindestbesetzung | undefined): KernFehler | null {
  const p = m === undefined ? null : besetzungProblem(m);
  return p ? fehlschlag("eingabe", p, { feld: "mindestbesetzung" }) : null;
}

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
export async function ladeTermin(supabase: SupabaseClient, terminId: string): Promise<KernErgebnis<TerminRoh>> {
  return lade<TerminRoh>(supabase, terminId, TERMIN_ROH);
}

/** Ein Termin samt Spielerzahl und Kadern — was die Reiter «Spieler:innen»
 *  von Trainings und Spielen brauchen, in einem Zugriff. */
export type TerminMitStand = TerminRoh & {
  spielstand: Spielstand;
  termin_kader: { kader_id: string | null; kader: { name: string } | null }[];
};

export async function ladeTerminMitStand(supabase: SupabaseClient, terminId: string): Promise<KernErgebnis<TerminMitStand>> {
  return lade<TerminMitStand>(supabase, terminId, `${TERMIN_ROH}, spielstand, termin_kader ( kader_id, kader ( name ) )`);
}

async function lade<T extends TerminRoh>(supabase: SupabaseClient, terminId: string, spalten: string): Promise<KernErgebnis<T>> {
  if (!istUuid(terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase.from("training_termine").select(spalten).eq("id", terminId).maybeSingle<T>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  return ok({ ...data, beginn: kurzeZeit(data.beginn), ende: kurzeZeit(data.ende) });
}

// ── Festlegen, ändern, entfernen (#322) ─────────────────────────────────────

export type TerminFestlegen = {
  teamId: string;
  /** Training oder Spiel (#459 AK 1); über den KI-Assistenten Pflicht (AK 19). */
  art: TerminArt;
  /** Nur an einem Spiel: Pflicht (AK 2). */
  bezeichnung?: string | null;
  /** Nur an einem Spiel: Mindest- und Höchstzahl je für sich (AK 5). */
  richtwertMin?: number | null;
  richtwertMax?: number | null;
  /** Nur an einem Spiel: die Meldefrist als `YYYY-MM-DDTHH:MM` (#463 AK 8). */
  meldefrist?: string | null;
  /** Nur an einem Spiel: die Treffpunkte (#465 AK 1–7); ohne oder leer: keine. */
  treffpunkte?: readonly TreffpunktEingabe[] | null;
  datum: string;
  beginn: string;
  ende: string;
  ort?: string | null;
  /** Der Kartenlink zum Ort (#533 AK 1); nur mit Ort. */
  ortLink?: string | null;
  bemerkung?: string | null;
  /** Die Felder des Platzes (#389); ohne Angabe oder leer: keine. */
  felder?: readonly FeldEingabe[] | null;
  /** Die erwartete Spielerzahl (#390); ohne Angabe: unbekannt. */
  spielerzahl?: number | null;
  /** Für welche Kader der Termin gilt (#453 AK 1); ohne oder leer: für alle. */
  kaderIds?: string[];
  /** Wie viele Trainer:innen mindestens dabei sein sollen (#521); ohne: keine. */
  mindestbesetzung?: Mindestbesetzung;
} & TrainerWahl;

/** Was ein Spiel trägt und ein Training nicht (#459 AK 2, 5, 10, 11, 16) —
 *  und umgekehrt. Geprüft wird die Angabe, wie sie nach dem Schreiben
 *  dastünde. Leere Felder- oder Zahlangaben an einem Spiel sind keine. */
function artFehler(
  art: TerminArt,
  a: {
    bezeichnung?: string | null;
    richtwertMin?: number | null;
    richtwertMax?: number | null;
    felder?: readonly FeldEingabe[] | null;
    spielerzahl?: number | null;
    meldefrist?: string | null;
    treffpunkte?: readonly TreffpunktEingabe[] | null;
  },
  pruefeBezeichnung: boolean,
): KernFehler | null {
  if (art === "spiel") {
    if ((a.felder?.length ?? 0) > 0 || (a.spielerzahl !== undefined && a.spielerzahl !== null))
      return fehlschlag("eingabe", SPIEL_TEXT.nurTraining, { feld: a.spielerzahl != null ? "erwartete_spielerzahl" : "felder" });
    if (pruefeBezeichnung) {
      const b = bezeichnungProblem(a.bezeichnung);
      if (b) return fehlschlag("eingabe", b.text, { feld: b.feld });
    }
    const r = richtwertProblem(a.richtwertMin ?? null, a.richtwertMax ?? null);
    return r ? fehlschlag("eingabe", r.text, { feld: r.feld }) : null;
  }
  if (leerZuNull(a.bezeichnung) !== null || (a.richtwertMin ?? null) !== null || (a.richtwertMax ?? null) !== null)
    return fehlschlag("eingabe", SPIEL_TEXT.nurSpiel, { feld: leerZuNull(a.bezeichnung) !== null ? "bezeichnung" : "mindestzahl" });
  if (leerZuNull(a.meldefrist) !== null) return fehlschlag("eingabe", SPIEL_TEXT.nurSpiel, { feld: "meldefrist" });
  if (a.treffpunkte?.length) return fehlschlag("eingabe", SPIEL_TEXT.nurSpiel, { feld: "treffpunkte" });
  return null;
}

/** Ein Treffpunkt, wie ihn Oberfläche und KI angeben: `zeitpunkt` als
 *  `YYYY-MM-DDTHH:MM`, `ort` nur ausser vor Ort (#465). */
export type TreffpunktEingabe = { anreise: string; zeitpunkt: string; ort?: string | null };

/** Die Treffpunkte eines Spiels zum Anpfiff `datum`/`beginn` prüfen
 *  (#465 AK 2–7); das Feld nennt die Zeile («treffpunkte[1]»). */
function treffpunkteAus(
  liste: readonly TreffpunktEingabe[],
  datum: string,
  beginn: string | null | undefined,
): KernErgebnis<TreffpunktZeile[]> {
  const r = treffpunkteNormal(liste, datum, beginn ?? "");
  if (r.ok) return ok(r.zeilen);
  const { index, text } = r.problem;
  return fehlschlag("eingabe", text, { feld: index === null ? "treffpunkte" : `treffpunkte[${index}]` });
}

/** Die ganze Liste der Treffpunkte eines Spiels schreiben (#465 AK 1). */
async function setzeTreffpunkte(supabase: SupabaseClient, terminId: string, zeilen: TreffpunktZeile[]): Promise<KernErgebnis> {
  const { error } = await supabase.rpc("spiel_treffpunkte_setzen", { p_termin: terminId, p_liste: zeilen });
  return error ? ausDbFehler(error) : ok(undefined);
}

/** Die Meldefrist eines Spiels prüfen (#463 AK 8): leer heisst keine. */
function fristFehler(datum: string, beginn: string | null | undefined, frist: string | null | undefined): KernFehler | null {
  const f = leerZuNull(frist);
  if (f === null) return null;
  const p = meldefristProblem(datum, beginn ?? "", f);
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Die Meldefrist als Minuten vor dem Anpfiff, wie sie gespeichert wird. */
function vorlaufAus(datum: string, beginn: string | null | undefined, frist: string | null | undefined): number | null {
  const f = leerZuNull(frist);
  return f === null ? null : meldefristVorlauf(datum, beginn ?? "", f);
}

/** Ein Spiel nur mit bevorstehendem Anpfiff (#459 AK 21) — vorab mit dem
 *  Satz der Datenebene (`SPIEL_ANPFIFF_VERGANGEN`). */
function anpfiffFehler(datum: string, beginn: string | null): KernFehler | null {
  return beginn && terminBegonnen(datum, beginn)
    ? fehlschlag("regel", SPIEL_MELDUNG.SPIEL_ANPFIFF_VERGANGEN, { feld: "beginn" })
    : null;
}

/** Einen einzelnen Termin ohne Training festlegen (AK 1–6), auch in der
 *  Vergangenheit (AK 4), auf Wunsch mit seinen Feldern (#389 AK 1, 8) und
 *  der erwarteten Spielerzahl (#390 AK 1). Ein Spiel (#459) trägt statt
 *  dessen Bezeichnung und Richtwert und hat seinen Anpfiff noch vor sich. */
export async function legeTerminFest(
  supabase: SupabaseClient,
  userId: string,
  e: TerminFestlegen,
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  if (!istTerminArt(e.art)) return fehlschlag("eingabe", SPIEL_TEXT.art, { feld: "art" });
  const problem = feldFehler(terminProblem(e));
  if (problem) return problem;
  const art = artFehler(e.art, e, true);
  if (art) return art;
  if (e.art === "spiel") {
    const anpfiff = anpfiffFehler(e.datum, leerZuNull(e.beginn));
    if (anpfiff) return anpfiff;
  }
  const frist = fristFehler(e.datum, e.beginn, e.meldefrist);
  if (frist) return frist;
  const treffpunkte = treffpunkteAus(e.treffpunkte ?? [], e.datum, e.beginn);
  if (!treffpunkte.ok) return treffpunkte;
  const felder = pruefeFelder(e.felder);
  if (!felder.ok) return felder;
  const zahl = spielerzahlFehler(e.spielerzahl);
  if (zahl) return zahl;
  const besetzung = besetzungFehler(e.mindestbesetzung);
  if (besetzung) return besetzung;
  // Kader nur an einem anstehenden Termin (#453 AK 1, 13) — vorab, damit
  // kein Termin ohne die gewählten Kader stehen bleibt.
  if (e.kaderIds?.length && terminBegonnen(e.datum, e.beginn))
    return fehlschlag("regel", KADER_MELDUNG.KADER_TERMIN_BEGONNEN, { feld: "kader_ids" });
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const trainer = await trainerBeimFestlegen(supabase, userId, e.teamId, e);
  if (!trainer.ok) return trainer;

  const { data, error } = await supabase
    .from("training_termine")
    .insert({
      team_id: e.teamId,
      art: e.art,
      bezeichnung: e.art === "spiel" ? leerZuNull(e.bezeichnung) : null,
      richtwert_min: e.art === "spiel" ? (e.richtwertMin ?? null) : null,
      richtwert_max: e.art === "spiel" ? (e.richtwertMax ?? null) : null,
      meldefrist_vorlauf_min: e.art === "spiel" ? vorlaufAus(e.datum, e.beginn, e.meldefrist) : null,
      datum: e.datum,
      beginn: leerZuNull(e.beginn),
      ende: leerZuNull(e.ende),
      ort: leerZuNull(e.ort),
      ort_link: leerZuNull(e.ortLink),
      bemerkung: leerZuNull(e.bemerkung),
      felder: felder.felder,
      erwartete_spielerzahl: e.spielerzahl ?? null,
      besetzung_art: e.mindestbesetzung?.art ?? null,
      besetzung_zahl: e.mindestbesetzung?.zahl ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return ausDbFehler(error);
  if (treffpunkte.wert.length) {
    const tp = await setzeTreffpunkte(supabase, data.id, treffpunkte.wert);
    if (!tp.ok) {
      // Ohne seine Treffpunkte soll das Spiel nicht stehen bleiben.
      const weg = await supabase.from("training_termine").delete().eq("id", data.id);
      return weg.error ? ausDbFehler(weg.error) : tp;
    }
  }
  // Ein neuer Termin hat keine Abmeldungen: Kader setzen lässt nichts verfallen.
  if (e.kaderIds?.length) {
    const k = await supabase.rpc("termin_kader_setzen", { p_termin: data.id, p_kader: e.kaderIds });
    if (k.error) {
      // Ohne seine Kader soll der Termin nicht stehen bleiben.
      const weg = await supabase.from("training_termine").delete().eq("id", data.id);
      if (weg.error) return ausDbFehler(weg.error);
      return k.error.message.includes("KADER_NICHT_GEFUNDEN")
        ? fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, { feld: "kader_ids" })
        : ausDbFehler(k.error);
    }
  }
  // Die Besetzung (#519 AK 1): ohne sie soll der Termin nicht stehen bleiben.
  const b = await supabase.rpc("termin_trainer_aendern", {
    p_termin: data.id,
    p_einladen: trainer.wert.eingeladene,
    p_verantwortlich: trainer.wert.verantwortlich,
  });
  if (b.error) {
    const weg = await supabase.from("training_termine").delete().eq("id", data.id);
    return weg.error ? ausDbFehler(weg.error) : kalenderFehler(b.error);
  }
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
  /** Der Kartenlink zum Ort (#533): `undefined` = unverändert, solange der
   *  Ort bleibt — ändert sich der Ort ohne ihn, fällt er weg (PC 1). */
  ortLink?: string | null;
  bemerkung?: string | null;
  /** Die Felder als ganze Liste (#389 AK 7): `undefined` = unverändert,
   *  `null` oder `[]` = entfernen. */
  felder?: readonly FeldEingabe[] | null;
  /** Die erwartete Spielerzahl (#390 AK 2): `undefined` = unverändert,
   *  `null` = entfernen. */
  spielerzahl?: number | null;
  /** Die Mindestbesetzung (#521 AK 1, 2): `undefined` = unverändert, `null` = entfernen. */
  mindestbesetzung?: Mindestbesetzung;
  /** Nur an einem Spiel (#459 AK 3, 5): `undefined` = unverändert; der
   *  Richtwert je Grenze `null` = entfernen. */
  bezeichnung?: string;
  richtwertMin?: number | null;
  richtwertMax?: number | null;
  /** Nur an einem Spiel (#463 AK 8): `undefined` = unverändert (eine
   *  Verlegung nimmt sie im selben Abstand mit), `null` = entfernen, sonst
   *  der Zeitpunkt `YYYY-MM-DDTHH:MM`. */
  meldefrist?: string | null;
  /** Nur an einem Spiel (#465 AK 1): die ganze Liste, `undefined` =
   *  unverändert (eine Verlegung nimmt sie im selben Abstand mit, PC 2),
   *  `null` oder `[]` = alle entfernen. Die Zeitpunkte gelten zum neuen
   *  Anpfiff. */
  treffpunkte?: readonly TreffpunktEingabe[] | null;
  /** Das Training, das der Termin bei der Auswahl trug (AK 23). `undefined`
   *  beim KI-Weg: geprüft wird dann gegen den eben gelesenen Stand. */
  erwartetesTraining?: string | null;
  /** Verfallen durch eine Verlegung Abmeldungen (#437 AK 1), braucht es die
   *  Bestätigung — sonst kommt ein Fehler mit `verfallend`. Die Oberfläche
   *  sendet die bestätigte Zahl, die KI `true`. */
  bestaetigt?: boolean | number;
};

/** Was eine Verlegung verfallen lässt: Abmeldungen (#437 AK 1) und, wird
 *  ein begonnener Termin wieder offen, Nachträge zur Anwesenheit (#475 AK
 *  12). `summe` bestätigt die Oberfläche. */
export type Verfallend = {
  abmeldungen: number;
  nachtraege: number;
  /** Absagen von Trainer:innen (#520 AK 11). */
  absagen: number;
  /** Anmeldungen von Probe-Spieler:innen (#555 AK 14, PC 5). */
  anmeldungen: number;
  summe: number;
  /** Nur an einem Spiel (#463 AK 13, 26; #464 AK 10): verfallende Meldungen
   *  und Kennzeichnungen und ob die Meldefrist danach schon abgelaufen ist. */
  spiel?: { meldungen: number; kennzeichnungen: number; fristAbgelaufen: boolean };
};

/** Was verfällt, wenn der Termin auf `datum`/`beginn` verlegt wird —
 *  dieselbe Entscheidung wie der Trigger. */
export async function verfallendeAbmeldungen(
  supabase: SupabaseClient,
  terminId: string,
  datum: string,
  beginn: string | null,
): Promise<KernErgebnis<Verfallend>> {
  const p = { p_termin: terminId, p_datum: datum, p_beginn: beginn };
  const [ab, nach, absagen, an] = await Promise.all([
    supabase.rpc("termin_abmeldungen_verfallend", p),
    supabase.rpc("termin_nachtraege_verfallend", p),
    supabase.rpc("termin_absagen_verfallend", p),
    supabase.rpc("termin_anmeldungen_verfallend", p),
  ]);
  if (ab.error) return ausDbFehler(ab.error);
  if (nach.error) return ausDbFehler(nach.error);
  if (absagen.error) return ausDbFehler(absagen.error);
  if (an.error) return ausDbFehler(an.error);
  return ok(
    verfallend(
      (ab.data as number | null) ?? 0,
      (nach.data as number | null) ?? 0,
      (absagen.data as number | null) ?? 0,
      (an.data as number | null) ?? 0,
    ),
  );
}

export function verfallend(abmeldungen: number, nachtraege: number, absagen = 0, anmeldungen = 0): Verfallend {
  return { abmeldungen, nachtraege, absagen, anmeldungen, summe: abmeldungen + nachtraege + absagen + anmeldungen };
}

/** Ein Fehler, der vor dem Verlegen nach der Bestätigung fragt. */
export function verfallFehler(v: Verfallend): KernFehler {
  if (v.spiel)
    return fehlschlag(
      "regel",
      spielBestaetigen(mitAbsagen(spielVerfallText(v.spiel.meldungen, v.spiel.fristAbgelaufen, v.spiel.kennzeichnungen, v.nachtraege), v.absagen)),
      {
        feld: "bestaetigt",
        verfallend: v.summe,
        nachtraege: v.nachtraege,
        fristAbgelaufen: v.spiel.fristAbgelaufen,
        ...(v.spiel.kennzeichnungen > 0 && { kennzeichnungen: v.spiel.kennzeichnungen }),
        ...(v.absagen > 0 && { absagen: v.absagen }),
      },
    );
  return fehlschlag("regel", verfallBestaetigen(v.abmeldungen, v.nachtraege, v.absagen, v.anmeldungen), {
    feld: "bestaetigt",
    verfallend: v.summe,
    nachtraege: v.nachtraege,
    ...(v.absagen > 0 && { absagen: v.absagen }),
    ...(v.anmeldungen > 0 && { anmeldungen: v.anmeldungen }),
  });
}

/** Wie viele Meldungen und Kennzeichnungen als nicht aufgeboten ein Spiel
 *  trägt — offen oder beim Anpfiff festgehalten, Ehemalige eingeschlossen:
 *  Auch ihre verschwinden (und der Plan zählt sie, `spiel_stand`).
 *  Sie verfallen mit einem anderen Datum (#463 PC 1, 7; #464 PC 2) und
 *  verschwinden mit dem Spiel (#463 AK 27, #464 AK 10). */
export async function spielMeldungenZahl(
  supabase: SupabaseClient,
  terminId: string,
): Promise<KernErgebnis<{ meldungen: number; kennzeichnungen: number }>> {
  const offen = () => supabase.from("spiel_meldungen").select("termin_id", { count: "exact", head: true }).eq("termin_id", terminId);
  const fest = () => supabase.from("spiel_teilnahmen").select("termin_id", { count: "exact", head: true }).eq("termin_id", terminId);
  const zahlen = await Promise.all([
    offen().not("zustand", "is", null),
    fest().not("zustand", "is", null),
    offen().eq("nicht_aufgeboten", true),
    fest().eq("nicht_aufgeboten", true),
  ]);
  for (const z of zahlen) if (z.error) return ausDbFehler(z.error);
  const [mo, mf, ko, kf] = zahlen.map((z) => z.count ?? 0);
  return ok({ meldungen: mo + mf, kennzeichnungen: ko + kf });
}

/** Wie viele Nachträge zur Anwesenheit ein begonnenes Spiel trägt — sie
 *  verfallen mit jeder Verlegung, denn der Anpfiff liegt danach in der
 *  Zukunft (#487 AK 13, PC 3). Wie bei den Meldungen samt Ehemaligen: Auch
 *  ihre verschwinden. */
async function spielNachtraegeZahl(supabase: SupabaseClient, terminId: string): Promise<KernErgebnis<number>> {
  const { count, error } = await supabase
    .from("spiel_teilnahmen")
    .select("termin_id", { count: "exact", head: true })
    .eq("termin_id", terminId)
    .eq("nachgetragen", true);
  return error ? ausDbFehler(error) : ok(count ?? 0);
}

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
): Promise<
  KernErgebnis<{
    terminId: string;
    teamId: string;
    trainingId: string | null;
    abmeldungenVerfallen: number;
    /** Der Kartenlink fiel mit dem Ort weg (#533 AK 14). */
    kartenlinkEntfallen: boolean;
  }>
> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;

  const ort = e.ort !== undefined ? leerZuNull(e.ort) : t.ort;
  const neu = {
    datum: e.datum ?? t.datum,
    beginn: e.beginn !== undefined ? leerZuNull(e.beginn) : t.beginn,
    ende: e.ende !== undefined ? leerZuNull(e.ende) : t.ende,
    ort,
    // #533 PC 1: Der Link gehört zum Ort — ändert sich der Ort ohne ihn, fällt er weg.
    ortLink: e.ortLink !== undefined ? leerZuNull(e.ortLink) : ort !== t.ort ? null : t.ort_link,
    bemerkung: e.bemerkung !== undefined ? leerZuNull(e.bemerkung) : t.bemerkung,
  };
  const problem = feldFehler(terminProblem(neu));
  if (problem) return problem;
  // Die Spielangaben, wie sie nach dem Schreiben dastünden (#459).
  const spiel = {
    bezeichnung: e.bezeichnung,
    richtwertMin: e.richtwertMin !== undefined ? e.richtwertMin : t.richtwert_min,
    richtwertMax: e.richtwertMax !== undefined ? e.richtwertMax : t.richtwert_max,
    felder: e.felder,
    spielerzahl: e.spielerzahl,
  };
  const artProblem =
    t.art === "spiel"
      ? artFehler("spiel", spiel, e.bezeichnung !== undefined)
      : artFehler(
          "training",
          {
            bezeichnung: e.bezeichnung,
            richtwertMin: e.richtwertMin,
            richtwertMax: e.richtwertMax,
            meldefrist: e.meldefrist,
            treffpunkte: e.treffpunkte,
          },
          false,
        );
  if (artProblem) return artProblem;
  if (t.art === "spiel" && (neu.datum !== t.datum || neu.beginn !== t.beginn)) {
    const anpfiff = anpfiffFehler(neu.datum, neu.beginn);
    if (anpfiff) return anpfiff;
  }
  const frist = t.art === "spiel" && e.meldefrist !== undefined ? fristFehler(neu.datum, neu.beginn, e.meldefrist) : null;
  if (frist) return frist;
  const treffpunkte =
    t.art === "spiel" && e.treffpunkte !== undefined ? treffpunkteAus(e.treffpunkte ?? [], neu.datum, neu.beginn) : null;
  if (treffpunkte && !treffpunkte.ok) return treffpunkte;
  const felder = e.felder === undefined ? null : pruefeFelder(e.felder);
  if (felder && !felder.ok) return felder;
  const zahl = spielerzahlFehler(e.spielerzahl);
  if (zahl) return zahl;
  const besetzung = besetzungFehler(e.mindestbesetzung);
  if (besetzung) return besetzung;

  const aenderung: Partial<
    Omit<typeof neu, "ortLink"> & {
      ort_link: string | null;
      felder: Felder | null;
      erwartete_spielerzahl: number | null;
      besetzung_art: string | null;
      besetzung_zahl: number | null;
      bezeichnung: string | null;
      richtwert_min: number | null;
      richtwert_max: number | null;
      meldefrist_vorlauf_min: number | null;
    }
  > = {};
  if (e.datum !== undefined) aenderung.datum = neu.datum;
  if (e.beginn !== undefined || e.ende !== undefined) {
    aenderung.beginn = neu.beginn;
    aenderung.ende = neu.ende;
  }
  if (e.ort !== undefined) aenderung.ort = neu.ort;
  if (neu.ortLink !== t.ort_link) aenderung.ort_link = neu.ortLink;
  if (e.bemerkung !== undefined) aenderung.bemerkung = neu.bemerkung;
  // Die Felder sind EINE Angabe und gehen als ganze Liste (#389 AK 7).
  if (felder) aenderung.felder = felder.felder;
  if (e.spielerzahl !== undefined) aenderung.erwartete_spielerzahl = e.spielerzahl;
  if (e.mindestbesetzung !== undefined) {
    aenderung.besetzung_art = e.mindestbesetzung?.art ?? null;
    aenderung.besetzung_zahl = e.mindestbesetzung?.zahl ?? null;
  }
  if (t.art === "spiel") {
    if (e.bezeichnung !== undefined) aenderung.bezeichnung = leerZuNull(e.bezeichnung);
    if (e.richtwertMin !== undefined) aenderung.richtwert_min = e.richtwertMin;
    if (e.richtwertMax !== undefined) aenderung.richtwert_max = e.richtwertMax;
    if (e.meldefrist !== undefined) aenderung.meldefrist_vorlauf_min = vorlaufAus(neu.datum, neu.beginn, e.meldefrist);
  }

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
    // Ort und Kartenlink weichen gemeinsam ab (#533 PC 2).
    if (("ort" in aenderung && neu.ort !== t.ort) || "ort_link" in aenderung) flags.ort_abweichend = true;
    if ("bemerkung" in aenderung && neu.bemerkung !== t.bemerkung) flags.bemerkung_abweichend = true;
    if (felder && !gleicheFelder(felder.felder, t.felder)) flags.felder_abweichend = true;
    if (e.spielerzahl !== undefined && e.spielerzahl !== t.erwartete_spielerzahl) flags.spielerzahl_abweichend = true;
    if (
      e.mindestbesetzung !== undefined &&
      ((e.mindestbesetzung?.art ?? null) !== t.besetzung_art || (e.mindestbesetzung?.zahl ?? null) !== t.besetzung_zahl)
    )
      flags.besetzung_abweichend = true;
  }

  // #327 PO 6, PC 4: Ein einzeln auf heute oder später verlegter Termin findet
  // wieder statt. Ein Tausch der Serie verlegt nicht einzeln (PC 5). Das
  // Zurücksetzen gehört zur Änderung des Datums und steht darum nur dann im
  // Schreiben, wenn es sie gibt.
  const ausfallEndet =
    t.ausgefallen && "datum" in aenderung && neu.datum !== t.datum && neu.datum >= heuteAmTrainingsort();
  const ausfall = ausfallEndet ? { ausgefallen: false, ausfall_grund: null } : {};

  // #437 AK 1: Verlegt, verfallen die Abmeldungen — erst nach Bestätigung.
  // Ein Spiel (#463 AK 13, 26): Meldungen nur mit dem Datum, dazu die Frist.
  let verfallen = 0;
  if (t.art === "spiel" && (neu.datum !== t.datum || neu.beginn !== t.beginn)) {
    const zahl = neu.datum !== t.datum ? await spielMeldungenZahl(supabase, t.id) : ok({ meldungen: 0, kennzeichnungen: 0 });
    if (!zahl.ok) return zahl;
    const vorlauf = "meldefrist_vorlauf_min" in aenderung ? (aenderung.meldefrist_vorlauf_min ?? null) : t.meldefrist_vorlauf_min;
    const frist = fristWirdAbgelaufen(t, { datum: neu.datum, beginn: neu.beginn ?? "" }, vorlauf, jetztAmTrainingsort());
    const nachtraege = await spielNachtraegeZahl(supabase, t.id);
    if (!nachtraege.ok) return nachtraege;
    // #520 PC 3: Mit dem Datum verfallen auch die Absagen der Trainer:innen.
    const absagen = await supabase.rpc("termin_absagen_verfallend", { p_termin: t.id, p_datum: neu.datum, p_beginn: neu.beginn });
    if (absagen.error) return ausDbFehler(absagen.error);
    const { meldungen, kennzeichnungen } = zahl.wert;
    const abgesagt = (absagen.data as number | null) ?? 0;
    const v: Verfallend = {
      abmeldungen: 0,
      nachtraege: nachtraege.wert,
      absagen: abgesagt,
      anmeldungen: 0,
      summe: meldungen + kennzeichnungen + nachtraege.wert + abgesagt,
      spiel: { meldungen, kennzeichnungen, fristAbgelaufen: frist },
    };
    // #464 AK 10, 13; #487 AK 13, 17: auch wenn nur Kennzeichnungen oder Nachträge verfallen.
    if ((v.summe > 0 || frist) && e.bestaetigt !== true && e.bestaetigt !== v.summe) return verfallFehler(v);
    verfallen = meldungen;
  } else if (("datum" in aenderung && neu.datum !== t.datum) || ("beginn" in aenderung && neu.beginn !== t.beginn)) {
    const n = await verfallendeAbmeldungen(supabase, t.id, neu.datum, neu.beginn);
    if (!n.ok) return n;
    // Eine Zahl bestätigt genau so viele (Oberfläche); sind es inzwischen
    // andere, fragt der Kern neu. `true` (KI) bestätigt, was es ist.
    if (n.wert.summe > 0 && e.bestaetigt !== true && e.bestaetigt !== n.wert.summe) return verfallFehler(n.wert);
    verfallen = n.wert.abmeldungen;
  }

  const erwartet = e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id;
  // Die Treffpunkte (#465) zuerst: Scheitert danach das Schreiben am Termin,
  // gehen sie auf den Stand zurück — wie `legeTerminFest` aufräumt.
  let treffpunkteVorher: TreffpunktZeile[] | null = null;
  if (treffpunkte) {
    const vorher = await supabase.from("spiel_treffpunkte").select("anreise, vorlauf_min, ort").eq("termin_id", t.id);
    if (vorher.error) return ausDbFehler(vorher.error);
    treffpunkteVorher = vorher.data as TreffpunktZeile[];
    const tp = await setzeTreffpunkte(supabase, t.id, treffpunkte.wert);
    if (!tp.ok) return tp;
  }
  const schreiben = { ...aenderung, ...flags, ...ausfall };
  // Ändern sich nur die Treffpunkte, steht am Termin nichts zu schreiben.
  if (Object.keys(schreiben).length > 0) {
    const basis = supabase.from("training_termine").update(schreiben).eq("id", t.id);
    const { data, error } = await (erwartet === null
      ? basis.is("training_id", null)
      : basis.eq("training_id", erwartet)
    )
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (treffpunkteVorher) await setzeTreffpunkte(supabase, t.id, treffpunkteVorher);
      return error ? ausDbFehler(error) : warumNichtGeschrieben(supabase, t.id, e.erwartetesTraining === undefined);
    }
  }
  return ok({
    terminId: t.id,
    teamId: t.team_id,
    trainingId: erwartet,
    abmeldungenVerfallen: verfallen,
    kartenlinkEntfallen: t.ort_link !== null && neu.ortLink === null && e.ortLink === undefined,
  });
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
  e: {
    terminId: string;
    erwartetesTraining?: string | null;
    /** Ein Spiel mit Meldungen oder Kennzeichnungen (#463 AK 27, #464 AK 10):
     *  die bestätigte Summe (Oberfläche) oder `true` (KI). Ohne kommt ein
     *  Fehler mit `verschwindend`. */
    bestaetigt?: boolean | number;
  },
): Promise<KernErgebnis<{ teamId: string; training: Verlassen }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data: vorher } = await supabase
    .from("training_termine")
    .select("art, training_id")
    .eq("id", e.terminId)
    .maybeSingle<{ art: TerminArt; training_id: string | null }>();
  if (vorher?.art === "spiel") {
    const zahl = await spielMeldungenZahl(supabase, e.terminId);
    if (!zahl.ok) return zahl;
    const { meldungen, kennzeichnungen } = zahl.wert;
    const summe = meldungen + kennzeichnungen;
    if (summe > 0 && e.bestaetigt !== true && e.bestaetigt !== summe)
      return fehlschlag("regel", spielBestaetigen(spielEntfernenText(meldungen, kennzeichnungen)), {
        feld: "bestaetigt",
        verschwindend: summe,
        ...(kennzeichnungen > 0 && { kennzeichnungen }),
      });
  }
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
  erwartet?: { trainingAmTermin: string | null };
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
  if (t.art === "spiel") return fehlschlag("regel", SPIEL_TEXT.keinTraining, TERMIN_FELD);
  if (t.ausgefallen) return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN, TERMIN_FELD);

  const training = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!training.ok) return training;
  const { ziel } = training.wert;
  if (ziel.art === "team" && ziel.teamId !== t.team_id)
    return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM, { feld: "training_id" });
  if (t.training_id === e.trainingId) return ok({ terminId: t.id, teamId: t.team_id, trainingId: e.trainingId, ersetzt: null });

  // Eine veraltete Auswahl legt keine Kopie an.
  if (e.erwartet && t.training_id !== e.erwartet.trainingAmTermin)
    return fehlschlag("konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);

  const bilder = await terminTrainingBilder(supabase, [t.training_id]);
  const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: t.team_id });
  if (!kopie.ok) return kopierFehler(supabase, kopie);
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: kopie.neueId,
    p_erwartet: { termin_training: e.erwartet ? e.erwartet.trainingAmTermin : t.training_id },
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
