import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istAltersstufe, kategorienFuer } from "@/lib/altersstufe";
import { sortStufen, stufenAbgedeckt, trainingNameProblem, ZIEL_MAX } from "@/lib/training";
import {
  aktualisiereZeile,
  ladeTrainingZumBearbeiten,
  pruefeTeamMitglied,
} from "@/lib/kern/zugriff";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

/**
 * Ein Training anlegen (Story #10, Story 5, Team-Epic Story 3, #192 AK 1/2).
 *
 * Eine Regelquelle für drei Wege: das Anlege-Formular (`createTraining`), das
 * Team-Anlegen (`erstelleTeamTraining`) und das KI-Werkzeug
 * «training_anlegen». Das Training entsteht immer als privater Entwurf
 * (#192 PC 1) — persönlich mit dem Aufrufer als Eigentümer oder, mit
 * `teamId`, als Team-Training ohne Eigentümer.
 *
 * Die Meldungen sind wortgleich mit denen der Oberfläche. Das Ziel wird hier
 * NICHT gekürzt: Das Formular kürzt still auf `ZIEL_MAX` (`zielWert`), ein
 * KI-Client bekommt stattdessen die Grenze genannt.
 */
export type TrainingAnlegen = {
  name: string;
  altersstufe: string;
  stufen: readonly string[];
  ziel?: string | null;
  teamId?: string;
};

export async function legeTrainingAn(
  supabase: SupabaseClient,
  userId: string,
  e: TrainingAnlegen,
): Promise<KernErgebnis<{ id: string; teamId: string | null }>> {
  // Dieselbe Regel wie beim Umbenennen. Ohne sie entstünde hier ein Name, den
  // das Feld im Editor-Kopf nicht mehr speichern könnte — die Grenze sperrte
  // dann ausgerechnet das Werkzeug, mit dem man sie einhält. Seit #192 gilt
  // sie auch für Team-Trainings (bisher nur «nicht leer»).
  const namensProblem = trainingNameProblem(e.name);
  if (namensProblem) return fehlschlag("eingabe", namensProblem, { feld: "name" });
  const name = e.name.trim();

  // Die Altersstufe ist Pflicht und hat bewusst KEINEN Rückfall: Sie bindet
  // lebenslang (Story 5 AK 5), und eine stille Vorgabe wäre genau das
  // Durchrutschen, das die Story ausschliesst. Die Datenebene führt die Spalte
  // seit der Migration `training_altersstufe_default_drop` ohne Default.
  const altersstufe = e.altersstufe.trim();
  if (!istAltersstufe(altersstufe))
    return fehlschlag("eingabe", "Bitte die Altersstufe wählen.", {
      feld: "altersstufe",
    });

  // Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30). Die
  // Datenebene setzt es als Trigger `trainings_stufe_pflicht` ebenfalls durch.
  const erlaubt = kategorienFuer(altersstufe);
  if (e.stufen.length === 0)
    return fehlschlag("eingabe", "Bitte mindestens eine Alterskategorie wählen.", {
      feld: "stufen",
      zulaessig: erlaubt,
    });
  // Die Kategorien folgen der gewählten Altersstufe; sie bestimmen sie nicht
  // mehr (Story 5 AK 4). Ein stufenfremder Wert wird abgewiesen statt still
  // weggefiltert — sonst entstünde ein Training mit weniger Kategorien, als der
  // Trainer gewählt hat.
  if (e.stufen.some((s) => !erlaubt.includes(s)))
    return fehlschlag(
      "regel",
      "Diese Alterskategorie gehört nicht zur gewählten Altersstufe. " +
        "Wähle nur Kategorien dieser Altersstufe.",
      { feld: "stufen", zulaessig: erlaubt },
    );

  const ziel = e.ziel?.trim() ? e.ziel.trim() : null;
  if (ziel && ziel.length > ZIEL_MAX)
    return fehlschlag("eingabe", `Das Ziel darf höchstens ${ZIEL_MAX} Zeichen lang sein.`, {
      feld: "ziel",
    });

  if (e.teamId) {
    const team = await pruefeTeamMitglied(supabase, e.teamId);
    if (!team.ok) return team;
  }

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      name,
      ziel,
      altersstufe,
      stufen: [...e.stufen],
      visibility: "private",
      // Genau eine Eigentumsform (`tr_ein_eigentuemer`): Person ODER Team.
      ...(e.teamId ? { team_id: e.teamId } : { owner_id: userId }),
    })
    .select("id")
    .single<{ id: string }>();
  // Übersetzt, nicht roh: eine gemischte Stufenwahl kommt hier als
  // Constraint-Meldung an, und die versteht niemand (Epic #71).
  if (error) return ausDbFehler(error);
  return ok({ id: data.id, teamId: e.teamId ?? null });
}

// ── Überarbeiten (Story #12, Story 10, #193 AK 3–6) ────────────────────────
//
// Eine Regelquelle für den Editor-Kopf (`renameTraining`, `setTrainingZiel`,
// `setTrainingStufen`) und die KI-Werkzeuge «training_umbenennen»,
// «training_ziel_setzen», «training_kategorien_setzen». Kein Owner-Filter beim
// Schreiben: Team-Trainings darf jedes Mitglied bearbeiten (Story 6), die RLS
// entscheidet. `ladeTrainingZumBearbeiten` davor trennt «nicht sichtbar» von
// «sichtbar, aber fremd» (#193 AK 14); `select` nach dem Update zeigt, ob
// wirklich etwas getroffen wurde — ein Nulltreffer meldete sonst stillen
// Erfolg (`aktualisiereZeile`).

