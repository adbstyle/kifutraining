import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { likePattern } from "@/lib/search";
import { TRAININGSTEIL_SLUGS, sortStufen, teilTraegtDauer, hkatRank } from "@/lib/training";
import type { Fahrplan } from "@/lib/queries/exercises";
import type { KategorieSlug, TrainingsteilSlug } from "@/lib/vocab";
import { JUNIOREN_BLOCK_SLUGS, type Einordnung } from "@/lib/junioren";
import type { Altersstufe } from "@/lib/altersstufe";
import { FASSUNG_INHALT_FELDER, FASSUNG_ZUORDNUNG_FELDER } from "@/lib/fassung";
import { kurzeZeit } from "@/lib/queries/termine";
import type { Variante } from "@/lib/varianten";

/**
 * Query-Layer für Trainings — der EINZIGE Datenpfad zu `trainings`
 * und `training_exercises`. RLS filtert serverseitig: ein öffentliches Training darf
 * jeder lesen, ein privates nur sein Eigentümer (Story #9 AC12).
 *
 * Seit dem Fassungs-Modell (Epic #72) trägt die Zuordnung ihre Übungsinhalte
 * selbst. Sie hängt damit an genau einer RLS-Kette — die frühere Situation, dass
 * eine Übung im lesbaren Training unsichtbar sein konnte, gibt es nicht mehr.
 */

export type TrainingExerciseItem = {
  /** training_exercises.id (die Zuordnung, also die Fassung selbst). */
  id: string;
  /** Wo die Fassung im Training liegt: ein Kinderfussball-Trainingsteil oder
   *  ein Junioren-Unterblock (Epic #71). */
  trainingsteil: Einordnung;
  /** Nur Hauptteil-Fassungen tragen eine Kategorie. */
  hauptteilkategorie: string | null;
  /** Die Variante des Hauptteils, in der diese Fassung steht (#201); `null`
   *  ausserhalb des Hauptteils — dort gilt sie für alle Varianten gemeinsam.
   *  SQL-Zwilling: CHECK `te_variante_genau_bei_hauptteil`. */
  varianteId: string | null;
  position: number;
  durationMin: number | null;
  /** Freier Text zu dieser Übung in DIESEM Training (#152); `null` ohne Notiz.
   *  Sie gehört der Zuordnung, nicht der Übung — in die Bibliothek gelangt sie
   *  nie. */
  notiz: string | null;
  name: string;
  kategorien: string[];
  erscheinungsform: string[];
  feldtyp: string | null;
  /** Spielfeldgrösse in Metern — das Junioren-Gegenstück zum Feldtyp. Immer
   *  paarweise belegt oder beide `null` (CHECK `te_spielfeld_paarweise`). */
  spielfeldLaengeM: number | null;
  spielfeldBreiteM: number | null;
  /** Übungstyp nach dem Manual Fussball Jugendliche (Story 9). */
  uebungstyp: string | null;
  anzahlKinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  fahrplan: Fahrplan | null;
  aufbau: string | null;
  bildUrl: string | null;
  bildQuelle: "foto" | "diagramm" | null;
  diagramm: unknown;
  /** Die Gruppen, die diese Übung durchlaufen, in WECHSELREIHENFOLGE
   *  (Story #150). Leer heisst «alle gemeinsam» — und ausserhalb des
   *  Hauptteils immer leer. */
  gruppen: { id: string; name: string }[];
};

