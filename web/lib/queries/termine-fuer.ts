import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import type { Wochentag } from "@/lib/serie";
import type { Felder } from "@/lib/termin-felder";
import { sortStufen } from "@/lib/training";
import { heuteAmTrainingsort } from "@/lib/zeit";
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
  /** Felder und erwartete Spielerzahl, die die Serie vorgibt (#391); `null` = unbekannt. */
  felder: Felder | null;
  spielerzahl: number | null;
  /** Wer die Serie vorgibt (#325), nach Name geordnet. */
  verantwortliche: { userId: string; name: string }[];
};

/** Ein Eintrag der Verantwortlichen eines Termins (#325). */
export type Verantwortlicher = {
  eintragId: string;
  /** `null`: ein gelöschtes Konto (#325 PC 8). */
  userId: string | null;
  /** Der aktuelle Anzeigename (AK 12); `null` bei gelöschtem Konto. */
  name: string | null;
  /** Nicht mehr im Team (oder Konto gelöscht). */
  ehemalig: boolean;
};

/** Welche Angaben eines Serientermins von seiner Serie abweichen (#326 AK 12,
 *  14; PO 3). Das Datum weicht ab, wenn der Termin nicht mehr an seinem
 *  Serientag liegt. */
export type Abweichung = "datum" | "zeit" | "ort" | "bemerkung" | "verantwortliche" | "felder" | "spielerzahl";

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
  /** Die Felder des Platzes (#389); `null` = unbekannt. */
  felder: Felder | null;
  /** Die erwartete Spielerzahl (#390); `null` = unbekannt. */
  spielerzahl: number | null;
  /** `null`: Der Termin trägt (noch) kein Training (#322). */
  training: { id: string; name: string; stufen: KategorieSlug[] } | null;
  /** `null`: ein einzelner Termin ohne Serie. */
  serie: TerminSerie | null;
  /** Der Tag der Serienregel, für den der Termin angelegt wurde. */
  serienTag: string | null;
  /** Leer für einzelne Termine und Serientermine ohne Abweichung. */
  abweichungen: Abweichung[];
  /** Wer den Termin vorbereitet und leitet (#325), nach Name geordnet,
   *  Einträge gelöschter Konten zuletzt. */
  verantwortliche: Verantwortlicher[];
  /** Der Termin findet nicht statt (#327); er trägt dann kein Training. */
  ausgefallen: boolean;
  /** Freiwilliger Grund des Ausfalls; nur bei `ausgefallen`. */
  ausfallGrund: string | null;
};

/** Ist dieses Konto für den Termin verantwortlich? (#325 AK 11) */
export function istVerantwortlich(t: TerminZeile, userId: string): boolean {
  return t.verantwortliche.some((v) => v.userId === userId);
}

/** Wie ein Eintrag ohne Namen (gelöschtes Konto, PC 8) überall heisst. */
export const EHEMALIGES_MITGLIED = "Ehemaliges Mitglied";

/** Die Verantwortlichen als Namen zum Anzeigen, in der Reihenfolge des
 *  Lesepfads (AK 10, 12). Einträge gelöschter Konten stehen namenlos als
 *  ehemaliges Mitglied da. */
export function verantwortlichenNamen(liste: readonly Verantwortlicher[]): string[] {
  return liste.map((v) => v.name ?? EHEMALIGES_MITGLIED);
}

/** Die Verantwortlichen zum Anzeigen, aus Sicht des USERS: wer man selbst
 *  ist, steht zuerst und mit «(du)» — so bleibt es auch in einer gekürzten
 *  Zeile sichtbar (#402 AK 10, #403 AK 4). */
export function verantwortlicheMitDir(t: TerminZeile, ich: string): { text: string; selbst: boolean } {
  const eigene = t.verantwortliche.filter((v) => v.userId === ich);
  const andere = t.verantwortliche.filter((v) => v.userId !== ich);
  return {
    text: [...verantwortlichenNamen(eigene).map((n) => `${n} (du)`), ...verantwortlichenNamen(andere)].join(", "),
    selbst: eigene.length > 0,
  };
}

