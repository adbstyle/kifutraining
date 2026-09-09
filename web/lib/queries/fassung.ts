import { createClient } from "@/lib/supabase/server";
import type { Fahrplan } from "@/lib/queries/exercises";
import { FASSUNG_INHALT_FELDER } from "@/lib/fassung";
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { alsAltersstufe, type Altersstufe } from "@/lib/altersstufe";

/** Eine Fassung zum Bearbeiten — im eigenen privaten Training oder in einem
 *  Training des eigenen Teams (Team-Epic Story 6). `null`, wenn sie nicht
 *  existiert oder der USER sie nicht bearbeiten darf. */
export type FassungZumBearbeiten = {
  id: string;
  trainingId: string;
  trainingName: string;
  /** Das Team, dem das Training gehört; `null` bei einem persönlichen
   *  Training. Trägt den Team-Kontext in die Brotkrumen (#156). */
  trainingTeam: { id: string; name: string } | null;
  /** Datum des Termins, falls das Training angesetzt ist; sonst `null`. */
  trainingTerminDatum: string | null;
  /** Altersstufe des Trainings. Die Fassung folgt ihr; sie entscheidet über
   *  Alterskategorien, Erscheinungsformen und Ablaufform (Story 1,
   *  Übungswelten). */
  trainingAltersstufe: Altersstufe;
  name: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  uebungstyp: string | null;
  kategorien: string[];
  erscheinungsform: string[];
  feldtyp: string | null;
  /** Spielfeldgrösse in Metern — nur im Juniorenfussball, nur paarweise
   *  belegt (Story 3, Übungswelten). */
  spielfeldLaengeM: number | null;
  spielfeldBreiteM: number | null;
  anzahlKinder: { min?: number | null; max?: number | null } | null;
  material: string[];
  fahrplan: Fahrplan | null;
  aufbau: string | null;
  varianten: string[];
  bildUrl: string | null;
  bildQuelle: "foto" | "diagramm" | null;
  diagramm: unknown;
};

export async function getFassungZumBearbeiten(
  fassungId: string,
): Promise<FassungZumBearbeiten | null> {
  // Ungültige UUID würde die Query mit Fehler abbrechen; defensiv abfangen.
  if (!/^[0-9a-f-]{36}$/i.test(fassungId)) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Aus der Kopier-Konstante abgeleitet — dieselbe Feldmenge wie überall sonst.
  const INHALT = [...FASSUNG_INHALT_FELDER, "bild_url", "diagramm"].join(", ");

  // Als `string` (nicht Literal) übergeben: der interpolierte Feldanteil ist
  // zur Compile-Zeit unbekannt, der typisierte Query-Parser kann ihn nicht
  // auswerten — gemappt wird unten ohnehin explizit.
  const select: string = `id, training_id, trainingsteil, hauptteilkategorie, ${INHALT},
       trainings!inner ( id, name, owner_id, team_id, altersstufe,
         teams ( name ), training_termine ( datum ) )`;
  const { data: roh, error } = await supabase
    .from("training_exercises")
    .select(select)
    .eq("id", fassungId)
    .maybeSingle();
  if (error) throw error;
  if (!roh) return null;

  // Der Query-Parser kennt die Feldliste nicht (siehe oben) — die Form der
  // Antwort ist durch das Select bestimmt und wird hier einmal benannt.
  type RohInhalt = {
    name: string;
    kategorien: string[] | null;
    erscheinungsform: string[] | null;
    feldtyp: string | null;
    spielfeld_laenge_m: number | null;
    spielfeld_breite_m: number | null;
    anzahl_kinder: { min?: number | null; max?: number | null } | null;
    material: string[] | null;
    methodischer_fahrplan: Fahrplan | null;
    aufbau: string | null;
    varianten: string[] | null;
    bild_url: string | null;
    bild_quelle: "foto" | "diagramm" | null;
    diagramm: unknown;
  };
  const data = roh as unknown as RohInhalt & {
    id: string;
    training_id: string;
    trainingsteil: string;
    hauptteilkategorie: string | null;
    uebungstyp: string | null;
    trainings: {
      altersstufe?: string | null;
      id: string;
      name: string;
      owner_id: string | null;
      team_id: string | null;
      teams: { name: string } | null;
      // `training_termine.training_id` ist UNIQUE — PostgREST liefert deshalb
      // ein Objekt statt einer Liste. Beide Formen abfangen (siehe
      // `einzelnerTermin` in queries/trainings.ts).
      training_termine: { datum: string } | { datum: string }[] | null;
    };
  };

  const training = data.trainings;
  // Dieselbe Regel wie im Editor und in den Fassungs-Actions — eine Quelle.
  if (!bearbeitungszielVon(training, user.id)) return null;

  const q: RohInhalt = data;
  const termin = Array.isArray(training.training_termine)
    ? (training.training_termine[0] ?? null)
    : training.training_termine;

  return {
    id: data.id,
    trainingId: data.training_id,
    trainingName: training.name,
    trainingTeam:
      training.team_id && training.teams
        ? { id: training.team_id, name: training.teams.name }
        : null,
    trainingTerminDatum: termin?.datum ?? null,
    // Der Rückfall ist bloss der Typ-Guard: die Spalte ist NOT NULL.
    trainingAltersstufe: alsAltersstufe(training.altersstufe),
    name: q.name,
    trainingsteil: data.trainingsteil,
    hauptteilkategorie: data.hauptteilkategorie,
    uebungstyp: data.uebungstyp,
    kategorien: q.kategorien ?? [],
    erscheinungsform: q.erscheinungsform ?? [],
    feldtyp: q.feldtyp,
    spielfeldLaengeM: q.spielfeld_laenge_m,
    spielfeldBreiteM: q.spielfeld_breite_m,
    anzahlKinder: q.anzahl_kinder,
    material: q.material ?? [],
    fahrplan: q.methodischer_fahrplan,
    aufbau: q.aufbau,
    varianten: q.varianten ?? [],
    bildUrl: q.bild_url,
    bildQuelle: q.bild_quelle,
    diagramm: q.diagramm,
  };
}
