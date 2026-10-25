// Die Trainer:innen eines Termins in der Form der KI-Werkzeuge (Epic #518) —
// eine Quelle für jede Auskunft, die einen Termin oder eine Terminserie nennt
// («team_plan_abrufen», «training_abrufen», «trainings_suchen»).
//
// Eigenes Modul neben lib/trainer.ts, damit zod nicht in die Client-Bundles
// der Termin-Dialoge gerät.
//
// REIN: nur zod, lib/trainer und lib/besetzung — die Prüfskripte laden diese Datei mit tsx.
import { z } from "zod";
import type { SerienTrainer, TerminTrainer } from "@/lib/trainer";
import { BESETZUNG_ARTEN, BESETZUNG_MAX, BESETZUNG_MIN, type Mindestbesetzung } from "@/lib/besetzung";

/** Was jede Auskunft über die Trainer:innen sagt (#519 AK 23). */
export const TRAINER_MODELL =
  "«trainer» sind die eingeladenen Trainer:innen; sie gelten als dabei, bis sie absagen («abgesagt_am»: " +
  "wann, sonst null). Höchstens eine ist «verantwortlich» - sie bereitet den Termin vor und leitet ihn; " +
  "keine heisst: niemand verantwortlich. Wer verantwortlich wird, ist damit eingeladen und dabei.";

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
        abgesagt_am: z.string().nullable().describe("Wann abgesagt wurde (ISO); null: dabei."),
      }),
    )
    .describe(TRAINER_MODELL);
}

export function trainerAusgabe(trainer: readonly TerminTrainer[]): z.infer<ReturnType<typeof trainerSchema>> {
  return trainer.map((t) => ({
    id: t.userId,
    anzeigename: t.name,
    ehemalig: t.ehemalig,
    verantwortlich: t.verantwortlich,
    abgesagt_am: t.abgesagtAm,
  }));
}

/** Die Vorgabe einer Serie: wen sie einlädt und wer verantwortlich ist. */
export function serienTrainerSchema() {
  return z.array(z.object({ id: z.string(), anzeigename: z.string(), verantwortlich: z.boolean() }));
}

export function serienTrainerAusgabe(trainer: readonly SerienTrainer[]): z.infer<ReturnType<typeof serienTrainerSchema>> {
  return trainer.map((t) => ({ id: t.userId, anzeigename: t.name, verantwortlich: t.verantwortlich }));
}

/** Was jede Auskunft und jede Eingabe über die Mindestbesetzung sagt (#521 AK 11–13). */
export const BESETZUNG_MODELL =
  "«mindestbesetzung» ist, wie viele Trainer:innen mindestens dabei sein sollen: «art» «fest» = «zahl» Trainer:innen, " +
  "«verhaeltnis» = 1 Trainer:in je «zahl» Spieler:innen (kaufmännisch gerundet nach der Spielerzahl des Termins, " +
  `mindestens 1, sobald Spieler:innen da sind). «zahl» ist eine ganze Zahl von ${BESETZUNG_MIN} bis ${BESETZUNG_MAX}; null heisst keine.`;

export function besetzungSchema() {
  return z
    .object({ art: z.enum(BESETZUNG_ARTEN as ["fest", "verhaeltnis"]), zahl: z.number().int() })
    .nullable()
    .describe(BESETZUNG_MODELL);
}

/** Bewusst locker: Die Regeln prüft der Fachkern mit den Sätzen der Oberfläche. */
export const BesetzungEingabe = z
  .object({ art: z.string(), zahl: z.number() })
  .nullable()
  .describe(BESETZUNG_MODELL);

export function alsBesetzung(e: { art: string; zahl: number } | null | undefined): Mindestbesetzung | undefined {
  return e === undefined ? undefined : (e as Mindestbesetzung);
}
