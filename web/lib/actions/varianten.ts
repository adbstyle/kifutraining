"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidiereTraining } from "@/lib/revalidate";
import { MELDUNG_VERGEBEN, varianteNameProblem } from "@/lib/varianten";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import { ladeBearbeitungsziel, bildOrdnerFuer } from "@/lib/training-zugriff";
import {
  eigeneBildPfade,
  entferneStorageObjekte,
  kopiereBild,
  kopiereDiagrammVon,
} from "@/lib/fassung";
import type { TrainingActionResult } from "@/lib/actions/trainings";

/**
 * Varianten des Hauptteils anlegen, umbenennen, umsortieren, entfernen
 * (Epic #200, Stories #201/#202).
 *
 * Muster wie bei den Gruppen (`lib/actions/gruppen.ts`): kein Owner-Filter in
 * der Abfrage — die RLS-Policies `tv_*` entscheiden, wer an eine Variante darf.
 * Ein `.select().maybeSingle()` deckt den Nulltreffer auf; ohne ihn meldete
 * eine weggefilterte Zeile stillen Erfolg.
 *
 * Die Bezeichnung wird zweimal geprüft: hier gegen den gelesenen Bestand, damit
 * die Meldung am Feld die Regel nennt, und in der Datenbank durch den
 * Unique-Index `tv_name_je_training`. Nur die Datenbank kann zwei gleichzeitige
 * Anlagen auseinanderhalten — deshalb ist ihr `23505` hier ebenfalls behandelt.
 *
 * Anlegen und Entfernen laufen über SECURITY-DEFINER-RPCs statt über direkte
 * Schreibzugriffe: Beide sind mehrstufig (Variante + Fassungskopien +
 * Zuweisungen bzw. Prüfung + Löschen) und müssen in EINER Transaktion
 * geschehen — eine halb gefüllte Variante wäre für den Trainer eine Zumutung,
 * und ab #204 wiese der Veröffentlichungs-Gate sie zu Recht ab.
 */

/** Die Unique-Verletzung des Index `tv_name_je_training`. */
const UNIQUE_VERLETZUNG = "23505";

/** Die bestehenden Varianten des Trainings — Grundlage der Vorabprüfung. */
async function bestehendeVarianten(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("training_varianten")
    .select("id, name")
    .eq("training_id", trainingId);
  return data ?? [];
}

/**
 * Eine weitere Variante des Hauptteils anlegen — als Kopie der angezeigten
 * (#201 AK 1/2, PC 1).
 *
 * `nameQuelle` ist die (optional) neue Bezeichnung der Quelle: Beim Anlegen der
 * ZWEITEN Variante benennt der Trainer beide, denn bis dahin trug der Hauptteil
 * einen unsichtbaren Vorgabenamen (#201 AK 2). Ab der dritten bleibt sie leer.
 *
 * Der Ablauf ist geteilt, weil Storage und Diagramm-Kopie nicht in SQL gehen:
 * Die Anwendung erzeugt die IDs der Kopien vorab, kopiert Bilddatei und
 * Diagramm (mit frischen Element-IDs) und reicht das Mapping an die RPC. WAS
 * kopiert wird, entscheidet dort SQL — das Mapping kann nichts hinzufügen und
 * nichts weglassen, ohne `VARIANTE_KOPIE_UNVOLLSTAENDIG` auszulösen.
 *
 * Scheitert die RPC, fallen die bereits erzeugten Bilddateien wieder weg.
 */
export async function legeVarianteAn(
  trainingId: string,
  quelleVarianteId: string,
  name: string,
  nameQuelle?: string,
): Promise<{ ok: true; varianteId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Das Bearbeitungsziel sagt zugleich, in welchen Storage-Ordner die
  // Bildkopien gehören: bei einem Team-Training in den Team-Ordner, damit jedes
  // Mitglied das Bild danach ersetzen darf.
  const ziel = await ladeBearbeitungsziel(supabase, trainingId, user.id);
  if (!ziel) return { ok: false, error: "Training nicht gefunden." };

  const bestehende = await bestehendeVarianten(supabase, trainingId);
  const quelle = bestehende.find((v) => v.id === quelleVarianteId);
  if (!quelle) return { ok: false, error: "Diese Variante gibt es nicht mehr." };

  // Die Quelle darf ihren bisherigen Namen behalten und ihn zugleich ändern —
  // beides wird gegen den Bestand OHNE sie selbst geprüft. Und beide Eingaben
  // gegeneinander: Der Unique-Index sähe die Kollision erst, wenn schon die
  // halbe Umbenennung stünde.
  const getrimmt = name.trim();
  const getrimmtQuelle = nameQuelle?.trim();
  if (getrimmtQuelle !== undefined) {
    const problem = varianteNameProblem(getrimmtQuelle, bestehende, quelleVarianteId);
    if (problem) return { ok: false, error: problem };
  }
  const nachher = bestehende.map((v) =>
    v.id === quelleVarianteId && getrimmtQuelle !== undefined
      ? { ...v, name: getrimmtQuelle }
      : v,
  );
  const problem = varianteNameProblem(getrimmt, nachher);
  if (problem) return { ok: false, error: problem };

  // Die Fassungen der Quelle: nur ihre IDs, ihr Bild und ihr Diagramm. Alles
  // andere kopiert die RPC direkt aus der Zeile — so kann kein Übungsfeld
  // unterwegs verlorengehen.
  const { data: quellFassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select("id, bild_url, diagramm")
    .eq("variante_id", quelleVarianteId);
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };

  const ordner = bildOrdnerFuer(ziel);
  const kopierteBilder: string[] = [];
  const mapping: {
    quelle_id: string;
    neue_id: string;
    bild_url: string | null;
    diagramm: unknown;
  }[] = [];
  for (const f of quellFassungen ?? []) {
    const neueId = crypto.randomUUID();
    const bild = await kopiereBild(supabase, f.bild_url, ordner, neueId);
    if (bild.error) {
      await entferneStorageObjekte(supabase, kopierteBilder);
      return { ok: false, error: bild.error };
    }
    if (bild.pfad) kopierteBilder.push(bild.pfad);
    mapping.push({
      quelle_id: f.id,
      neue_id: neueId,
      bild_url: bild.url,
      // Frische Element-IDs: Die Kopie ist ab dem ersten Moment eigenständig
      // (#201 PC 2).
      diagramm: kopiereDiagrammVon(f.diagramm),
    });
  }

  const { data: neueId, error } = await supabase.rpc("lege_variante_an", {
    p_training: trainingId,
    p_quelle: quelleVarianteId,
    p_name: getrimmt,
    p_name_quelle: getrimmtQuelle ?? null,
    p_fassungen: mapping,
  });
  if (error || !neueId) {
    await entferneStorageObjekte(supabase, kopierteBilder);
    if (error?.code === UNIQUE_VERLETZUNG) return { ok: false, error: MELDUNG_VERGEBEN };
    return {
      ok: false,
      error: error ? fehlerMeldung(error.message) : "Die Variante liess sich nicht anlegen.",
    };
  }

  revalidiereTraining(trainingId);
  return { ok: true, varianteId: neueId };
}

