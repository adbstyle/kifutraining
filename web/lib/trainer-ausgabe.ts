// Die Trainer:innen eines Termins in der Form der KI-Werkzeuge (Epic #518) —
// eine Quelle für jede Auskunft, die einen Termin oder eine Terminserie nennt
// («team_plan_abrufen», «training_abrufen», «trainings_suchen»).
//
// Eigenes Modul neben lib/trainer.ts, damit zod nicht in die Client-Bundles
// der Termin-Dialoge gerät.
//
// REIN: nur zod und lib/trainer — die Prüfskripte laden diese Datei mit tsx.
import { z } from "zod";
import type { SerienTrainer, TerminTrainer } from "@/lib/trainer";

/** Was jede Auskunft über die Trainer:innen sagt (#519 AK 23). */
export const TRAINER_MODELL =
  "«trainer» sind die eingeladenen Trainer:innen; sie gelten als dabei. Höchstens eine ist " +
  "«verantwortlich» - sie bereitet den Termin vor und leitet ihn; keine heisst: niemand " +
  "verantwortlich. Wer verantwortlich wird, ist damit eingeladen.";

/** Das Ausgabe-Schema; `streng` nimmt `z.strictObject` (siehe lib/kern/auskunft-schema.ts). */
export function trainerSchema(streng = false) {
  const obj = streng ? z.strictObject : z.object;
  return z
    .array(
      obj({
        id: z.string().nullable().describe("Kennung des Mitglieds; null bei einem gelöschten Konto."),
        anzeigename: z.string().nullable(),
        ehemalig: z.boolean().describe("Nicht mehr im Team."),
        verantwortlich: z.boolean(),
      }),
    )
    .describe(TRAINER_MODELL);
}

export function trainerAusgabe(trainer: readonly TerminTrainer[]): z.infer<ReturnType<typeof trainerSchema>> {
  return trainer.map((t) => ({ id: t.userId, anzeigename: t.name, ehemalig: t.ehemalig, verantwortlich: t.verantwortlich }));
}

/** Die Vorgabe einer Serie: wen sie einlädt und wer verantwortlich ist. */
export function serienTrainerSchema() {
  return z.array(z.object({ id: z.string(), anzeigename: z.string(), verantwortlich: z.boolean() }));
}

export function serienTrainerAusgabe(trainer: readonly SerienTrainer[]): z.infer<ReturnType<typeof serienTrainerSchema>> {
  return trainer.map((t) => ({ id: t.userId, anzeigename: t.name, verantwortlich: t.verantwortlich }));
}
