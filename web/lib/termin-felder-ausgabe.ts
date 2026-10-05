// Die Felder eines Termins (#389) in der Form der KI-Werkzeuge — eine Quelle
// für jede Auskunft, die einen Termin nennt («team_plan_abrufen»,
// «training_abrufen», «trainings_suchen»; AK 13, 14), und für die Eingabe von
// «termin_festlegen» und «termin_aendern» (AK 12).
//
// Ausgabe wie gespeichert, nur der Untergrund als `Wert` (`{ slug, label }`),
// wie jede geführte Angabe (lib/mcp/bausteine.ts). Unbekanntes steht als
// `null` da, damit der Assistent «unbekannt» von «keine» unterscheiden kann.
//
// Eigenes Modul neben lib/termin-felder.ts, damit zod nicht in die
// Client-Bundles der Termin-Dialoge gerät.
//
// REIN: nur zod, lib/wert und lib/termin-felder — die Prüfskripte laden diese
// Datei mit tsx.
import { z } from "zod";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/feldmass";
import { Wert, wert } from "@/lib/wert";
import { UNTERGRUENDE, UNTERGRUND_LABEL, type Felder } from "@/lib/termin-felder";

/** Was jede Auskunft und jede Eingabe über die Felder sagt (#389 PO 1–5). */
export const FELDER_MODELL =
  "«felder» ist der Platz des Termins: ein oder mehrere getrennte Felder, die gleichzeitig " +
  "nutzbar sind und sich nicht zu einer grösseren Fläche zusammenlegen lassen. «laenge_m» und " +
  "«breite_m» sind die Fläche, die dem Team zur Verfügung steht (auf einem geteilten Platz nur " +
  "der eigene Teil), in ganzen Metern - Spielfelder darin steckt der Trainer selbst ab. «tore» " +
  "nennt je Torart, wie viele Tore auf dem Feld stehen: «minitor» (Minitore), «tor_5m» " +
  "(5-m-Tore), «tor_7m» (7-m-Tore); Hütchen- und Markierungstore zählen nicht. «untergrund»: " +
  `${UNTERGRUENDE.join(", ")}. null heisst unbekannt, 0 Tore heisst: keine Tore dieser Art. ` +
  "«felder: null» heisst, der Platz des Termins ist unbekannt.";

/** Das Ausgabe-Schema; `streng` nimmt `z.strictObject` auf allen Ebenen (siehe
 *  lib/kern/auskunft-schema.ts). */
export function felderSchema(streng = false) {
  const obj = streng ? z.strictObject : z.object;
  const W = streng ? z.strictObject(Wert.shape) : Wert;
  const Zahl = z.number().int().nullable();
  return z
    .array(
      obj({
        laenge_m: Zahl,
        breite_m: Zahl,
        tore: obj({ minitor: Zahl, tor_5m: Zahl, tor_7m: Zahl }),
        untergrund: W.nullable(),
      }),
    )
    .nullable()
    .describe(FELDER_MODELL);
}
export type FelderAusgabe = z.infer<ReturnType<typeof felderSchema>>;

export function felderAusgabe(felder: Felder | null): FelderAusgabe {
  return felder
    ? felder.map((f) => ({
        laenge_m: f.laenge_m,
        breite_m: f.breite_m,
        tore: { minitor: f.tore.minitor, tor_5m: f.tore.tor_5m, tor_7m: f.tore.tor_7m },
        untergrund: f.untergrund ? wert(UNTERGRUND_LABEL, f.untergrund) : null,
      }))
    : null;
}

/** Die Eingabe der Werkzeuge. Bewusst locker — Zahlen statt ganzer Zahlen,
 *  Text statt Enum: Die Regeln prüft der Fachkern (`felderProblem`) und weist
 *  mit denselben Sätzen ab wie die Oberfläche (AK 15). Fehlende Angaben sind
 *  unbekannt. */
const Anzahl = z.number().nullable().optional();
export const FelderEingabe = z
  .array(
    z.object({
      laenge_m: Anzahl.describe(`Länge in ganzen Metern, ${SPIELFELD_MIN} bis ${SPIELFELD_MAX}; nur zusammen mit «breite_m».`),
      breite_m: Anzahl.describe(`Breite in ganzen Metern, ${SPIELFELD_MIN} bis ${SPIELFELD_MAX}; nur zusammen mit «laenge_m».`),
      tore: z
        .object({ minitor: Anzahl, tor_5m: Anzahl, tor_7m: Anzahl })
        .nullable()
        .optional()
        .describe("Tore je Torart als ganze Zahl ab 0; weggelassen oder null = unbekannt, 0 = keine."),
      untergrund: z
        .string()
        .nullable()
        .optional()
        .describe(`Untergrund: ${UNTERGRUENDE.join(", ")}; weggelassen oder null = unbekannt.`),
    }),
  )
  .describe(FELDER_MODELL);