/** Die Bezeichnung einer Variante ändern (#202). Die eigene zählt dabei nicht
 *  als vergeben — dafür kennt `varianteNameProblem` die eigene ID. */
export async function benenneVariante(
  varianteId: string,
  name: string,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Das Training der Variante ist die Grundlage beider Folgeschritte: es sagt,
  // gegen welchen Bestand geprüft wird und welche Ansichten danach neu zu
  // validieren sind. Findet die RLS die Zeile nicht, ist hier Schluss.
  const { data: variante, error: leseFehler } = await supabase
    .from("training_varianten")
    .select("training_id")
    .eq("id", varianteId)
    .maybeSingle();
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };
  if (!variante) return { ok: false, error: "Variante nicht gefunden." };

  const getrimmt = name.trim();
  const problem = varianteNameProblem(
    getrimmt,
    await bestehendeVarianten(supabase, variante.training_id),
    varianteId,
  );
  if (problem) return { ok: false, error: problem };

  const { data, error } = await supabase
    .from("training_varianten")
    .update({ name: getrimmt })
    .eq("id", varianteId)
    .select("training_id")
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VERLETZUNG) return { ok: false, error: MELDUNG_VERGEBEN };
    return { ok: false, error: fehlerMeldung(error.message) };
  }
  if (!data) return { ok: false, error: "Variante nicht gefunden." };

  revalidiereTraining(data.training_id);
  return { ok: true };
}

/**
 * Eine Variante entfernen (#202). Ihre Fassungen fallen mit ihr (Kaskade an
 * `training_exercises.variante_id`), die Gruppen-DEFINITIONEN bleiben — sie
 * gehören dem Training und gelten für alle Varianten.
 *
 * Die Bildpfade werden VOR dem Löschen gelesen: Danach gibt es die Zeilen nicht
 * mehr, und ihre Dateien blieben als Waisen im Storage liegen. Entfernt wird
 * nur, was der Fassung selbst gehört (`eigeneBildPfade`) — eine noch auf die
 * Vorlage zeigende URL bleibt unangetastet.
 *
 * Die letzte Variante bleibt (Epic EK 6). Das entscheidet die RPC vor dem
 * Löschen, damit die Bilddateien nicht schon weg sind, wenn erst der
 * Constraint-Trigger beim Commit anschlägt.
 */
export async function entferneVariante(varianteId: string): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: fassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select("id, bild_url")
    .eq("variante_id", varianteId);
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };

  const { data: trainingId, error } = await supabase.rpc("entferne_variante", {
    p_variante: varianteId,
  });
  if (error) return { ok: false, error: fehlerMeldung(error.message) };
  if (!trainingId) return { ok: false, error: "Variante nicht gefunden." };

  await entferneStorageObjekte(supabase, eigeneBildPfade(fassungen ?? []));

  revalidiereTraining(trainingId);
  return { ok: true };
}

/** Eine Variante in der Reihenfolge verschieben (#202): Tausch mit dem
 *  Nachbarn, am Rand ohne Wirkung. Die Reihenfolge entscheidet, welche Variante
 *  beim Öffnen gilt (#201 AK 7). */
export async function verschiebeVariante(
  varianteId: string,
  dir: -1 | 1,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Das Training der Variante: es sagt, welche Ansichten danach neu zu
  // validieren sind. Findet die RLS die Zeile nicht, ist hier Schluss — sonst
  // meldete erst die RPC einen Fehler ohne Bezug.
  const { data: variante, error: leseFehler } = await supabase
    .from("training_varianten")
    .select("training_id")
    .eq("id", varianteId)
    .maybeSingle();
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };
  if (!variante) return { ok: false, error: "Variante nicht gefunden." };

  const { error } = await supabase.rpc("verschiebe_variante", {
    p_variante: varianteId,
    p_dir: dir,
  });
  if (error) return { ok: false, error: fehlerMeldung(error.message) };

  revalidiereTraining(variante.training_id);
  return { ok: true };
}