export type TrainingDetail = {
  id: string;
  name: string;
  ownerId: string | null;
  visibility: "public" | "private";
  /** Nach welchem Lehrmittel das Training geführt wird. Steht ab dem Anlegen
   *  fest (Story 1, Übungswelten). */
  altersstufe: Altersstufe;
  stufen: KategorieSlug[];
  /** Optionales Freitext-Ziel des Trainings; `null` = keins (Story 10). */
  ziel: string | null;
  /** Gehört das Training einem Team? Dann steht hier dessen Name (Story 6). */
  team: { id: string; name: string } | null;
  /** Datum des Termins, falls das Training angesetzt ist (`YYYY-MM-DD`);
   *  sonst `null`. Höchstens einer je Training — ein erneutes Ansetzen legt
   *  eine eigene Kopie an. Die RLS gibt Termine nur Team-Mitgliedern (#156). */
  terminDatum: string | null;
  /** Anzeigename des Urhebers; `null` bei anonymisierten Trainings (Story 15). */
  urheber: string | null;
  createdAt: string;
  updatedAt: string;
  /** Flach, sortiert nach fester Trainingsteil-Reihenfolge, dann Position. */
  exercises: TrainingExerciseItem[];
  /** Die Gruppen, auf die der Hauptteil verteilt wird (Story #149), in
   *  Anlegereihenfolge. Leer, solange das Training keine führt. */
  gruppen: { id: string; name: string }[];
  /** Die Varianten des Hauptteils (#201), in der vom Trainer gesetzten
   *  Reihenfolge. Nie leer — jedes Training führt mindestens eine (Trigger
   *  `trainings_erste_variante`). Bei genau einer zeigt die Oberfläche keine
   *  Variantenwahl. */
  varianten: Variante[];
};

/** Die Inhaltsfelder der Fassung — aus der Kopier-Konstante abgeleitet, damit
 *  ein neues Übungsfeld nicht kopiert, aber hier vergessen werden kann (es
 *  verschwände dann still aus der Anzeige). */
const INHALT_FELDER = [...FASSUNG_INHALT_FELDER, "bild_url", "diagramm"].join(", ");

/** Die Felder der Zuordnung — ebenfalls aus der Kopier-Konstante, aus demselben
 *  Grund: Wo die Fassung im Training steht, in welcher Variante, was sie dauert
 *  und was für dieses Training an ihr vermerkt ist, soll nicht an einer von
 *  zwei Listen hängen. */
const ZUORDNUNG_FELDER = FASSUNG_ZUORDNUNG_FELDER.join(", ");

const PE_SELECT = `
  id, ${ZUORDNUNG_FELDER},
  training_exercise_gruppen ( gruppe_id, position ),
  ${INHALT_FELDER}
`;

const TRAINING_SELECT = `id, name, owner_id, visibility, altersstufe, stufen, ziel, team_id, teams ( name ), urheber, created_at, updated_at, training_termine ( datum ), training_exercises ( ${PE_SELECT} ), training_gruppen ( id, name, created_at ), training_varianten ( id, name, position )`;

/** Die Inhaltsfelder, wie sie aus der Zuordnung zurückkommen. */
type RawInhalt = {
  name: string;
  kategorien: string[] | null;
  erscheinungsform: string[] | null;
  feldtyp: string | null;
  spielfeld_laenge_m: number | null;
  spielfeld_breite_m: number | null;
  uebungstyp: string | null;
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  material: string[] | null;
  methodischer_fahrplan: Fahrplan | null;
  aufbau: string | null;
  bild_url: string | null;
  bild_quelle: "foto" | "diagramm" | null;
  diagramm: unknown;
};

type RawTrainingExercise = RawInhalt & {
  id: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  variante_id: string | null;
  position: number;
  duration_min: number | null;
  notiz: string | null;
  training_exercise_gruppen: { gruppe_id: string; position: number }[];
};
type RawTraining = {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "public" | "private";
  altersstufe: Altersstufe;
  stufen: string[];
  ziel: string | null;
  team_id: string | null;
  urheber: string | null;
  created_at: string;
  updated_at: string;
  training_exercises: RawTrainingExercise[];
  training_gruppen: { id: string; name: string; created_at: string }[];
  training_varianten: { id: string; name: string; position: number }[];
  teams: { name: string } | null;
  /** PostgREST erkennt die UNIQUE-Bedingung auf `training_id` und liefert den
   *  Termin als EIN Objekt statt als Liste. Beide Formen abfangen: eine
   *  spätere Schema-Änderung soll hier keinen stillen Nulltreffer erzeugen. */
  training_termine: { datum: string } | { datum: string }[] | null;
};

/** Sortier-Reihenfolge aller Einordnungen: erst die vier Kinderfussball-Teile,
 *  dann die sieben Junioren-Blöcke. Ein Training führt immer nur EIN Schema —
 *  die gemeinsame Liste hält die Sortierung trotzdem stabil, statt fremde Werte
 *  stillschweigend ans Ende zu kippen.
 *
 *  Beide Reihenfolgen stammen aus dem Vokabular, und in beiden steht das
 *  Auffangen zuoberst — dadurch sortiert es vor dem Einstieg (Story #128 AC 1)
 *  bzw. vor der Einleitung, ohne dass hier etwas eigens geregelt werden müsste. */