type RawTermin = {
  id: string;
  team_id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  felder: Felder | null;
  erwartete_spielerzahl: number | null;
  created_at: string;
  serien_tag: string | null;
  zeit_abweichend: boolean;
  ort_abweichend: boolean;
  bemerkung_abweichend: boolean;
  verantwortliche_abweichend: boolean;
  felder_abweichend: boolean;
  spielerzahl_abweichend: boolean;
  ausgefallen: boolean;
  ausfall_grund: string | null;
  termin_verantwortliche: {
    id: string;
    user_id: string | null;
    verantwortlich_name: string | null;
    verantwortlich_ehemalig: boolean;
  }[];
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
    felder: Felder | null;
    erwartete_spielerzahl: number | null;
    termin_serien_verantwortliche: { user_id: string; verantwortlich_name: string | null }[];
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
  "id, team_id, datum, beginn, ende, ort, bemerkung, felder, erwartete_spielerzahl, created_at, serien_tag, zeit_abweichend, ort_abweichend, bemerkung_abweichend, verantwortliche_abweichend, felder_abweichend, spielerzahl_abweichend, ausgefallen, ausfall_grund, " +
  "termin_verantwortliche ( id, user_id, verantwortlich_name, verantwortlich_ehemalig ), " +
  "trainings ( id, name, stufen ), " +
  "termin_serien ( id, version, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung, felder, erwartete_spielerzahl, " +
  "termin_serien_verantwortliche ( user_id, verantwortlich_name ) )";

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

function mapTermin(t: RawTermin): TerminZeile {
  return {
    id: t.id,
    teamId: t.team_id,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ende: kurzeZeit(t.ende),
    ort: t.ort,
    bemerkung: t.bemerkung,
    felder: t.felder,
    spielerzahl: t.erwartete_spielerzahl,
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
          felder: t.termin_serien.felder,
          spielerzahl: t.termin_serien.erwartete_spielerzahl,
          verantwortliche: nachName(
            (t.termin_serien.termin_serien_verantwortliche ?? []).map((v) => ({
              userId: v.user_id,
              name: v.verantwortlich_name ?? "",
            })),
            (v) => v.name,
            (v) => v.userId,
          ),
        }
      : null,
    serienTag: t.serien_tag,
    abweichungen: t.termin_serien
      ? ([
          t.serien_tag !== t.datum && "datum",
          t.zeit_abweichend && "zeit",
          t.ort_abweichend && "ort",
          t.bemerkung_abweichend && "bemerkung",
          t.verantwortliche_abweichend && "verantwortliche",
          t.felder_abweichend && "felder",
          t.spielerzahl_abweichend && "spielerzahl",
        ].filter(Boolean) as Abweichung[])
      : [],
    verantwortliche: nachName(
      (t.termin_verantwortliche ?? []).map((v) => ({
        eintragId: v.id,
        userId: v.user_id,
        name: v.user_id === null ? null : v.verantwortlich_name,
        ehemalig: v.verantwortlich_ehemalig,
      })),
      (v) => v.name,
      (v) => v.eintragId,
    ),
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
 *  nach Datum und Beginn (ohne Beginn zuletzt am selben Tag); `created_at` ist
 *  der stabile Tiebreaker, damit zwei gleich eingeplante Termine nicht bei
 *  jedem Laden die Plätze tauschen. `teilePlan` ordnet die Vergangenheit
 *  anschliessend selbst. */
export async function getTeamPlanFuer(
  supabase: SupabaseClient,
  teamId: string,
  o: {
    /** Der Tag der Grenze «anstehend»/«vergangen»; Standard: heute am Trainingsort. */
    heute?: string;
    /** Nur Termine, für die dieses Konto (userId) verantwortlich ist (#325 AK 11). */
    nurMeine?: string;
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
      .order("beginn", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(PLAN_OBERGRENZE),
    basis()
      .lt("datum", heute)
      .order("datum", { ascending: false })
      .order("beginn", { ascending: false, nullsFirst: true })
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
  // aufsteigende Reihenfolge inkl. Beginn-ohne-Zeit-zuletzt und created_at.
  const alle = [...davor.reverse(), ...kommend].map(mapTermin);
  const meine = o.nurMeine;
  return meine ? alle.filter((t) => istVerantwortlich(t, meine)) : alle;
}

/** «Noch nicht vorbereitet» (Epic PO 7): anstehend, ohne Training und nicht
 *  ausgefallen (#327 AK 8). */
export function nochNichtVorbereitet(t: TerminZeile, heute: string): boolean {
  return t.datum >= heute && t.training === null && !t.ausgefallen;
}

/** Was ein Termin trägt (Epic #401): ein Training, noch keines (anstehend),
 *  keines (vergangen) — oder er ist ausgefallen, was allem vorgeht. */
export type TerminZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

export function terminZustand(t: TerminZeile, heute: string): TerminZustand {
  if (t.ausgefallen) return "ausgefallen";
  if (t.training) return "training";
  return nochNichtVorbereitet(t, heute) ? "noch-nicht" : "ohne";
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
