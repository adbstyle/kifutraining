import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { vokabular, werBinIch } from "@/lib/mcp/werkzeuge/konto";
import { uebungAbrufen, uebungenSuchen } from "@/lib/mcp/werkzeuge/uebungen";
import {
  trainingAnlegen,
  trainingUebungenFuerBlock,
  trainingUebungZuordnen,
} from "@/lib/mcp/werkzeuge/trainings";

/** Der vollständige Werkzeugsatz (Story #142; Epic #139 und #190 hängen ihre
 *  Werkzeuge hier an). Der Werkzeugsatz IST die Grenze eines Zugangs: das
 *  Token ist ein vollwertiges Konto-JWT, erreichbar ist aber nur, was in
 *  dieser Liste steht — und das muss durch `ZUGANG_DARF` (lib/mcp/umfang.ts)
 *  gedeckt sein, dem Umfang, dem der Trainer zugestimmt hat. */
export const WERKZEUGE = [
  werBinIch,
  vokabular,
  uebungenSuchen,
  uebungAbrufen,
  trainingAnlegen,
  trainingUebungenFuerBlock,
  trainingUebungZuordnen,
] as const;

export function registriereWerkzeuge(server: McpServer): void {
  WERKZEUGE.forEach((w) => w.registriere(server));
}