const EINORDNUNG_RANG: string[] = [...TRAININGSTEIL_SLUGS, ...JUNIOREN_BLOCK_SLUGS];

const teilRank = (t: string) => {
  const i = EINORDNUNG_RANG.indexOf(t);
  return i === -1 ? EINORDNUNG_RANG.length : i;
};

/** Der eine Termin eines Trainings aus einem PostgREST-Embed.
 *
 *  `training_termine.training_id` ist UNIQUE, deshalb liefert PostgREST den
 *  Termin als Objekt statt als Liste. Beide Formen werden abgefangen, damit
 *  eine spätere Schema-Änderung hier keinen stillen Nulltreffer erzeugt. */
export function einzelnerTermin<T>(embed: T | T[] | null | undefined): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

function mapTraining(raw: RawTraining): TrainingDetail {
  // Anzeigereihenfolge ist die Anlegereihenfolge; die ID entscheidet
  // zeitgleiche Anlagen, damit die Liste zwischen zwei Abfragen nicht springt.
  const gruppen = (raw.training_gruppen ?? [])
    .slice()
    .sort((a, b) =>
      a.created_at === b.created_at
        ? a.id.localeCompare(b.id)
        : a.created_at.localeCompare(b.created_at),
    )
    .map((g) => ({ id: g.id, name: g.name }));

  // PostgREST garantiert für einen Embed KEINE Reihenfolge — die Ordnung der
  // Varianten ist aber fachlich (#202: umsortieren) und entscheidet, welche
  // beim Öffnen gilt (#201 AK 7). Darum hier sortiert, nicht in der Abfrage.
  // Die ID entscheidet den Gleichstand, den `tv_position_je_training`
  // ausschliesst — sie hält die Liste stabil, falls er doch einmal auftritt.
  const varianten: Variante[] = (raw.training_varianten ?? [])
    .slice()
    .sort((a, b) => (a.position === b.position ? a.id.localeCompare(b.id) : a.position - b.position))
    .map((v) => ({ id: v.id, name: v.name }));

  // Die Zuweisung trägt nur die Gruppen-ID; der Name steht am Training. Er
  // wird hier aufgelöst, damit die Anzeige nicht in jeder Zeile nachschlagen
  // muss — und damit eine Zuweisung ohne passende Gruppe gar nicht erst
  // durchkommt (die Datenbank schliesst sie aus, `teg_guard`).
  const nachId = new Map(gruppen.map((g) => [g.id, g]));

  const exercises: TrainingExerciseItem[] = (raw.training_exercises ?? [])
    .map((te) => {
      return {
        id: te.id,
        trainingsteil: te.trainingsteil as Einordnung,
        hauptteilkategorie: te.hauptteilkategorie,
        varianteId: te.variante_id,
        position: te.position,
        durationMin: te.duration_min,
        notiz: te.notiz,
        name: te.name,
        kategorien: te.kategorien ?? [],
        erscheinungsform: te.erscheinungsform ?? [],
        feldtyp: te.feldtyp,
        spielfeldLaengeM: te.spielfeld_laenge_m,
        spielfeldBreiteM: te.spielfeld_breite_m,
        uebungstyp: te.uebungstyp,
        anzahlKinder: te.anzahl_kinder,
        material: te.material ?? [],
        fahrplan: te.methodischer_fahrplan,
        aufbau: te.aufbau,
        bildUrl: te.bild_url,
        bildQuelle: te.bild_quelle,
        diagramm: te.diagramm,
        gruppen: (te.training_exercise_gruppen ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((z) => nachId.get(z.gruppe_id))
          .filter((g): g is { id: string; name: string } => g != null),
      };
    })
    // Sortierung: Trainingsteil-Reihenfolge, im Hauptteil zusätzlich nach
    // Unterkategorie (Positionen sind dort pro Unterkategorie eindeutig), dann
    // Position.
    .sort((a, b) => {
      if (a.trainingsteil !== b.trainingsteil)
        return teilRank(a.trainingsteil) - teilRank(b.trainingsteil);
      const hk = hkatRank(a.hauptteilkategorie) - hkatRank(b.hauptteilkategorie);
      return hk !== 0 ? hk : a.position - b.position;
    });

  return {
    id: raw.id,
    name: raw.name,
    ownerId: raw.owner_id,
    visibility: raw.visibility,
    altersstufe: raw.altersstufe,
    stufen: sortStufen(raw.stufen ?? []),
    ziel: raw.ziel,
    team: raw.team_id && raw.teams ? { id: raw.team_id, name: raw.teams.name } : null,
    terminDatum: einzelnerTermin(raw.training_termine)?.datum ?? null,
    urheber: raw.urheber ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    exercises,
    gruppen,
    varianten,
  };
}

/** Training für den Editor: das eigene Training oder eines des eigenen Teams
 *  (Team-Epic Story 6). `null`, wenn es das Training nicht gibt oder der USER
 *  es nicht bearbeiten darf.
 *
 *  Der öffentliche Zustand schliesst das Bearbeiten NICHT aus: Veröffentlichen
 *  ist ein Zustand, kein Einfrieren (Story A). Was ein öffentliches Training
 *  dabei nicht verlieren darf, setzt die Datenebene durch.
 *
 *  Die SELECT-Policy lässt Team-Trainings nur bei Mitgliedern durch; der Filter
 *  hier grenzt die fremden öffentlichen Trainings aus, die jeder lesen darf. */
export async function getTrainingForEdit(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select(TRAINING_SELECT)
    .eq("id", id)
    .or(`owner_id.eq.${user.id},team_id.not.is.null`)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTraining(data as unknown as RawTraining) : null;
}

/** Training zum Ansehen (Story #7/#9/#10) — RLS gibt öffentliche Trainings jedem und
 *  private nur dem Eigentümer frei. `null` ⇒ „nicht verfügbar" (privat-fremd,
 *  nicht existent — ununterscheidbar, Story #7 Postcondition 2). */
export async function getTrainingView(id: string): Promise<TrainingDetail | null> {
  const supabase = await createClient();
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select(TRAINING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTraining(data as unknown as RawTraining) : null;
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

// ── Übersichten (eigene Trainings / Trainings-Pool) ───────────────────────────────────

export type TrainingListFilters = {
  q?: string;
  stufen?: string[]; // Überlappung
  /** Facette: die Übersicht auf die eigenen Trainings eingrenzen. */
  mine?: boolean;
};

export type TrainingListRow = {
  id: string;
  name: string;
  visibility: "public" | "private";
  /** Gehört das Training dem aktuellen USER? Entscheidet über Kennzeichnung und
   *  Ziel des Eintrags in der Übersicht (Story B AK 3–5); `false` für Besucher
   *  ohne Konto. */
  istEigen: boolean;
  /** Nach welchem Lehrmittel das Training geführt wird (Story 1,
   *  Übungswelten). */
  altersstufe: Altersstufe;
  stufen: KategorieSlug[];
  updatedAt: string;
  exerciseCount: number;
  /** Summe der erfassten Dauern (Übungen ohne Dauer zählen nicht). */
  totalDuration: number;
  /** Trägt mindestens eine Zuordnung eine erfasste Dauer? */
  hasAnyDuration: boolean;
  /** Wie viele Varianten des Hauptteils das Training führt (#206). Mindestens
   *  1 — jedes Training führt eine. Ab 2 trägt die Kachel einen Hinweis; die
   *  Kennzahlen daneben beziehen sich dann auf die erste. */
  variantenZahl: number;
  /** Anzeigename des Urhebers; `null` bei anonymisierten Trainings (Story 15). */
  urheber: string | null;
};

type RawListTraining = {
  id: string;
  name: string;
  visibility: "public" | "private";
  altersstufe: Altersstufe;
  stufen: string[];
  updated_at: string;
  owner_id: string | null;
  urheber: string | null;
  training_exercises: {
    trainingsteil: string;
    duration_min: number | null;
    variante_id: string | null;
  }[];
  training_varianten: { id: string; position: number }[];
};

// `urheber` ist ein berechnetes PostgREST-Feld (SQL-Funktion über trainings) —
// es liefert den Anzeigenamen, nie die E-Mail-Adresse.
const LIST_SELECT =
  "id, name, visibility, altersstufe, stufen, updated_at, owner_id, urheber, training_exercises ( trainingsteil, duration_min, variante_id ), training_varianten ( id, position )";

function mapListRow(raw: RawListTraining, userId?: string): TrainingListRow {
  const alle = raw.training_exercises ?? [];

  // Kennzahlen aus der ERSTEN Variante (#206 AK 2): Ein Training mit zwei
  // Hauptteilen spielt nur einen davon — die Summe über beide wäre eine Zahl,
  // die kein Training je dauert.
  const varianten = (raw.training_varianten ?? [])
    .slice()
    .sort((a, b) => (a.position === b.position ? a.id.localeCompare(b.id) : a.position - b.position));
  // Fällt der Embed leer aus (eine Sicht, die ihn nicht mitliest), zählen alle
  // Fassungen: «0 Übungen» wäre eine falsche Auskunft, «etwas zu viel» eine
  // ungenaue. Die Variantenzahl bleibt aus demselben Grund mindestens 1 —
  // jedes Training führt eine.
  const erste = varianten[0]?.id;
  const rows = erste
    ? alle.filter((p) => p.variante_id === null || p.variante_id === erste)
    : alle;

  // Auffangen trägt keine Dauer und zählt nicht zur Summe.
  const withDuration = rows
    .filter((p) => teilTraegtDauer(p.trainingsteil as TrainingsteilSlug))
    .map((p) => p.duration_min)
    .filter((d): d is number => d != null);
  return {
    id: raw.id,
    name: raw.name,
    visibility: raw.visibility,
    istEigen: !!userId && raw.owner_id === userId,
    altersstufe: raw.altersstufe,
    stufen: sortStufen(raw.stufen ?? []),
    updatedAt: raw.updated_at,
    exerciseCount: rows.length,
    totalDuration: withDuration.reduce((a, d) => a + d, 0),
    hasAnyDuration: withDuration.length > 0,
    variantenZahl: Math.max(1, varianten.length),
    urheber: raw.urheber ?? null,
  };
}

/** Trainings-Übersicht — der Einstieg, genau wie der Übungsbestand aufgebaut.
 *
 *  Standardmässig alles, was der USER sehen darf: die öffentlichen Trainings der
 *  Community UND seine eigenen, Entwürfe eingeschlossen (Story B AK 1). Welche
 *  Zeilen das sind, entscheidet die RLS — deshalb steht hier KEIN
 *  Sichtbarkeitsfilter. Besucher ohne Konto bekommen dadurch von selbst nur die
 *  öffentlichen (AK 6). Die Facette `mine` grenzt auf die eigenen ein (AK 2).
 *
 *  Team-Trainings erscheinen in keiner der beiden Sichten: sie gehören dem Team
 *  und leben im Team-Bereich (AK 8). Sie müssen AUSDRÜCKLICH ausgeschlossen
 *  werden — die RLS lässt sie für Mitglieder durch, und ohne
 *  Sichtbarkeitsfilter fiele dieser Ausschluss sonst weg.
 *
 *  Ohne Suche nach Aktualität; mit Suche nach Namens-Relevanz (kürzerer Name
 *  ⇒ näher am Begriff) sortiert. */
export async function getTrainingPool(
  f: TrainingListFilters = {},
): Promise<TrainingListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("trainings").select(LIST_SELECT).is("team_id", null);

  if (f.mine) {
    // Anonym gibt es keine eigenen Trainings; die Facette bleibt dann leer,
    // statt still auf den ganzen Bestand zurückzufallen.
    if (!user) return [];
    query = query.eq("owner_id", user.id);
  }
  if (f.stufen?.length) query = query.overlaps("stufen", f.stufen);

  const hasQuery = !!f.q?.trim();
  if (hasQuery) {
    query = query.ilike("search_text", likePattern(f.q!));
  } else {
    query = query.order("updated_at", { ascending: false }).order("id");
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r) =>
    mapListRow(r as unknown as RawListTraining, user?.id),
  );

  // Relevanz-Sortierung bei aktiver Suche: kürzerer Treffer zuerst, dann Name.
  if (hasQuery) {
    rows.sort(
      (a, b) =>
        a.name.length - b.name.length || a.name.localeCompare(b.name, "de"),
    );
  }
  return rows;
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
