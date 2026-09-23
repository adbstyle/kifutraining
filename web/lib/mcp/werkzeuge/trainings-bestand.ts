import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { kopiereTrainingNach } from "@/lib/kern/kopie";
import { loescheTraining } from "@/lib/kern/loeschen";
import { KENNUNG_FEHLER, TrainingId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Ein Training übernehmen und ein eigenes löschen (Story #197).
 *
 * Dünne Adapter über den Fachkern (lib/kern/kopie.ts, lib/kern/loeschen.ts)
 * — dieselben Funktionen wie «Übernehmen» und «Löschen» in der Oberfläche.
 * Ins Team übernehmen kommt mit #198 (`team_id`); bis dahin entsteht die
 * Kopie immer im persönlichen Bestand.
 */

/** Wohin die Kopie ging. Die Team-Form ist bereits beschrieben, weil der Kern
 *  sie kennt; dieses Werkzeug liefert vorerst nur «persoenlich». */
const KopieZielAusgabe = z.discriminatedUnion("art", [
  z.object({ art: z.literal("persoenlich") }),
  z.object({ art: z.literal("team"), team: z.object({ id: z.string(), name: z.string() }) }),
]);

// ── training_kopieren ───────────────────────────────────────────────────────

export const trainingKopieren = werkzeug({
  name: "training_kopieren",
  titel: "Training übernehmen",
  beschreibung:
    "Übernimmt ein Training als eigenständige Kopie in deinen persönlichen Bestand: samt " +
    "allen Übungen, Bildern, Diagrammen, Gruppen, Durchlauf, Notizen, Dauern, Ziel und allen " +
    "Varianten des Hauptteils, in derselben Altersstufe. Die Kopie ist ein privater Entwurf " +
    "ohne Verbindung zur Quelle; die Quelle bleibt unberührt, und woraus die Kopie hervorging, " +
    "wird nicht festgehalten. Übernehmen lässt sich jedes Training, das du lesen kannst — ein " +
    "öffentliches der Community (etwa aus «trainings_suchen» mit «bestand: oeffentlich») oder " +
    "ein eigenes, das dann eine zweite, unabhängige Fassung bekommt —, und dasselbe Training " +
    "beliebig oft; jede Kopie hat ihre eigene Kennung. Scheitert das Kopieren mit einer " +
    "Meldung, räumt KiFu weg, was schon entstanden war, und «hinweis» sagt, dass nichts " +
    "entstanden ist (dann ist ein Wiederholen gefahrlos) — oder, falls auch das Aufräumen " +
    "scheiterte, welche unvollständige Kopie stehen blieb. Bricht der Vorgang dagegen ohne " +
    "Meldung ab — durch eine Zeitüberschreitung oder einen Absturz mitten im Kopieren —, kann " +
    "eine unvollständige Kopie stehen bleiben, die nicht als unfertig erkennbar ist, oder die " +
    "Kopie ist vollständig entstanden, ohne dass du davon erfährst. Prüfe dann vorher und " +
    "nachher mit «trainings_suchen» (bestand: eigene), bevor du es noch einmal versuchst. " +
    KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: z.object({
    /** Kennung der neuen Kopie — für alle Bearbeitungs-Werkzeuge. */
    training_id: z.string(),
    ziel: KopieZielAusgabe,
    url: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await kopiereTrainingNach(zugang.supabase, zugang.userId, { quelleId: e.training_id }),
      (w) => ({ training_id: w.id, ziel: w.ziel, url: zugang.url("training", w.id, "edit") }),
    ),
});

// ── training_loeschen ───────────────────────────────────────────────────────

export const trainingLoeschen = werkzeug({
  name: "training_loeschen",
  titel: "Training löschen",
  beschreibung:
    "Löscht ein eigenes Training oder eines deiner Teams sofort und ohne Rückfrage, samt " +
    "allen Übungen, Bildern, Gruppen, Varianten und einem angesetzten Termin. Was mitgeht, " +
    "zeigt vorher «training_abrufen» («uebungen_gesamt», «sichtbarkeit»); das Ergebnis nennt " +
    "es noch einmal. Ein öffentliches Training verschwindet damit zugleich aus dem " +
    "öffentlichen Bestand. Kopien, die andere bereits übernommen haben, bleiben bestehen — " +
    "sie sind eigenständige Trainings. Wiederherstellen lässt sich ein gelöschtes Training " +
    `nicht. Ein fremdes Training lässt sich nicht löschen. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: z.object({
    name: z.string(),
    /** Zahl der Übungen über alle Varianten, die mitgingen. */
    uebungen: z.number().int(),
    war_oeffentlich: z.boolean(),
    termin_entfiel: z.boolean(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await loescheTraining(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (w) => ({
        name: w.name,
        uebungen: w.uebungen,
        war_oeffentlich: w.warOeffentlich,
        termin_entfiel: w.terminEntfiel,
      }),
    ),
});
