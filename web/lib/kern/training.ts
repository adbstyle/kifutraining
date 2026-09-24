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
import {
  TRAGWEITE_VEROEFFENTLICHEN,
  ZUM_VEROEFFENTLICHEN_FEHLT,
  bedingungText,
  fehlendeBedingungenAus,
  type FehlendeBedingung,
} from "@/lib/training-bedingungen";

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

// ── Veröffentlichen und zurückziehen (Story A, #196) ────────────────────────
//
// Eine Regelquelle für den Editor (`veroeffentlicheTraining`,
// `setzeTrainingAufEntwurf`) und die KI-Werkzeuge «training_veroeffentlichen»,
// «training_auf_entwurf_setzen». Veröffentlichen ist ein Zustand, keine
// Kopie: dasselbe Training wird sichtbar und bleibt bearbeitbar (#196 PC 1).
// Die Bedingungen setzt die Datenbank durch (`training_pruefe_oeffentlich`),
// solange das Training öffentlich ist — auch gegen spätere Änderungen
// (#196 AK 7). Hier geht es darum, ALLE fehlenden vorab in Klartext zu
// nennen (NFR 2); die Datenebene kennt nur die erste.

/** Ein Team-Training ist nie öffentlich (`tr_team_nie_public`). */
export const TEAM_NICHT_VEROEFFENTLICHBAR =
  "Ein Team-Training lässt sich nicht veröffentlichen. Übernimm es zuerst in deinen persönlichen Bestand.";

/** Dasselbe von der anderen Seite: Ohne «öffentlich» gibt es kein Zurück. */
export const TEAM_OHNE_ENTWURF =
  "Ein Team-Training ist nie öffentlich und hat darum keinen Entwurfs-Zustand.";

type Bedingungsstand = {
  stufen: string[] | null;
  training_exercises:
    | { trainingsteil: string; hauptteilkategorie: string | null; variante_id: string | null }[]
    | null;
  training_varianten: { id: string; name: string; position: number }[] | null;
};

/** Die Ablehnung mit allen fehlenden Bedingungen: «Zum Veröffentlichen fehlt
 *  noch: a; b.» — die Variante erst ab zwei genannt, wie in der Oberfläche
 *  (`fehlendeBedingungenAus` setzt `varianteId` nur dann). */
function fehltZumVeroeffentlichen(
  fehlend: FehlendeBedingung[],
  varianten: readonly { id: string; name: string }[],
) {
  const teile = fehlend.map((b) =>
    bedingungText(b.bedingung, varianten.find((v) => v.id === b.varianteId)?.name),
  );
  const [erste] = fehlend;
  return fehlschlag("bedingung", `${ZUM_VEROEFFENTLICHEN_FEHLT} ${teile.join("; ")}.`, {
    feld: "training_id",
    fehlend,
    bedingung: erste.bedingung,
    varianteId: erste.varianteId ?? undefined,
  });
}

/** Ein eigenes persönliches Training öffentlich schalten (Story A AK 1,
 *  #196 AK 1/4–6, PC 1/4, NFR 1/2).
 *
 *  `urheber` ist der Anzeigename, der nun am Training steht, `tragweite` der
 *  Satz aus dem Bestätigungsdialog der Oberfläche — der KI-Weg fragt nicht
 *  nach (#196 OoS 2), er gibt Auskunft und handelt. */
export async function veroeffentliche(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string },
): Promise<
  KernErgebnis<{
    trainingId: string;
    sichtbarkeit: "oeffentlich";
    urheber: string | null;
    tragweite: string;
  }>
> {
  const zugriff = await ladeTrainingZumBearbeiten<Bedingungsstand>(
    supabase,
    userId,
    e.trainingId,
    "stufen, training_exercises ( trainingsteil, hauptteilkategorie, variante_id ), training_varianten ( id, name, position )",
  );
  if (!zugriff.ok) return zugriff;
  const { zeile, ziel } = zugriff.wert;
  if (ziel.art === "team")
    return fehlschlag("regel", TEAM_NICHT_VEROEFFENTLICHBAR, { feld: "training_id" });

  // Die Hauptteil-Bedingung gilt je Variante (#204 AK 1). Sortiert wird hier:
  // PostgREST garantiert für einen eingebetteten Satz keine Reihenfolge, und
  // die Meldung soll die Varianten in derselben Folge nennen wie die
  // Oberfläche (`position`, bei Gleichstand `id`, wie in
  // `training_fehlende_bedingungen`).
  const varianten = (zeile.training_varianten ?? [])
    .slice()
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const fehlend = fehlendeBedingungenAus(
    zeile.altersstufe,
    zeile.stufen ?? [],
    (zeile.training_exercises ?? []).map((f) => ({
      trainingsteil: f.trainingsteil,
      hauptteilkategorie: f.hauptteilkategorie,
      varianteId: f.variante_id,
    })),
    varianten,
  );
  if (fehlend.length > 0) return fehltZumVeroeffentlichen(fehlend, varianten);

  const { data, error } = await supabase
    .from("trainings")
    .update({ visibility: "public" })
    .eq("id", e.trainingId)
    .eq("owner_id", userId)
    .select("id, urheber")
    .maybeSingle<{ id: string; urheber: string | null }>();
  if (error) {
    // Weist die Datenebene ab, hat sich der Stand seit dem Lesen geändert —
    // dieselbe Aussage wie die Vorabprüfung, nur mit genau einer Bedingung
    // (mehr gibt ein `raise` nicht her).
    const f = ausDbFehler(error);
    return f.art === "bedingung" && f.bedingung
      ? fehltZumVeroeffentlichen([{ bedingung: f.bedingung, varianteId: f.varianteId ?? null }], varianten)
      : f;
  }
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  return ok({
    trainingId: e.trainingId,
    sichtbarkeit: "oeffentlich",
    urheber: data.urheber,
    tragweite: TRAGWEITE_VEROEFFENTLICHEN,
  });
}

/** Ein öffentliches Training auf Entwurf zurücknehmen (Story A AK 3,
 *  #196 AK 2, PC 2/3).
 *
 *  Es verschwindet aus der Öffentlichkeit und bleibt im Übrigen unberührt.
 *  Kopien, die andere übernommen haben, bleiben bestehen — sie sind
 *  eigenständige Trainings. Ein Entwurf bleibt Entwurf (kein Fehler). */
export async function setzeAufEntwurf(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string },
): Promise<KernErgebnis<{ trainingId: string; sichtbarkeit: "entwurf" }>> {
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  if (zugriff.wert.ziel.art === "team")
    return fehlschlag("regel", TEAM_OHNE_ENTWURF, { feld: "training_id" });

  const { data, error } = await supabase
    .from("trainings")
    .update({ visibility: "private" })
    .eq("id", e.trainingId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  return ok({ trainingId: e.trainingId, sichtbarkeit: "entwurf" });
}
