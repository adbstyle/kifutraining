"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidiereTraining } from "@/lib/revalidate";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import { NICHT_GEFUNDEN } from "@/lib/kern/ergebnis";
import {
  benenneVariante as benenneVarianteImKern,
  entferneVariante as entferneVarianteImKern,
  legeVarianteAn as legeVarianteAnImKern,
  VARIANTE_NICHT_ANGELEGT,
} from "@/lib/kern/varianten";
import { editorAktion } from "@/lib/actions/adapter";
import type { TrainingActionResult } from "@/lib/actions/trainings";

/**
 * Varianten des Hauptteils anlegen, umbenennen, umsortieren, entfernen
 * (Epic #200, Stories #201/#202).
 *
 * Dünne Adapter über den Fachkern (lib/kern/varianten.ts), den auch die
 * KI-Werkzeuge aufrufen (#263): dort stehen die Regeln, die Meldungen, die
 * Bild- und Diagrammkopie und die Einordnung von «nicht gefunden» und
 * «fremd». Hier bleiben Anmeldung, Revalidieren und die Ergebnisform des
 * Editors (`editorAktion`).
 *
 * Ein fremdes öffentliches Training heisst an der Oberfläche weiter «nicht
 * gefunden» — beim Anlegen «Training nicht gefunden.», an einer Variante
 * «Variante nicht gefunden.».
 *
 * `verschiebeVariante` bleibt eine Action ohne Kern — Begründung im Kopf von
 * lib/kern/varianten.ts.
 */

/** Der Wortlaut im Anlege-Dialog, wenn die angezeigte Variante inzwischen
 *  entfernt wurde (veraltete Ansicht). Der Kern sagt dem Assistenten
 *  stattdessen «gehört zu einem anderen Training» samt der zulässigen
 *  Kennungen. */
const VARIANTE_WEG = "Diese Variante gibt es nicht mehr.";

/** Eine weitere Variante des Hauptteils anlegen — als Kopie der angezeigten
 *  (#201 AK 1/2, PC 1). `nameQuelle` benennt beim Anlegen der ZWEITEN die
 *  bisherige mit; ab der dritten bleibt es leer. */
export async function legeVarianteAn(
  trainingId: string,
  quelleVarianteId: string,
  name: string,
  nameQuelle?: string,
): Promise<{ ok: true; varianteId: string } | { ok: false; error: string }> {
  const r = await editorAktion(
    async (supabase, userId) => {
      const k = await legeVarianteAnImKern(supabase, userId, {
        trainingId,
        quelleVarianteId,
        name,
        nameQuelle,
      });
      return !k.ok && k.feld === "quelle_variante_id" ? { ...k, meldung: VARIANTE_WEG } : k;
    },
    { zusatz: (w) => ({ varianteId: w.variante.id }) },
  );
  // Ein Erfolg trägt die Kennung immer (`zusatz`), ein Fehlschlag immer eine
  // Meldung — der Typ lässt beides offen.
  return r.ok && r.varianteId
    ? { ok: true, varianteId: r.varianteId }
    : { ok: false, error: r.error ?? VARIANTE_NICHT_ANGELEGT };
}

/** Die Bezeichnung einer Variante ändern (#202). Die eigene zählt dabei nicht
 *  als vergeben. */
export async function benenneVariante(
  varianteId: string,
  name: string,
): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => benenneVarianteImKern(supabase, userId, { varianteId, name }),
    { nichtGefunden: NICHT_GEFUNDEN.variante },
  );
}

/** Eine Variante entfernen (#202) — samt ihren Übungen; bleibt genau eine
 *  übrig, wird sie aufgelöst (#209). Die letzte bleibt (Epic EK 6). */
export async function entferneVariante(varianteId: string): Promise<TrainingActionResult> {
  return editorAktion(
    (supabase, userId) => entferneVarianteImKern(supabase, userId, { varianteId }),
    { nichtGefunden: NICHT_GEFUNDEN.variante },
  );
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
  if (!variante) return { ok: false, error: NICHT_GEFUNDEN.variante };

  const { error } = await supabase.rpc("verschiebe_variante", {
    p_variante: varianteId,
    p_dir: dir,
  });
  if (error) return { ok: false, error: fehlerMeldung(error.message) };

  revalidiereTraining(variante.training_id);
  return { ok: true };
}
