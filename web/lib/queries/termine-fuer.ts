import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import type { Wochentag } from "@/lib/serie";
import type { Felder } from "@/lib/termin-felder";
import { sortStufen } from "@/lib/training";
import { heuteAmTrainingsort } from "@/lib/zeit";
import type { KategorieSlug } from "@/lib/vocab";
import type { Spielstand } from "@/lib/spieler";
import { nachKaderName, nachTerminKader, type TerminKader } from "@/lib/kader";
import { meldefristZeitpunkt, treffpunkteZu, type TerminArt, type Treffpunkt, type TreffpunktZeile } from "@/lib/spiel";
import { imFilter, nachTrainerName, type Eingrenzung, type SerienTrainer, type TerminTrainer } from "@/lib/trainer";

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
  /** Felder und erwartete Spielerzahl, die die Serie vorgibt (#391); `null` = unbekannt. */
  felder: Felder | null;
  spielerzahl: number | null;
  /** Die Eingeladenen und die Verantwortliche, die die Serie vorgibt (#519), nach Name. */
  trainer: SerienTrainer[];
  /** Die Kader, die die Serie vorgibt (#453), nach Namen; leer = für alle. */
  kader: { id: string; name: string }[];
};

/** Welche Angaben eines Serientermins von seiner Serie abweichen (#326 AK 12,
 *  14; PO 3). Das Datum weicht ab, wenn der Termin nicht mehr an seinem
 *  Serientag liegt. */
export type Abweichung =
  | "datum"
  | "zeit"
  | "ort"
  | "bemerkung"
  | "eingeladene"
  | "verantwortung"
  | "felder"
  | "spielerzahl"
  | "kader";

/** Was nur ein Spiel trägt (#459): Bezeichnung und Richtwert. */
export type SpielAngaben = {
  bezeichnung: string;
  /** Mindest- und Höchstzahl je für sich; `null` = nicht festgelegt. */
  richtwertMin: number | null;
  richtwertMax: number | null;
  /** Die Meldefrist der Spielervertretung als `YYYY-MM-DDTHH:MM` (#463 AK 8);
   *  `null`: ohne Frist, Eltern melden bis zum Anpfiff. */
  meldefrist: string | null;
  /** Ein verlegtes Spiel: der zuletzt gültige Zeitpunkt (#463 AK 16). */
  vorher: { datum: string; beginn: string } | null;
  /** Die Treffpunkte zum aktuellen Anpfiff, frühester zuerst (#465). */
  treffpunkte: Treffpunkt[];
};

