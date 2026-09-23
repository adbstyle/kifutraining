import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTrainingPoolFuer,
  ladeTrainingDetail,
  type TrainingListRow,
} from "@/lib/queries/trainings-fuer";
import { trainingAuskunft, type TrainingAuskunft } from "@/lib/kern/auskunft";
import { hinweiseFuer, type Hinweis } from "@/lib/hinweise";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Trainings lesen (#193 AK 1/2, #195) — für die KI-Werkzeuge «training_abrufen»,
 * «trainings_suchen» und «training_hinweise». Dieselben Queries wie Editor, Ansicht und
 * Trainings-Übersicht (lib/queries/trainings-fuer.ts); was sichtbar ist,
 * entscheidet allein die RLS.
 *
 * Der Kern wirft nie: Die Queries werfen bei einem Datenbankfehler (so
 * erwartet es das Fehler-Rendering der Seiten), hier wird daraus `technisch`
 * — der Rohtext steht nur im Protokoll.
 */

const TECHNISCH = "Das Training liess sich gerade nicht lesen. Bitte versuche es noch einmal.";

async function ohneWurf<T>(was: string, f: () => Promise<T>): Promise<KernErgebnis<T>> {
  try {
    return ok(await f());
  } catch (e) {
    console.error(`[kern] ${was}:`, e instanceof Error ? e.message : e);
    return fehlschlag("technisch", TECHNISCH, { wiederholbar: true });
  }
}

/** Ein Training vollständig — jedes, das dieses Konto sieht: eigene, der
 *  eigenen Teams und fremde öffentliche (`bearbeitbar` sagt, welche davon es
 *  ändern darf). Unsichtbar heisst «nicht gefunden» (#193 OoS 7). */
export async function trainingAbrufen(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string },
): Promise<KernErgebnis<TrainingAuskunft>> {
  const detail = await ohneWurf("trainingAbrufen", () => ladeTrainingDetail(supabase, e.trainingId));
  if (!detail.ok) return detail;
  if (!detail.wert)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  return ok(trainingAuskunft(detail.wert, { userId }));
}

/** Die fachlichen Hinweise zu einem Training (#195) — zu jedem, das dieses
 *  Konto sieht, wie `trainingAbrufen`. Liest nur (PC 1). Was fehlt, damit es
 *  öffentlich werden darf, steht nur beim eigenen persönlichen Training dabei;
 *  alles Übrige ist eine Eigenschaft des Trainings und gilt für jeden Leser. */
export async function trainingHinweise(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string },
): Promise<KernErgebnis<{ hinweise: Hinweis[] }>> {
  const detail = await ohneWurf("trainingHinweise", () => ladeTrainingDetail(supabase, e.trainingId));
  if (!detail.ok) return detail;
  if (!detail.wert)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  return ok({ hinweise: hinweiseFuer(detail.wert, userId) });
}

export type TrainingsSuche = {
  /** `eigene`: die persönlichen Trainings dieses Kontos, Entwürfe
   *  eingeschlossen; `oeffentlich`: alle öffentlichen, auch die eigenen.
   *  Team-Trainings kommen mit #198. */
  bestand: "eigene" | "oeffentlich";
  q?: string;
  /** Alterskategorien, überlappend (ODER). */
  kategorien?: string[];
  limit: number;
};

/** Trainings suchen (#193 AK 2) — dieselbe Abfrage, Sortierung und
 *  Namenssuche wie die Trainings-Übersicht: ohne Suchtext nach Aktualität,
 *  mit Suchtext kürzere Namen zuerst. */
export async function trainingsSuchen(
  supabase: SupabaseClient,
  userId: string,
  e: TrainingsSuche,
): Promise<KernErgebnis<{ treffer: TrainingListRow[]; weitere: boolean }>> {
  // Eine Zeile mehr lesen als verlangt: nur so lässt sich «weitere» sagen,
  // ohne alles zu zählen.
  const rows = await ohneWurf("trainingsSuchen", () =>
    getTrainingPoolFuer(supabase, userId, {
      q: e.q?.trim() || undefined,
      stufen: e.kategorien,
      mine: e.bestand === "eigene",
      nurOeffentlich: e.bestand === "oeffentlich",
      limit: e.limit + 1,
    }),
  );
  if (!rows.ok) return rows;
  return ok({ treffer: rows.wert.slice(0, e.limit), weitere: rows.wert.length > e.limit });
}
