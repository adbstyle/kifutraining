import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import type { Wochentag } from "@/lib/serie";
import { sortStufen } from "@/lib/training";
import type { KategorieSlug } from "@/lib/vocab";

/**
 * Termine lesen für einen Client, der bereits als Nutzer spricht (Cookie-
 * Session ODER OAuth-Bearer, Epic #190) — abgespalten aus
 * lib/queries/termine.ts nach dem Muster von trainings-fuer.ts, damit der
 * Fachkern (lib/kern) Termine lesen kann, ohne den Cookie-Client mitzuziehen.
 * Die Cookie-Wrapper (`getTeamPlan`, `getTerminZuTraining`) bleiben in
 * termine.ts; die Typen und reinen Helfer werden dort weiter exportiert.
 *
 * Ein Termin gehört dem Team; das Training ist freiwillig (#322). Trägt er
 * eines, ist es ihm genau einmal zugeordnet (UNIQUE `training_id`) — ein
 * weiteres Training für einen anderen Tag entsteht als Kopie, der Termin wird
 * nicht verschoben. Datum, Beginn und Ende sind bewusst ohne Zeitzone
 * gespeichert: gemeint ist die Uhrzeit am Trainingsort, nicht ein Zeitpunkt in
 * UTC. Sichtbar sind Termine nur Mitgliedern des Teams (RLS `tt_select`).
 */

/** Die Regel und die Werte der Serie, zu der ein Termin gehört (#324, #326). */
export type TerminSerie = {
  id: string;
  version: number;
  wochentage: Wochentag[];
  beginnDatum: string;
  endDatum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  bemerkung: string | null;
};

/** Welche Angaben eines Serientermins von seiner Serie abweichen (#326 AK 12,
 *  14; PO 3). Das Datum weicht ab, wenn der Termin nicht mehr an seinem
 *  Serientag liegt. */
export type Abweichung = "datum" | "zeit" | "ort" | "bemerkung";

export type TerminZeile = {
  id: string;
  teamId: string;
  datum: string;
  /** `HH:MM`. Neue Termine tragen Beginn und Ende immer; übernommene können
   *  ohne sein (#322 PO 9). */
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  /** `null`: Der Termin trägt (noch) kein Training (#322). */
  training: { id: string; name: string; stufen: KategorieSlug[] } | null;
  /** `null`: ein einzelner Termin ohne Serie. */
  serie: TerminSerie | null;
  /** Der Tag der Serienregel, für den der Termin angelegt wurde. */
  serienTag: string | null;
  /** Leer für einzelne Termine und Serientermine ohne Abweichung. */
  abweichungen: Abweichung[];
};

type RawTermin = {
  id: string;
  team_id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  created_at: string;
  serien_tag: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
  trainings: { id: string; name: string; stufen: string[] | null } | null;
  termin_serien: {
    id: string;
    version: number;
    wochentage: number[];
    beginn_datum: string;
    end_datum: string;
    beginn: string;
    ende: string;
    ort: string | null;
    bemerkung: string | null;
  } | null;
};

/** Beginn oder Ende auf `HH:MM` kürzen — Postgres liefert `HH:MM:SS`.
 *
 *  Exportiert, weil jede Abfrage, die eine Uhrzeit ausliefert, sie so kürzen
 *  MUSS: das Zeitfeld der Oberfläche und die serverseitige Prüfung akzeptieren
 *  ausschliesslich `HH:MM`. Ein roh durchgereichter Wert wird sonst erst beim
 *  Speichern als «ungültige Uhrzeit» abgewiesen. */