/** Ein Update auf genau dieses Training (lib/kern/zugriff.ts). */
const aktualisiereTraining = (
  supabase: SupabaseClient,
  trainingId: string,
  werte: Record<string, unknown>,
) =>
  aktualisiereZeile(supabase, "trainings", trainingId, werte, {
    nichtGefunden: NICHT_GEFUNDEN.training,
    feld: "training_id",
  });

/** Den Namen eines Trainings ändern (Story #12 AK 1, #193 AK 3). Dieselbe
 *  Regel wie am Feld im Editor-Kopf — hier als Trust-Boundary, denn die
 *  Spalte trägt keinen CHECK (Begründung bei `TRAINING_NAME_MAX`). */
export async function benenneTrainingUm(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; name: string },
): Promise<KernErgebnis<{ trainingId: string; name: string }>> {
  const problem = trainingNameProblem(e.name);
  if (problem) return fehlschlag("eingabe", problem, { feld: "name" });
  const name = e.name.trim();

  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const r = await aktualisiereTraining(supabase, e.trainingId, { name });
  return r.ok ? ok({ trainingId: e.trainingId, name }) : r;
}

/** Das Ziel setzen, ändern oder entfernen (Story 10 AK 1/3, #193 AK 3).
 *  Leer und reine Leerzeichen heissen «kein Ziel» (Story 10 PC 3). Gekürzt
 *  wird hier nicht — das Formular kürzt still, ein KI-Client bekommt die
 *  Grenze genannt. */
export async function setzeZiel(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; ziel: string | null },
): Promise<KernErgebnis<{ trainingId: string; ziel: string | null }>> {
  const ziel = e.ziel?.trim() ? e.ziel.trim() : null;
  if (ziel && ziel.length > ZIEL_MAX)
    return fehlschlag("eingabe", `Das Ziel darf höchstens ${ZIEL_MAX} Zeichen lang sein.`, {
      feld: "ziel",
    });

  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const r = await aktualisiereTraining(supabase, e.trainingId, { ziel });
  return r.ok ? ok({ trainingId: e.trainingId, ziel }) : r;
}

/** Eine Übung, die keine der Alterskategorien des Trainings mehr abdeckt. */
export type NichtMehrPassend = { fassungId: string; name: string; varianteId: string | null };

/** Die Alterskategorien ersetzen (Story #12 AK 2/3, #193 AK 4–6, PC 3).
 *
 *  Mindestens eine bleibt — immer, nicht erst beim Veröffentlichen
 *  (PO 2026-08-30). Der DB-Trigger `trainings_stufe_pflicht` greift bewusst
 *  nur beim Anlegen, damit bestehende kategorielose Trainings bearbeitbar
 *  bleiben; das Leeren der letzten Kategorie fiele sonst durch beide Netze.
 *
 *  Die Kategorien folgen der Altersstufe des Trainings, die ab dem Anlegen
 *  feststeht (Story 1). Übungen, die danach keine Kategorie mehr abdecken,
 *  bleiben stehen — sie werden nur benannt, über ALLE Varianten des
 *  Hauptteils (#201 AK 11): Eine Übung, die der Trainer nirgends sieht, muss
 *  benannt werden, sonst sucht er sie vergeblich. */
export async function setzeStufen(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; stufen: readonly string[] },
): Promise<
  KernErgebnis<{ trainingId: string; stufen: string[]; nichtMehrPassend: NichtMehrPassend[] }>
> {
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const erlaubt = kategorienFuer(zugriff.wert.zeile.altersstufe);

  if (e.stufen.length === 0)
    return fehlschlag("eingabe", "Bitte mindestens eine Alterskategorie wählen.", {
      feld: "stufen",
      zulaessig: erlaubt,
    });
  // Vorgelagert statt am Constraint-Fehler: die Datenebene würde denselben
  // Versuch abweisen, aber ohne den Hinweis auf den gangbaren Weg.
  if (e.stufen.some((s) => !erlaubt.includes(s)))
    return fehlschlag(
      "regel",
      "Diese Alterskategorie gehört nicht zur Altersstufe dieses Trainings. " +
        "Lege für die andere Altersstufe ein neues Training an.",
      { feld: "stufen", zulaessig: erlaubt },
    );
  // In der fachlichen Reihenfolge und ohne Doppel — so zeigt sie jede Ansicht.
  const stufen = sortStufen(e.stufen);

  const r = await aktualisiereTraining(supabase, e.trainingId, { stufen });
  if (!r.ok) return r;

  // Abweichende Fassungen ermitteln — anhand IHRER Alterskategorien: die
  // Fassung ist im Training frei bearbeitbar und die einzige Quelle. Ohne
  // Kategorien gibt es nichts abzudecken; solche Fassungen gelten nicht als
  // abweichend. Scheitert das Lesen, bleibt die Liste leer: Die Änderung ist
  // geschehen und soll nicht als Fehler dastehen.
  const { data: rows } = await supabase
    .from("training_exercises")
    .select("id, name, kategorien, variante_id")
    .eq("training_id", e.trainingId);
  const nichtMehrPassend = (rows ?? [])
    .filter((f) => (f.kategorien ?? []).length > 0 && !stufenAbgedeckt(stufen, f.kategorien))
    .map((f) => ({ fassungId: f.id as string, name: f.name as string, varianteId: f.variante_id }));

  return ok({ trainingId: e.trainingId, stufen, nichtMehrPassend });
}
