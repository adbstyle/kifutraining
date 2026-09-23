import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { istAltersstufe, type Altersstufe } from "@/lib/altersstufe";
import {
  bearbeitungszielVon,
  type Bearbeitungsziel,
  type TrainingsEigentum,
} from "@/lib/training-zugriff";
import {
  FREMDES_TRAINING,
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

/**
 * Laden mit Rechte-Einordnung (Epic #190, Blueprint 12 §7).
 *
 * Die RLS entscheidet, was sichtbar ist; `bearbeitungszielVon` entscheidet,
 * was davon bearbeitbar ist. Daraus folgen genau drei Ausgänge:
 *
 * - keine Zeile → `nicht_gefunden`. Die Kennung existiert nicht, wurde
 *   gelöscht, gehört jemand anderem privat oder einem Team ohne
 *   Mitgliedschaft — bewusst ununterscheidbar, damit sich fremde Kennungen
 *   nicht durchprobieren lassen (#193 OoS 7).
 * - Zeile, aber kein Bearbeitungsziel → `keine_rechte`. Das kann nur ein
 *   fremdes öffentliches Training sein (oder ein anonymisiertes); seine
 *   Existenz ist ohnehin öffentlich (PO 2026-09-23).
 * - sonst das Bearbeitungsziel samt der geladenen Zeile.
 *
 * Die Oberfläche bildet `keine_rechte` weiter auf «Training nicht gefunden.»
 * ab — nur der KI-Weg meldet es eigens.
 */

/** Was jede Trainingszeile zum Einordnen trägt. */
const GRUNDSPALTEN = "id, owner_id, team_id, altersstufe, visibility";

export type TrainingKopfZeile = TrainingsEigentum & {
  id: string;
  altersstufe: Altersstufe;
  visibility: string;
};

/** Ein Training lesen, soweit die RLS es zeigt — ohne Rechte-Einordnung.
 *  Kennungs-Guard, «nicht gefunden» und die Altersstufe als geprüfter Wert:
 *  was jeder Lese- und Schreibweg des Kerns zuerst braucht. */
export async function ladeTrainingZumLesen<Z extends object = object>(
  supabase: SupabaseClient,
  trainingId: string,
  /** Zusätzliche Spalten (PostgREST-Select), etwa `"stufen, name"`. */
  spalten?: string,
): Promise<KernErgebnis<TrainingKopfZeile & Z>> {
  // Ein ungültiges Format erreicht die uuid-Spalte nie — dort gäbe es einen
  // Datenbankfehler statt «nicht gefunden».
  if (!istUuid(trainingId))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });

  const { data, error } = await supabase
    .from("trainings")
    .select(spalten ? `${GRUNDSPALTEN}, ${spalten}` : GRUNDSPALTEN)
    .eq("id", trainingId)
    .maybeSingle<Omit<TrainingKopfZeile, "altersstufe"> & { altersstufe: string } & Z>();
  // Der Kern wirft nie: ein unerwarteter Fehler wird «technisch», der
  // Rohtext landet nur im Protokoll (`fehlerMeldung`).
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  // Die Spalte ist NOT NULL und per CHECK begrenzt — das hier ist nur der
  // Typ-Guard, kein erwarteter Verlauf.
  if (!istAltersstufe(data.altersstufe))
    return fehlschlag("technisch", "Das Training hat keine gültige Altersstufe.");
  return ok({ ...data, altersstufe: data.altersstufe });
}

/** Ein Training zum Bearbeiten laden: wie `ladeTrainingZumLesen`, dazu das
 *  Bearbeitungsziel — oder `keine_rechte` mit `fremd: true`. */
export async function ladeTrainingZumBearbeiten<Z extends object = object>(
  supabase: SupabaseClient,
  userId: string,
  trainingId: string,
  spalten?: string,
): Promise<KernErgebnis<{ zeile: TrainingKopfZeile & Z; ziel: Bearbeitungsziel }>> {
  const zeile = await ladeTrainingZumLesen<Z>(supabase, trainingId, spalten);
  if (!zeile.ok) return zeile;
  const ziel = bearbeitungszielVon(zeile.wert, userId);
  if (!ziel)
    return fehlschlag("keine_rechte", FREMDES_TRAINING, { feld: "training_id", fremd: true });
  return ok({ zeile: zeile.wert, ziel });
}

/** Was jede Fassung zum Einordnen trägt: wo sie steht und wie sie heisst. */
const FASSUNG_GRUNDSPALTEN = "id, training_id, trainingsteil, hauptteilkategorie, variante_id, name";

export type FassungKopfZeile = {
  id: string;
  training_id: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  variante_id: string | null;
  name: string;
};

/** Eine Übung im Training (Fassung) zum Bearbeiten laden — dieselben drei
 *  Ausgänge wie beim Training, nur gilt die Kennung der Fassung:
 *  unsichtbar → `nicht_gefunden` («Zuordnung nicht gefunden.»), sichtbar in
 *  einem fremden öffentlichen Training → `keine_rechte` mit `fremd: true`.
 *
 *  Das Training kommt im selben Aufruf mit (`trainings!inner`): Die Fassung
 *  hängt an seiner RLS-Kette, und ihre Rechte SIND seine Rechte. */
