import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { kurzeZeit } from "@/lib/queries/termine";
import {
  LIST_SELECT,
  einzelnerTermin,
  getTrainingPoolFuer,
  ladeTrainingDetail,
  mapListRow,
  type RawListTraining,
  type TrainingDetail,
  type TrainingListFilters,
  type TrainingListRow,
} from "@/lib/queries/trainings-fuer";

/**
 * Query-Layer für Trainings — der EINZIGE Datenpfad zu `trainings`
 * und `training_exercises`. RLS filtert serverseitig: ein öffentliches Training darf
 * jeder lesen, ein privates nur sein Eigentümer (Story #9 AC12).
 *
 * Seit dem Fassungs-Modell (Epic #72) trägt die Zuordnung ihre Übungsinhalte
 * selbst. Sie hängt damit an genau einer RLS-Kette — die frühere Situation, dass
 * eine Übung im lesbaren Training unsichtbar sein konnte, gibt es nicht mehr.
 *
 * Diese Datei hält die Cookie-Wrapper. Abfrage, Mapping und Typen stehen in
 * trainings-fuer.ts (Epic #190), damit der Fachkern sie mit einem beliebigen
 * Nutzer-Client aufrufen kann.
 */

export {
  einzelnerTermin,
  type TrainingDetail,
  type TrainingExerciseItem,
  type TrainingListFilters,
  type TrainingListRow,
} from "@/lib/queries/trainings-fuer";

/** Training für den Editor: das eigene Training oder eines des eigenen Teams
 *  (Team-Epic Story 6). `null`, wenn es das Training nicht gibt oder der USER
 *  es nicht bearbeiten darf.
 *
 *  Der öffentliche Zustand schliesst das Bearbeiten NICHT aus: Veröffentlichen
 *  ist ein Zustand, kein Einfrieren (Story A). Was ein öffentliches Training
 *  dabei nicht verlieren darf, setzt die Datenebene durch.
 *
 *  Die SELECT-Policy lässt Team-Trainings nur bei Mitgliedern durch; der Filter
 *  in `ladeTrainingDetail` grenzt die fremden öffentlichen Trainings aus, die
 *  jeder lesen darf. */
export async function getTrainingForEdit(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ladeTrainingDetail(supabase, id, user.id);
}

/** Training zum Ansehen (Story #7/#9/#10) — RLS gibt öffentliche Trainings jedem und
 *  private nur dem Eigentümer frei. `null` ⇒ „nicht verfügbar" (privat-fremd,
 *  nicht existent — ununterscheidbar, Story #7 Postcondition 2). */
export async function getTrainingView(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  return ladeTrainingDetail(supabase, id);
}

/** Wo ein Training zu Hause ist — mehr braucht weder die Hauptnavigation noch
 *  der Rückweg über die Brotkrumen (#156). `TrainingDetail` erfüllt dieselbe
 *  Form, sodass eine Seite, die das Training ohnehin geladen hat, es direkt
 *  weiterreichen kann. */
export type TrainingNavKontext = {
  id: string;
  name: string;
  team: { id: string; name: string } | null;
  terminDatum: string | null;
};

/** Diesen Kontext braucht die Hauptnavigation im Root-Layout, um bei einem
 *  Team-Training „Teams" statt „Trainings" hervorzuheben. Die Abfrage ist
 *  bewusst schmal: die Navigation lädt kein ganzes Training.
 *
 *  RLS entscheidet wie überall. Wer dem Team nicht angehört, bekommt `null` —
 *  weder Teamname noch Termindatum verlassen so den Server (PC 4).
 *
 *  `cache()` bindet das Ergebnis an den laufenden Request. Beim harten Laden
 *  einer Trainingsseite fragen zwei Stellen dasselbe: die Navigation im
 *  Root-Layout und das Layout unter `/training/[id]`, das den Team-Kontext für
 *  spätere Client-Navigationen meldet. Die Datenbank sieht davon eine
 *  Abfrage. */
export const getTrainingNavKontext = cache(
  async (id: string): Promise<TrainingNavKontext | null> => {
    // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("trainings")
      .select("id, name, team_id, teams ( name ), training_termine ( datum )")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const raw = data as unknown as {
      id: string;
      name: string;
      team_id: string | null;
      teams: { name: string } | null;
      training_termine: { datum: string } | { datum: string }[] | null;
    };
    return {
      id: raw.id,
      name: raw.name,
      team: raw.team_id && raw.teams ? { id: raw.team_id, name: raw.teams.name } : null,
      terminDatum: einzelnerTermin(raw.training_termine)?.datum ?? null,
    };
  },
);

/** Trainings-Übersicht mit der Anmeldung aus den Cookies — Regeln, Filter und
 *  Sortierung in `getTrainingPoolFuer`. */
export async function getTrainingPool(
  f: TrainingListFilters = {},
): Promise<TrainingListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return getTrainingPoolFuer(supabase, user?.id ?? null, f);
}

// ── Team-Trainings (Team-Epic Story 5) ───────────────────────────────────────

/** Ein Team-Training im Bestand des Teams. Wie eine Pool-Zeile, zusätzlich mit
 *  dem Termin, falls es angesetzt ist. */
export type TeamTrainingRow = TrainingListRow & {
  /** Der Termin dieses Trainings, falls es angesetzt ist. Höchstens einer je
   *  Training — eine weitere Einheit entsteht als Kopie (Story 8). Beginn, Ort
   *  und Bemerkung dienen als Vorbelegung beim erneuten Ansetzen, damit der
   *  Weg aus dem Bestand derselbe ist wie aus dem Plan (Story 16 AK 3). */
  termin: {
    id: string;
    /** Der Tag der Einheit als `YYYY-MM-DD`. Er unterscheidet angesetzte
     *  Einheiten desselben Trainings im Bestand voneinander (#156 AK 7). */
    datum: string;
    beginn: string | null;
    ort: string | null;
    bemerkung: string | null;
  } | null;
};

const TEAM_LIST_SELECT = `${LIST_SELECT}, training_termine ( id, datum, beginn, ort, bemerkung )`;

/** Der Trainingsbestand eines Teams. Team-Trainings erscheinen NIE im
 *  Trainings-Pool — sie gehören dem Team, nicht der Öffentlichkeit und keiner
 *  Person. Sichtbar sind sie nur Mitgliedern; das setzt die RLS durch. */
export async function getTeamTrainings(teamId: string): Promise<TeamTrainingRow[]> {
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  // Der Guard im Layout greift hier nicht — Layout und Page rendern parallel;
  // die leere Liste verhindert den 500 vor dem Redirect.
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainings")
    .select(TEAM_LIST_SELECT)
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false })
    .order("id");
  if (error) throw error;

  return (data ?? []).map((raw) => {
    // Bewusst eigener Name: `RawTermin` in queries/termine.ts bezeichnet die
    // vollständige Termin-Zeile, hier stehen nur die Felder der Vorbelegung.
    type RawTerminVorbelegung = {
      id: string;
      datum: string;
      beginn: string | null;
      ort: string | null;
      bemerkung: string | null;
    };
    const r = raw as unknown as RawListTraining & {
      training_termine: RawTerminVorbelegung | RawTerminVorbelegung[] | null;
    };
    const termin = einzelnerTermin(r.training_termine);
    return {
      ...mapListRow(r),
      termin: termin
        ? {
            id: termin.id,
            datum: termin.datum,
            beginn: kurzeZeit(termin.beginn),
            ort: termin.ort,
            bemerkung: termin.bemerkung,
          }
        : null,
    };
  });
}
