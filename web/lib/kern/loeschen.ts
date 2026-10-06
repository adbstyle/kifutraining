// Trainings löschen — eine Stelle, die auch die Bilddateien mitnimmt (seit
// #197 im Fachkern).
//
// Die DB-Kaskade entfernt nur die Zeilen, nicht die Dateien im Bildspeicher.
// `loescheTrainingMitBildern` ist die eine Reihenfolge dafür, damit nie das
// Bild einer noch existierenden Fassung fällt. Sie dient dem Löschen eines
// Trainings (`loescheTraining`: Oberfläche, Team-Bestand, KI-Werkzeug
// «training_loeschen») und dem Aufräumen nach einem gescheiterten erneuten
// Zuordnen. Das Auflösen eines Teams räumt seine Bilder anderswo ab
// (`lib/storage-aufraeumen.ts`).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eigeneBildPfade, entferneStorageObjekte, type BildKandidat } from "@/lib/fassung";
import { ladeTrainingZumBearbeiten } from "@/lib/kern/zugriff";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

/** Ein Training samt seiner Fassungs-Bilddateien löschen. Liefert `false`,
 *  wenn nichts gelöscht wurde (nicht vorhanden oder kein Schreibrecht — die
 *  RLS entscheidet), damit der Aufrufer kein falsches Erfolgssignal gibt.
 *
 *  Gelöscht wird ausschliesslich, was der Fassung selbst gehört: der Dateiname
 *  muss ihre ID tragen. Ein verwaistes Bild ist harmlos, eine fremde oder
 *  geteilte Datei zu löschen wäre Datenverlust. */
export async function loescheTrainingMitBildern(
  supabase: SupabaseClient,
  trainingId: string,
): Promise<boolean> {
  // Bildpfade VOR dem Löschen einsammeln — danach sind die Zeilen weg.
  const { data: fassungen } = await supabase
    .from("training_exercises")
    .select("id, bild_url")
    .eq("training_id", trainingId);

  const { data: geloescht, error } = await supabase
    .from("trainings")
    .delete()
    .eq("id", trainingId)
    .select("id");
  if (error || !geloescht?.length) return false;

  await entferneStorageObjekte(supabase, eigeneBildPfade(fassungen ?? []));
  return true;
}

/** Die Meldung, wenn die Datenbank das Löschen nicht ausführte. */
export const LOESCHEN_FEHLGESCHLAGEN = "Löschen fehlgeschlagen.";

export type TrainingGeloescht = {
  name: string;
  /** Zahl der Übungen (Fassungen) über alle Varianten, die mitgingen. */
  uebungen: number;
  /** War es öffentlich? Dann ist es jetzt auch aus dem öffentlichen Bestand
   *  verschwunden (#197 PC 6). */
  warOeffentlich: boolean;
  teamId: string | null;
  /** Der Termin, dem das Team-Training zugeordnet war: Er bleibt ohne
   *  Training im Trainingsplan (#322 PC 7, 8). */
  terminBleibt: { id: string; datum: string } | null;
};

/** Ein Training löschen, das dieses Konto bearbeiten darf: ein eigenes oder
 *  eines der eigenen Teams (#197 AK 6–8, PC 5–7; Story 17, Team-Epic Story 5).
 *
 *  Es fragt nicht nach (#197 OoS 2); was mitging, steht im Ergebnis und wird
 *  VOR dem Löschen gelesen — danach sind die Zeilen weg. Kopien, die andere
 *  übernommen haben, sind eigene Trainings und bleiben (PC 7); wiederherstellen
 *  lässt sich nichts (OoS 3).
 *
 *  `nurTeam` beschränkt auf Team-Trainings (der Team-Bestand der Oberfläche):
 *  ein persönliches Training heisst dort «nicht gefunden». */
export async function loescheTraining(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; nurTeam?: boolean },
): Promise<KernErgebnis<TrainingGeloescht>> {
  const geladen = await ladeTrainingZumBearbeiten<{ name: string }>(
    supabase,
    userId,
    e.trainingId,
    "name",
  );
  if (!geladen.ok) return geladen;
  const { zeile } = geladen.wert;
  if (e.nurTeam && !zeile.team_id)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });

  const [fassungen, termin] = await Promise.all([
    supabase
      .from("training_exercises")
      .select("id", { count: "exact", head: true })
      .eq("training_id", zeile.id),
    supabase.from("training_termine").select("id, datum").eq("training_id", zeile.id).maybeSingle<{ id: string; datum: string }>(),
  ]);
  if (fassungen.error) return ausDbFehler(fassungen.error);
  if (termin.error) return ausDbFehler(termin.error);

  if (!(await loescheTrainingMitBildern(supabase, zeile.id)))
    return fehlschlag("technisch", LOESCHEN_FEHLGESCHLAGEN);

  return ok({
    name: zeile.name,
    uebungen: fassungen.count ?? 0,
    warOeffentlich: zeile.visibility === "public",
    teamId: zeile.team_id,
    terminBleibt: termin.data ?? null,
  });
}

// ── Termin-Trainings (PO 2026-10-06) ─────────────────────────────────────────

/** Die Fassungen der Termin-Trainings unter diesen Trainings. Verliert ein
 *  Termin-Training seinen Termin, löscht die Datenebene es samt Fassungen
 *  (Trigger `termin_training_aufraeumen`) — die Bilddateien nicht. Darum VOR
 *  dem Vorgang einsammeln und danach `raeumeBilderAb`. Trainings aus dem
 *  Bestand bleiben stehen und tragen hier nichts bei. */
export async function terminTrainingBilder(
  supabase: SupabaseClient,
  trainingIds: readonly (string | null | undefined)[],
): Promise<BildKandidat[]> {
  const ids = trainingIds.filter((x): x is string => !!x);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("training_exercises")
    .select("id, bild_url, trainings!inner ( termin_training )")
    .in("training_id", ids)
    .eq("trainings.termin_training", true);
  return (data ?? []).map((f) => ({ id: f.id, bild_url: f.bild_url }));
}

/** Von den Kandidaten die Bilder derer entfernen, deren Fassung tatsächlich
 *  weg ist. Best effort: Im Zweifel bleibt eine Datei liegen — eine Waise ist
 *  harmlos, das Bild einer lebenden Fassung zu löschen wäre Datenverlust. */
export async function raeumeBilderAb(supabase: SupabaseClient, kandidaten: readonly BildKandidat[]): Promise<void> {
  if (kandidaten.length === 0) return;
  // In Stücken gefragt: Eine Serie kann viele Fassungen mitnehmen, und eine
  // lange `in`-Liste sprengte die Länge der Adresse.
  const nochDa = new Set<string>();
  for (let i = 0; i < kandidaten.length; i += 100) {
    const { data, error } = await supabase
      .from("training_exercises")
      .select("id")
      .in("id", kandidaten.slice(i, i + 100).map((k) => k.id));
    if (error) return;
    for (const r of data ?? []) nochDa.add(r.id as string);
  }
  try {
    await entferneStorageObjekte(supabase, eigeneBildPfade(kandidaten.filter((k) => !nochDa.has(k.id))));
  } catch {
    /* ignorieren: Waisen im Bildspeicher sind folgenlos */
  }
}

/** Gibt es dieses Training noch? Nach Lösen, Ersetzen oder Entfernen sagt es,
 *  ob ein Termin-Training mitging oder ein Training im Bestand blieb. */
export async function gibtEsTraining(supabase: SupabaseClient, trainingId: string): Promise<boolean> {
  const { data } = await supabase.from("trainings").select("id").eq("id", trainingId).maybeSingle();
  return !!data;
}
