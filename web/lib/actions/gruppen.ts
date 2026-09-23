"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidiereTraining } from "@/lib/revalidate";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import { NICHT_GEFUNDEN } from "@/lib/kern/ergebnis";
import {
  benenneGruppe as benenneGruppeImKern,
  entferneGruppe as entferneGruppeImKern,
  GRUPPE_NICHT_ANGELEGT,
  legeGruppeAn as legeGruppeAnImKern,
  setzeDurchlauf,
} from "@/lib/kern/gruppen";
import { editorAktion } from "@/lib/actions/adapter";
import type { TrainingActionResult } from "@/lib/actions/trainings";

/**
 * Gruppen eines Trainings anlegen, umbenennen, entfernen (Story #149) und den
 * Durchlauf einer Übung setzen (Story #150).
 *
 * Dünne Adapter über den Fachkern (lib/kern/gruppen.ts), den auch die
 * KI-Werkzeuge aufrufen (#194): dort stehen die Regeln, die Meldungen und
 * die Einordnung von «nicht gefunden» und «fremd». Hier bleiben Anmeldung,
 * Revalidieren und die Ergebnisform des Editors (`editorAktion`).
 *
 * Ein fremdes öffentliches Training heisst an der Oberfläche weiter «nicht
 * gefunden» — beim Anlegen «Training nicht gefunden.», an einer Gruppe
 * «Gruppe nicht gefunden.».
 */

/** Der Wortlaut an der Durchlauf-Zeile seit #150: «Übung», nicht «Zuordnung». */
const UEBUNG_NICHT_GEFUNDEN = "Übung nicht gefunden.";

/** Eine Gruppe am Training anlegen (AK 1/4). Liefert die angelegte Zeile, damit
 *  der Editor sie ohne Neuladen in seine Liste hängen kann. */
export async function legeGruppeAn(
  trainingId: string,
  name: string,
): Promise<{ ok: true; gruppe: { id: string; name: string } } | { ok: false; error: string }> {
  const r = await editorAktion(
    (supabase, userId) => legeGruppeAnImKern(supabase, userId, { trainingId, name }),
    { zusatz: (w) => ({ gruppe: w.gruppe }) },
  );
  // Ein Erfolg trägt die Gruppe immer (`zusatz`), ein Fehlschlag immer eine
  // Meldung — der Typ lässt beides offen.
  return r.ok && r.gruppe
    ? { ok: true, gruppe: r.gruppe }
    : { ok: false, error: r.error ?? GRUPPE_NICHT_ANGELEGT };
}

/** Die Bezeichnung einer Gruppe ändern (AK 2). Die eigene Bezeichnung zählt
 *  dabei nicht als vergeben (AK 8). */
export async function benenneGruppe(
  gruppeId: string,
  name: string,
): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => benenneGruppeImKern(supabase, userId, { gruppeId, name }),
    { nichtGefunden: NICHT_GEFUNDEN.gruppe },
  );
}

/** Eine Gruppe entfernen (AK 3). */
export async function entferneGruppe(gruppeId: string): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => entferneGruppeImKern(supabase, userId, { gruppeId }),
    { nichtGefunden: NICHT_GEFUNDEN.gruppe },
  );
}

/** Eine Gruppe in der Reihenfolge verschieben (#209): Tausch mit dem Nachbarn,
 *  am Rand ohne Wirkung. Muster und Wortlaut wie `verschiebeVariante` — beide
 *  Ordnungen ändern sich auf dieselbe Weise (`verschoben()` in
 *  `@/lib/ordnung`). */
export async function verschiebeGruppe(
  gruppeId: string,
  dir: -1 | 1,
): Promise<TrainingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Das Training der Gruppe: es sagt, welche Ansichten danach neu zu
  // validieren sind. Findet die RLS die Zeile nicht, ist hier Schluss — sonst
  // meldete erst die RPC einen Fehler ohne Bezug.
  const { data: gruppe, error: leseFehler } = await supabase
    .from("training_gruppen")
    .select("training_id")
    .eq("id", gruppeId)
    .maybeSingle();
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };
  if (!gruppe) return { ok: false, error: "Gruppe nicht gefunden." };

  const { error } = await supabase.rpc("verschiebe_gruppe", {
    p_gruppe: gruppeId,
    p_dir: dir,
  });
  if (error) return { ok: false, error: fehlerMeldung(error.message) };

  revalidiereTraining(gruppe.training_id);
  return { ok: true };
}

/**
 * Die Gruppenfolge einer Übung setzen (Story #150 AK 1/2/3).
 *
 * Zuweisen, Umsortieren und Entfernen sind hier EINE Aktion: aus Sicht der
 * Daten ist jedes davon eine neue Reihenfolge, und der Kern ersetzt die Folge
 * vollständig (`setzeDurchlauf`).
 *
 * `gruppeIds` sind die Gruppen in Wechselreihenfolge; die leere Liste heisst
 * «alle gemeinsam». Eine Übung ausserhalb des Hauptteils, eine fremde Gruppe
 * und dieselbe Gruppe zweimal benennt der Kern mit einem eigenen Satz.
 */
export async function setzeGruppenfolge(
  trainingExerciseId: string,
  gruppeIds: string[],
): Promise<TrainingActionResult> {
  return editorAktion(
    async (supabase, userId) => {
      const r = await setzeDurchlauf(supabase, userId, { fassungId: trainingExerciseId, gruppeIds });
      return !r.ok && r.art === "nicht_gefunden" ? { ...r, meldung: UEBUNG_NICHT_GEFUNDEN } : r;
    },
    { nichtGefunden: UEBUNG_NICHT_GEFUNDEN },
  );
}