export type TerminZeile = {
  id: string;
  teamId: string;
  /** Training oder Spiel (#459); die Art bleibt. */
  art: TerminArt;
  /** Nur an einem Spiel, sonst `null`. */
  spiel: SpielAngaben | null;
  datum: string;
  /** `HH:MM`; Pflicht an jedem Termin. */
  beginn: string;
  ende: string;
  ort: string | null;
  bemerkung: string | null;
  /** Die Felder des Platzes (#389); `null` = unbekannt. */
  felder: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null` = unbekannt. Führt das Team
   *  eine Spielerliste, geht `spielstand` vor (`spielerzahlVon`, #434). */
  spielerzahl: number | null;
  /** Die Spielerzahl aus der Spielerliste (#434, #435); `null`, wenn die
   *  Liste leer ist bzw. bei Beginn leer war. */
  spielstand: Spielstand;
  /** `null`: Der Termin trägt (noch) kein Training (#322). `terminTraining`:
   *  eine Kopie, die mit dem Termin lebt und beim Lösen gelöscht wird; sonst
   *  ein älteres Training aus dem Bestand (PO 2026-10-06). */
  training: { id: string; name: string; stufen: KategorieSlug[]; terminTraining: boolean } | null;
  /** `null`: ein einzelner Termin ohne Serie. */
  serie: TerminSerie | null;
  /** Der Tag der Serienregel, für den der Termin angelegt wurde. */
  serienTag: string | null;
  /** Leer für einzelne Termine und Serientermine ohne Abweichung. */
  abweichungen: Abweichung[];
  /** Die eingeladenen Trainer:innen (#519), nach Name geordnet, Einträge
   *  gelöschter Konten zuletzt; höchstens eine ist verantwortlich. */
  trainer: TerminTrainer[];
  /** Für wen der Termin gilt (#453 AK 5): leer = für alle; ein Eintrag ohne
   *  Namen ist ein ehemaliger Kader an einem begonnenen Termin (PC 4). */
  kader: TerminKader[];
  /** Der Termin findet nicht statt (#327); ein Training ruht dann an ihm. */
  ausgefallen: boolean;
  /** Freiwilliger Grund des Ausfalls; nur bei `ausgefallen`. */
  ausfallGrund: string | null;
};

type RawTermin = {
  id: string;
  team_id: string;
  art: TerminArt;
  bezeichnung: string | null;
  richtwert_min: number | null;
  richtwert_max: number | null;
  meldefrist_vorlauf_min: number | null;
  vorher_datum: string | null;
  vorher_beginn: string | null;
  spiel_treffpunkte: TreffpunktZeile[];
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  bemerkung: string | null;
  felder: Felder | null;
  erwartete_spielerzahl: number | null;
  spielstand: Spielstand;
  created_at: string;
  serien_tag: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
  eingeladene_abweichend: boolean;
  verantwortung_abweichend: boolean;
  felder_abweichend: boolean;
  spielerzahl_abweichend: boolean;
  kader_abweichend: boolean;
  ausgefallen: boolean;
  ausfall_grund: string | null;
  termin_trainer: {
    id: string;
    user_id: string | null;
    verantwortlich: boolean;
    abgesagt_am: string | null;
    trainer_name: string | null;
    trainer_ehemalig: boolean;
  }[];
  termin_kader: { kader_id: string | null; kader: { name: string } | null }[];
  trainings: { id: string; name: string; stufen: string[] | null; termin_training: boolean } | null;
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
    felder: Felder | null;
    erwartete_spielerzahl: number | null;
    termin_serien_trainer: { user_id: string; verantwortlich: boolean; trainer_name: string | null }[];
    termin_serien_kader: { kader_id: string; kader: { name: string } | null }[];
  } | null;
};

/** Beginn oder Ende auf `HH:MM` kürzen — Postgres liefert `HH:MM:SS`.
 *
 *  Exportiert, weil jede Abfrage, die eine Uhrzeit ausliefert, sie so kürzen
 *  MUSS: das Zeitfeld der Oberfläche und die serverseitige Prüfung akzeptieren
 *  ausschliesslich `HH:MM`. Ein roh durchgereichter Wert wird sonst erst beim
 *  Speichern als «ungültige Uhrzeit» abgewiesen. */
export function kurzeZeit(t: string): string {
  return t.slice(0, 5);
}

const TERMIN_SELECT =
  "id, team_id, art, bezeichnung, richtwert_min, richtwert_max, meldefrist_vorlauf_min, vorher_datum, vorher_beginn, datum, beginn, ende, ort, bemerkung, felder, erwartete_spielerzahl, spielstand, created_at, serien_tag, zeit_abweichend, ort_abweichend, bemerkung_abweichend, eingeladene_abweichend, verantwortung_abweichend, felder_abweichend, spielerzahl_abweichend, kader_abweichend, ausgefallen, ausfall_grund, " +
  "termin_trainer ( id, user_id, verantwortlich, abgesagt_am, trainer_name, trainer_ehemalig ), " +
  "termin_kader ( kader_id, kader ( name ) ), " +
  "spiel_treffpunkte ( anreise, vorlauf_min, ort ), " +
  "trainings ( id, name, stufen, termin_training ), " +
  "termin_serien ( id, version, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung, felder, erwartete_spielerzahl, " +
  "termin_serien_trainer ( user_id, verantwortlich, trainer_name ), termin_serien_kader ( kader_id, kader ( name ) ) )";

/** Nach Anzeigename ordnen, unbenannte (gelöschte Konten) zuletzt. Der Schlüssel
 *  (Eintrags- bzw. Konto-Kennung) macht die Reihenfolge bei gleichem Namen stabil. */
export function nachName<T>(liste: T[], name: (x: T) => string | null, schluessel: (x: T) => string): T[] {
  return [...liste].sort((a, b) => {
    const [x, y] = [name(a), name(b)];
    if (x === null || y === null) {
      if (x !== y) return x === null ? 1 : -1;
    } else {
      const n = x.localeCompare(y, "de");
      if (n !== 0) return n;
    }
    return schluessel(a).localeCompare(schluessel(b));
  });
}

/** Die Eingeladenen eines Termins aus dem Embed — geteilt mit trainings-fuer.ts. */
export function mapTrainer(
  zeilen: readonly {
    id: string;
    user_id: string | null;
    verantwortlich: boolean;
    abgesagt_am: string | null;
    trainer_name: string | null;
    trainer_ehemalig: boolean;
  }[],
): TerminTrainer[] {
  return nachTrainerName(
    zeilen.map((v) => ({
      eintragId: v.id,
      userId: v.user_id,
      name: v.user_id === null ? null : v.trainer_name,
      ehemalig: v.trainer_ehemalig,
      verantwortlich: v.verantwortlich,
      abgesagtAm: v.abgesagt_am,
    })),
    (v) => v.eintragId,
  );
}

function mapTermin(t: RawTermin): TerminZeile {
  return {
    id: t.id,
    teamId: t.team_id,
    art: t.art,
    spiel:
      t.art === "spiel"
        ? {
            bezeichnung: t.bezeichnung ?? "",
            richtwertMin: t.richtwert_min,
            richtwertMax: t.richtwert_max,
            meldefrist:
              t.meldefrist_vorlauf_min === null ? null : meldefristZeitpunkt(t.datum, t.beginn, t.meldefrist_vorlauf_min),
            vorher:
              t.vorher_datum && t.vorher_beginn ? { datum: t.vorher_datum, beginn: kurzeZeit(t.vorher_beginn) } : null,
            treffpunkte: treffpunkteZu(t.spiel_treffpunkte ?? [], t.datum, t.beginn),
          }
        : null,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ende: kurzeZeit(t.ende),
    ort: t.ort,
    bemerkung: t.bemerkung,
    felder: t.felder,
    spielerzahl: t.erwartete_spielerzahl,
    spielstand: t.spielstand ?? null,
    training: t.trainings
      ? {
          id: t.trainings.id,
          name: t.trainings.name,
          stufen: sortStufen(t.trainings.stufen ?? []),
          terminTraining: t.trainings.termin_training,
        }
      : null,
    serie: t.termin_serien
      ? {
          id: t.termin_serien.id,
          version: t.termin_serien.version,
          wochentage: t.termin_serien.wochentage as Wochentag[],
          beginnDatum: t.termin_serien.beginn_datum,
          endDatum: t.termin_serien.end_datum,
          beginn: kurzeZeit(t.termin_serien.beginn),
          ende: kurzeZeit(t.termin_serien.ende),
          ort: t.termin_serien.ort,
          bemerkung: t.termin_serien.bemerkung,
          felder: t.termin_serien.felder,
          spielerzahl: t.termin_serien.erwartete_spielerzahl,
          trainer: nachTrainerName(
            (t.termin_serien.termin_serien_trainer ?? []).map((v) => ({
              userId: v.user_id,
              name: v.trainer_name ?? "",
              verantwortlich: v.verantwortlich,
            })),
            (v) => v.userId,
          ),
          kader: nachKaderName((t.termin_serien.termin_serien_kader ?? []).map((k) => ({ id: k.kader_id, name: k.kader?.name ?? "" }))),
        }
      : null,
    serienTag: t.serien_tag,
    abweichungen: t.termin_serien
      ? ([
          t.serien_tag !== t.datum && "datum",
          t.zeit_abweichend && "zeit",
          t.ort_abweichend && "ort",
          t.bemerkung_abweichend && "bemerkung",
          t.eingeladene_abweichend && "eingeladene",
          t.verantwortung_abweichend && "verantwortung",
          t.felder_abweichend && "felder",
          t.spielerzahl_abweichend && "spielerzahl",
          t.kader_abweichend && "kader",
        ].filter(Boolean) as Abweichung[])
      : [],
    trainer: mapTrainer(t.termin_trainer ?? []),
    kader: nachTerminKader((t.termin_kader ?? []).map((k) => ({ id: k.kader_id, name: k.kader?.name ?? null }))),
    ausgefallen: t.ausgefallen,
    ausfallGrund: t.ausfall_grund,
  };
}

/** Obergrenze je Abschnitt: PostgREST kappt jede Antwort bei `max_rows` (1000,
 *  supabase/config.toml). Eine einzige aufsteigende Abfrage schnitte bei vielen
 *  Terminen die NEUESTEN ab — die anstehenden verschwänden still. Darum zwei
 *  Abfragen, je ab der Grenze «heute» nach aussen; das Limit trifft so nur die
 *  fernste Zukunft bzw. die älteste Vergangenheit. */
const PLAN_OBERGRENZE = 1000;

/** Der Trainingsplan eines Teams: alle Termine chronologisch aufsteigend.
 *
 *  Zwei Abfragen statt einer (siehe `PLAN_OBERGRENZE`): anstehend (Datum ab
 *  `heute`, aufsteigend) und vergangen (Datum vor `heute`, absteigend, die
 *  jüngsten zuerst); die Vergangenheit wird danach umgedreht und vorangestellt.
 *  Das Embed holt Training und Serie im selben Rutsch. Sortiert wird in der DB
 *  nach Datum und Beginn; `created_at` ist
 *  der stabile Tiebreaker, damit zwei gleich eingeplante Termine nicht bei
 *  jedem Laden die Plätze tauschen. `teilePlan` ordnet die Vergangenheit
 *  anschliessend selbst. */
export async function getTeamPlanFuer(
  supabase: SupabaseClient,
  teamId: string,
  o: {
    /** Der Tag der Grenze «anstehend»/«vergangen»; Standard: heute am Trainingsort. */
    heute?: string;
    /** Nur die Termine dieses Kontos: wo es dabei bzw. wozu es eingeladen ist (#518 PO 12). */
    eingrenzung?: { userId: string; art: Eingrenzung };
    /** Nur Termine ab diesem Tag und/oder bis zu diesem Tag, beide eingeschlossen (#329). */
    von?: string;
    bis?: string;
  } = {},
): Promise<TerminZeile[]> {
  const heute = o.heute ?? heuteAmTrainingsort();
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  // Der Guard im Layout greift hier nicht — Layout und Page rendern parallel;
  // die leere Liste verhindert den 500 vor dem Redirect.
  if (!istUuid(teamId)) return [];
  // Der Zeitraum gilt für beide Abfragen; die Grenze «heute» und die
  // Obergrenze je Seite (`PLAN_OBERGRENZE`) bleiben davon unberührt.
  const basis = () => {
    let q = supabase.from("training_termine").select(TERMIN_SELECT).eq("team_id", teamId);
    if (o.von) q = q.gte("datum", o.von);
    if (o.bis) q = q.lte("datum", o.bis);
    return q;
  };
  const [anstehend, vergangen] = await Promise.all([
    basis()
      .gte("datum", heute)
      .order("datum", { ascending: true })
      .order("beginn", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(PLAN_OBERGRENZE),
    basis()
      .lt("datum", heute)
      .order("datum", { ascending: false })
      .order("beginn", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PLAN_OBERGRENZE),
  ]);
  if (anstehend.error) throw anstehend.error;
  if (vergangen.error) throw vergangen.error;

  const kommend = (anstehend.data ?? []) as unknown as RawTermin[];
  const davor = (vergangen.data ?? []) as unknown as RawTermin[];
  if (kommend.length >= PLAN_OBERGRENZE || davor.length >= PLAN_OBERGRENZE) {
    console.warn(`getTeamPlanFuer: Obergrenze von ${PLAN_OBERGRENZE} Terminen erreicht (Team ${teamId}).`);
  }
  // Die Vergangenheit kam absteigend; umgedreht ergibt sie wieder die
  // aufsteigende Reihenfolge inkl. Beginn und created_at.
  const alle = [...davor.reverse(), ...kommend].map(mapTermin);
  const e = o.eingrenzung;
  return e ? alle.filter((t) => imFilter(t.trainer, e.userId, e.art)) : alle;
}

/** «Noch nicht vorbereitet» (Epic PO 7): anstehend, ohne Training und nicht
 *  ausgefallen (#327 AK 8) — ein Spiel nie (#459 AK 15). */
export function nochNichtVorbereitet(t: TerminZeile, heute: string): boolean {
  return t.art === "training" && t.datum >= heute && t.training === null && !t.ausgefallen;
}

/** Ein Trainingsplan, geteilt in Kommendes und Vergangenes (Story 18). */
export type Plan = { kommend: TerminZeile[]; vergangen: TerminZeile[] };

/** Vergangene Einheiten absteigend ordnen: die jüngste zuerst.
 *
 *  Kein blosses Umdrehen der aufsteigenden Liste: Zwei gleich eingeplante
 *  Termine behalten so ihre Reihenfolge nach dem Anlegen. `Array.sort` ist
 *  stabil, und die Liste kommt bereits nach `created_at` geordnet aus der
 *  Datenbank; damit bleibt sie über wiederholte Aufrufe dieselbe. */
function juengsteZuerst(a: TerminZeile, b: TerminZeile): number {
  if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
  if (a.beginn === b.beginn) return 0;
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
 *  Das Kommende behält die Ordnung aus der Datenbank (Datum, dann Beginn). */
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