export async function ladeFassungZumBearbeiten<F extends object = object>(
  supabase: SupabaseClient,
  userId: string,
  fassungId: string,
  /** Zusätzliche Spalten der Fassung (PostgREST-Select), etwa `"bild_url"`. */
  spalten?: string,
): Promise<
  KernErgebnis<{ fassung: FassungKopfZeile & F; ziel: Bearbeitungsziel; altersstufe: Altersstufe }>
> {
  if (!istUuid(fassungId))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.fassung, { feld: "fassung_id" });

  const auswahl = [FASSUNG_GRUNDSPALTEN, spalten, "trainings!inner ( owner_id, team_id, altersstufe )"]
    .filter(Boolean)
    .join(", ");
  const { data, error } = await supabase
    .from("training_exercises")
    .select(auswahl)
    .eq("id", fassungId)
    .maybeSingle<
      FassungKopfZeile &
        F & { trainings: TrainingsEigentum & { altersstufe: string } | null }
    >();
  if (error) return ausDbFehler(error);
  if (!data?.trainings)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.fassung, { feld: "fassung_id" });

  const { trainings: training, ...fassung } = data;
  const ziel = bearbeitungszielVon(training, userId);
  if (!ziel)
    return fehlschlag("keine_rechte", FREMDES_TRAINING, { feld: "fassung_id", fremd: true });
  // Typ-Guard wie beim Training: die Spalte ist NOT NULL und per CHECK begrenzt.
  if (!istAltersstufe(training.altersstufe))
    return fehlschlag("technisch", "Das Training hat keine gültige Altersstufe.");
  return ok({
    fassung: fassung as unknown as FassungKopfZeile & F,
    ziel,
    altersstufe: training.altersstufe,
  });
}

export type GruppeKopfZeile = { id: string; name: string; training_id: string };

/** Eine Gruppe eines Trainings zum Bearbeiten laden (#194) — dieselben drei
 *  Ausgänge wie bei der Fassung: unsichtbar → `nicht_gefunden` («Gruppe nicht
 *  gefunden.»), sichtbar in einem fremden öffentlichen Training →
 *  `keine_rechte` mit `fremd: true`. Das Training kommt im selben Aufruf mit
 *  (`trainings!inner`): Die Gruppe hängt an seiner RLS-Kette. */
export async function ladeGruppeZumBearbeiten(
  supabase: SupabaseClient,
  userId: string,
  gruppeId: string,
): Promise<KernErgebnis<{ gruppe: GruppeKopfZeile; ziel: Bearbeitungsziel }>> {
  if (!istUuid(gruppeId))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.gruppe, { feld: "gruppe_id" });

  const { data, error } = await supabase
    .from("training_gruppen")
    .select("id, name, training_id, trainings!inner ( owner_id, team_id )")
    .eq("id", gruppeId)
    .maybeSingle<GruppeKopfZeile & { trainings: TrainingsEigentum | null }>();
  if (error) return ausDbFehler(error);
  if (!data?.trainings)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.gruppe, { feld: "gruppe_id" });

  const ziel = bearbeitungszielVon(data.trainings, userId);
  if (!ziel)
    return fehlschlag("keine_rechte", FREMDES_TRAINING, { feld: "gruppe_id", fremd: true });
  return ok({ gruppe: { id: data.id, name: data.name, training_id: data.training_id }, ziel });
}

/** Eine Zeile per Kennung aktualisieren und prüfen, dass der Update traf.
 *
 *  Kein Owner-Filter: Wer schreiben darf, entscheidet die RLS (an einem
 *  Team-Training jedes Mitglied). `select` danach zeigt, ob wirklich eine
 *  Zeile getroffen wurde — ein Nulltreffer meldete sonst stillen Erfolg und
 *  wird hier `nicht_gefunden`. Ein Datenbankfehler geht durch `ausDbFehler`.
 *  Der Aufrufer hat die Zeile davor mit `lade…ZumBearbeiten` eingeordnet; ein
 *  Nulltreffer hier heisst also «inzwischen weg». */
export async function aktualisiereZeile(
  supabase: SupabaseClient,
  tabelle: "trainings" | "training_exercises",
  id: string,
  werte: Record<string, unknown>,
  o: { nichtGefunden: string; feld?: string },
): Promise<KernErgebnis<undefined>> {
  const { data, error } = await supabase
    .from(tabelle)
    .update(werte)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", o.nichtGefunden, o.feld ? { feld: o.feld } : {});
  return ok(undefined);
}

/** Ist der Aufrufer Mitglied dieses Teams? Die SELECT-Policy auf `teams` lässt
 *  nur Mitglieder lesen — eine sichtbare Zeile IST die Mitgliedschaft. */
export async function pruefeTeamMitglied(
  supabase: SupabaseClient,
  teamId: string,
): Promise<KernErgebnis<{ id: string; name: string }>> {
  if (!istUuid(teamId))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { data, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .maybeSingle<{ id: string; name: string }>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  return ok(data);
}