export function kurzeZeit(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

const TERMIN_SELECT =
  "id, team_id, datum, beginn, ende, ort, bemerkung, created_at, serien_tag, zeit_abweichend, ort_abweichend, bemerkung_abweichend, " +
  "trainings ( id, name, stufen ), termin_serien ( id, version, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung )";

function mapTermin(t: RawTermin): TerminZeile {
  return {
    id: t.id,
    teamId: t.team_id,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ende: kurzeZeit(t.ende),
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: t.trainings
      ? { id: t.trainings.id, name: t.trainings.name, stufen: sortStufen(t.trainings.stufen ?? []) }
      : null,
    serie: t.termin_serien
      ? {
          id: t.termin_serien.id,
          version: t.termin_serien.version,
          wochentage: t.termin_serien.wochentage as Wochentag[],
          beginnDatum: t.termin_serien.beginn_datum,
          endDatum: t.termin_serien.end_datum,
          beginn: kurzeZeit(t.termin_serien.beginn)!,
          ende: kurzeZeit(t.termin_serien.ende)!,
          ort: t.termin_serien.ort,
          bemerkung: t.termin_serien.bemerkung,
        }
      : null,
    serienTag: t.serien_tag,
    abweichungen: t.termin_serien
      ? ([
          t.serien_tag !== t.datum && "datum",
          t.zeit_abweichend && "zeit",
          t.ort_abweichend && "ort",
          t.bemerkung_abweichend && "bemerkung",
        ].filter(Boolean) as Abweichung[])
      : [],
  };
}

/** Der Trainingsplan eines Teams: alle Termine chronologisch aufsteigend.
 *
 *  Ein Select mit Embed statt zwei Abfragen — der Plan soll auch bei hundert
 *  Terminen in einem Rutsch stehen. Sortiert wird in der DB nach Datum und
 *  Beginn (ohne Beginn zuletzt am selben Tag); `created_at` ist der stabile
 *  Tiebreaker, damit zwei gleich eingeplante Termine nicht bei jedem Laden die
 *  Plätze tauschen. */
export async function getTeamPlanFuer(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TerminZeile[]> {
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  // Der Guard im Layout greift hier nicht — Layout und Page rendern parallel;
  // die leere Liste verhindert den 500 vor dem Redirect.
  if (!istUuid(teamId)) return [];
  const { data, error } = await supabase
    .from("training_termine")
    .select(TERMIN_SELECT)
    .eq("team_id", teamId)
    .order("datum", { ascending: true })
    .order("beginn", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as RawTermin[]).map(mapTermin);
}

/** «Noch nicht vorbereitet» (Epic PO 7): anstehend und ohne Training. Teil D
 *  nimmt ausgefallene Termine aus. */
export function nochNichtVorbereitet(t: TerminZeile, heute: string): boolean {
  return t.datum >= heute && t.training === null;
}

/** Ein Trainingsplan, geteilt in Kommendes und Vergangenes (Story 18). */
export type Plan = { kommend: TerminZeile[]; vergangen: TerminZeile[] };

/** Vergangene Einheiten absteigend ordnen: die jüngste zuerst.
 *
 *  Kein blosses Umdrehen der aufsteigenden Liste — dabei rutschten die
 *  Einheiten ohne Beginn, die am selben Tag zuletzt stehen, an dessen Anfang.
 *  Sie sollen auch rückwärts betrachtet hinter denen mit Beginn bleiben.
 *  `Array.sort` ist stabil, und die Liste kommt bereits nach `created_at`
 *  geordnet aus der Datenbank; damit bleibt die Reihenfolge zweier gleich
 *  eingeplanter Termine über wiederholte Aufrufe dieselbe. */
function juengsteZuerst(a: TerminZeile, b: TerminZeile): number {
  if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
  if (a.beginn === b.beginn) return 0;
  if (a.beginn === null) return 1;
  if (b.beginn === null) return -1;
  return a.beginn < b.beginn ? 1 : -1;
}

/** Den Plan am heutigen Tag in zwei Abschnitte teilen (Story 18).
 *
 *  Die Grenze liegt am Tagesende, nicht am Ende der Lektion: Ein Termin trägt
 *  keine Dauer, und die Dauer des Trainings ist bloss die Summe freiwilliger
 *  Übungszeiten, die sich nachträglich ändern lässt. Eine gerechnete Endzeit
 *  könnte eine Einheit später zwischen den Abschnitten hin und her schieben,
 *  ohne dass jemand den Termin angefasst hätte.
 *
 *  Der heutige Tag zählt vollständig zum Kommenden — die Einheit von heute
 *  Abend soll nicht schon mittags nach unten fallen.
 *
 *  Das Kommende behält die Ordnung aus der Datenbank (Datum, dann Beginn,
 *  ohne Beginn zuletzt). */
export function teilePlan(termine: TerminZeile[], heute: string): Plan {
  return {
    kommend: termine.filter((t) => t.datum >= heute),
    vergangen: termine.filter((t) => t.datum < heute).sort(juengsteZuerst),
  };
}

/** Der Termin, dem ein Training zugeordnet ist, falls es einen hat. Für den
 *  Kopf der Durchführen-Ansicht (AK 19). */
export async function getTerminZuTrainingFuer(
  supabase: SupabaseClient,
  trainingId: string,
): Promise<TerminZeile | null> {
  if (!istUuid(trainingId)) return null;

  const { data, error } = await supabase
    .from("training_termine")
    .select(TERMIN_SELECT)
    .eq("training_id", trainingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return mapTermin(data as unknown as RawTermin);
}
