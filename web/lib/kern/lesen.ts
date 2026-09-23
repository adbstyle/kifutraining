import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTeamTrainingsFuer,
  getTrainingPoolFuer,
  ladeTrainingDetail,
  type TrainingListRow,
} from "@/lib/queries/trainings-fuer";
import { getTerminZuTrainingFuer } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { trainingAuskunft, type TrainingAuskunft } from "@/lib/kern/auskunft";
import { hinweiseFuer, type Hinweis } from "@/lib/hinweise";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Trainings lesen (#193 AK 1/2, #195, #198 AK 2) — für die KI-Werkzeuge «training_abrufen»,
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
  // Termine tragen nur Team-Trainings (Trigger `termin_nur_fuer_team_trainings`)
  // — bei persönlichen spart das die Abfrage.
  const d = detail.wert;
  const termin = d.team
    ? await ohneWurf("trainingAbrufen/termin", () => getTerminZuTrainingFuer(supabase, d.id))
    : ok(null);
  if (!termin.ok) return termin;
  return ok(trainingAuskunft(d, { userId, termin: termin.wert, heute: heuteAmTrainingsort() }));
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
   *  eingeschlossen; `oeffentlich`: alle öffentlichen, auch die eigenen;
   *  `team`: der Bestand eines eigenen Teams (#198 AK 2), dann mit `teamId`. */
  bestand: "eigene" | "oeffentlich" | "team";
  /** Pflicht bei `bestand: "team"`, sonst ohne Bedeutung. */
  teamId?: string;
  q?: string;
  /** Alterskategorien, überlappend (ODER). */
  kategorien?: string[];
  limit: number;
};

/** Der Termin eines Team-Trainings im Suchtreffer (#198 AK 2/3). */
export type TrefferTermin = {
  id: string;
  datum: string;
  beginn: string | null;
  ort: string | null;
  bemerkung: string | null;
  /** Heute oder später, am Trainingsort — wie der Plan teilt. */
  anstehend: boolean;
};

/** Ein Suchtreffer; `termin` nur im Team-Bestand (dort `null` ohne Termin). */
export type TrainingsTreffer = TrainingListRow & { termin?: TrefferTermin | null };

/** Trainings suchen (#193 AK 2, #198 AK 2) — dieselbe Abfrage, Sortierung und
 *  Namenssuche wie die Trainings-Übersicht bzw. der Team-Bestand: ohne
 *  Suchtext nach Aktualität, mit Suchtext kürzere Namen zuerst. */
export async function trainingsSuchen(
  supabase: SupabaseClient,
  userId: string,
  e: TrainingsSuche,
): Promise<KernErgebnis<{ treffer: TrainingsTreffer[]; weitere: boolean }>> {
  const q = e.q?.trim() || undefined;
  // Eine Zeile mehr lesen als verlangt: nur so lässt sich «weitere» sagen,
  // ohne alles zu zählen.
  const grenze = e.limit + 1;

  if (e.bestand === "team") {
    if (!e.teamId)
      return fehlschlag("eingabe", "Für den Team-Bestand die Kennung des Teams angeben.", {
        feld: "team_id",
      });
    // Vorab: ein fremdes Team hiesse sonst still «keine Treffer» (#198 AK 11).
    const team = await pruefeTeamMitglied(supabase, e.teamId);
    if (!team.ok) return team;
    const rows = await ohneWurf("trainingsSuchen/team", () =>
      getTeamTrainingsFuer(supabase, e.teamId!, { q, stufen: e.kategorien, limit: grenze }),
    );
    if (!rows.ok) return rows;
    const heute = heuteAmTrainingsort();
    const treffer = rows.wert.slice(0, e.limit).map(({ termin, ...t }) => ({
      ...t,
      termin: termin ? { ...termin, anstehend: termin.datum >= heute } : null,
    }));
    return ok({ treffer, weitere: rows.wert.length > e.limit });
  }

  const rows = await ohneWurf("trainingsSuchen", () =>
    getTrainingPoolFuer(supabase, userId, {
      q,
      stufen: e.kategorien,
      mine: e.bestand === "eigene",
      nurOeffentlich: e.bestand === "oeffentlich",
      limit: grenze,
    }),
  );
  if (!rows.ok) return rows;
  return ok({ treffer: rows.wert.slice(0, e.limit), weitere: rows.wert.length > e.limit });
}
