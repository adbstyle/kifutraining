// Der Aufruf des Gesprächsmodells (Epic #541): Claude Haiku direkt bei
// Anthropic, ohne Streaming — eine Antwort ist wenige Sätze lang und kommt
// in der Regel innert 3 Sekunden (PO 22). Jede Antwort ist strukturiert: der
// Text an die Person und, sobald das Modell genug weiss, die Zusammenfassung.
//
// Scheitert der Aufruf — kein Schlüssel, Ausfall, Ausgabenlimit erreicht,
// eine Ablehnung oder eine unbrauchbare Antwort —, gibt es `null`; die
// Oberfläche zeigt dann die allgemeine Meldung (PO 10).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { systemBloecke, type Lage } from "./prompt";
import {
  ANTWORT_MAX,
  BEZEICHNUNG_MAX,
  EINORDNUNGEN,
  mitEinerFrage,
  PUNKT_TEXT_MAX,
  PUNKTE_MAX,
  TITEL_MAX,
  zusammenfassungSchema,
  type Nachricht,
  type Zusammenfassung,
} from "./regeln";

const MODELL = "claude-haiku-5-5";

/* Die Form, die das Modell liefern muss. Ohne Längen- und Mengengrenzen:
   Die prüft `zusammenfassungSchema` danach, damit eine zu lange Antwort
   gekürzt statt verworfen werden kann.

   Die Rückfrage steht in einem eigenen Feld: Als Fliesstext hielt sich Haiku
   weder an «genau eine Frage» noch an «Rückfrage oder Zusammenfassung, nie
   beides» (Staging-Test 2026-10-28). Getrennt setzt der Server beides durch. */
const antwortFormat = z.object({
  antwort: z.string(),
  rueckfrage: z.string().nullable(),
  zusammenfassung: z
    .object({
      einordnung: z.enum(EINORDNUNGEN),
      titel: z.string(),
      punkte: z.array(z.object({ bezeichnung: z.string(), text: z.string() })),
    })
    .nullable(),
});

export type KiAntwort = { antwort: string; zusammenfassung: Zusammenfassung | null };

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  const key = env.anthropicApiKey();
  if (!key) return null;
  // Lieber früh aufgeben als die Person warten lassen: ein Versuch mehr,
  // höchstens 20 Sekunden je Versuch.
  client ??= new Anthropic({ apiKey: key, timeout: 20_000, maxRetries: 1 });
  return client;
}

/** Ob der Dialog überhaupt möglich ist — ohne Schlüssel beginnt keiner. */
export function kiVerfuegbar(): boolean {
  return env.anthropicApiKey() !== null;
}

/** Die nächste Antwort auf `verlauf` (endet mit der neuen Nachricht der
 *  Person), oder `null`, wenn der Dialog gerade nicht möglich ist. */
export async function naechsteAntwort(verlauf: Nachricht[], lage: Lage): Promise<KiAntwort | null> {
  const ki = anthropic();
  if (!ki) return null;
  try {
    const r = await ki.messages.parse({
      model: MODELL,
      max_tokens: 1500,
      // Ohne Nachdenken: Die Antworten sind kurz, und es zählt das Tempo.
      thinking: { type: "disabled" },
      output_config: { effort: "medium", format: zodOutputFormat(antwortFormat) },
      system: systemBloecke(lage),
      messages: verlauf.map((n) => ({
        role: n.von === "person" ? ("user" as const) : ("assistant" as const),
        content: n.text,
      })),
    });
    const roh = r.parsed_output;
    if (r.stop_reason !== "end_turn" || !roh) return null;
    const { text, gefragt } = mitEinerFrage(roh.antwort, roh.rueckfrage, roh.zusammenfassung !== null);
    const antwort = text.slice(0, ANTWORT_MAX);
    if (!antwort) return null;
    // Wer noch fragt, fasst nicht zusammen: Sonst zählten die Korrekturen ab
    // einer Karte, die noch nicht fertig ist.
    const z = !gefragt && roh.zusammenfassung ? zusammenfassungSchema.safeParse(gekuerzt(roh.zusammenfassung)) : null;
    return { antwort, zusammenfassung: z?.success ? z.data : null };
  } catch (e) {
    // Ausfall, Zeitüberschreitung, Ausgabenlimit (400/429): für die Person
    // dasselbe. Für den Betreiber im Funktions-Log — ohne Inhalt des Gesprächs.
    console.error("Feedback-Dialog: KI-Aufruf gescheitert", e instanceof Anthropic.APIError ? e.status : e);
    return null;
  }
}

/** Kürzt, was über die Grenzen der Zusammenfassung ginge, statt sie zu verwerfen. */
function gekuerzt(z: z.infer<typeof antwortFormat>["zusammenfassung"] & object) {
  return {
    einordnung: z.einordnung,
    titel: z.titel.trim().slice(0, TITEL_MAX),
    punkte: z.punkte
      .slice(0, PUNKTE_MAX)
      .map((p) => ({
        bezeichnung: p.bezeichnung.trim().slice(0, BEZEICHNUNG_MAX),
        text: p.text.trim().slice(0, PUNKT_TEXT_MAX),
      }))
      .filter((p) => p.bezeichnung && p.text),
  };
}
