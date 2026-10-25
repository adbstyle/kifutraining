import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { vokabular, werBinIch } from "@/lib/mcp/werkzeuge/konto";
import { uebungAbrufen, uebungenSuchen } from "@/lib/mcp/werkzeuge/uebungen";
import {
  uebungAendern,
  uebungAnlegen,
  uebungAufEntwurfSetzen,
  uebungKopieren,
  uebungVeroeffentlichen,
} from "@/lib/mcp/werkzeuge/uebungen-bearbeiten";
import {
  diagrammKatalogAbrufen,
  uebungDiagrammMaengelAbrufen,
  uebungDiagrammSetzen,
} from "@/lib/mcp/werkzeuge/diagramm";
import {
  trainingAnlegen,
  trainingUebungenFuerBlock,
  trainingUebungZuordnen,
} from "@/lib/mcp/werkzeuge/trainings";
import { trainingAbrufen, trainingsSuchen } from "@/lib/mcp/werkzeuge/trainings-lesen";
import {
  trainingAufEntwurfSetzen,
  trainingKategorienSetzen,
  trainingUebungDauerSetzen,
  trainingUebungEntfernen,
  trainingUebungenOrdnen,
  trainingUebungNotizSetzen,
  trainingUmbenennen,
  trainingVeroeffentlichen,
  trainingZielSetzen,
} from "@/lib/mcp/werkzeuge/trainings-bearbeiten";
import {
  gruppeAnlegen,
  gruppeEntfernen,
  gruppeUmbenennen,
  trainingDurchlaufAbrufen,
  trainingUebungDurchlaufSetzen,
} from "@/lib/mcp/werkzeuge/gruppen";
import {
  varianteAnlegen,
  varianteEntfernen,
  varianteUmbenennen,
  variantenOrdnen,
} from "@/lib/mcp/werkzeuge/varianten";
import { trainingHinweiseAbrufen } from "@/lib/mcp/werkzeuge/hinweise";
import { trainingKopieren, trainingLoeschen } from "@/lib/mcp/werkzeuge/trainings-bestand";
import {
  teamPlanAbrufen,
  teamMitgliederAbrufen,
  teamsAbrufen,
  terminAendern,
  terminEntfernen,
  terminDerSerieFolgen,
  terminTrainerAendern,
  terminTrainerAbsagen,
  terminAusfallenLassen,
  terminAusfallZuruecknehmen,
  terminFestlegen,
  terminserieFestlegen,
  trainingLoesen,
  trainingZuordnen,
} from "@/lib/mcp/werkzeuge/team";
import {
  abholadresseErneuern,
  selbstabholungAbrufen,
  selbstabholungSchalten,
  spielerAendern,
  spielerAufnehmen,
  spielerEntfernen,
  spielerLinkAbrufen,
  spielerLinkErneuern,
  spielerlisteAbrufen,
  terminAbmeldungSetzen,
  terminAnwesenheitSetzen,
  terminAufgebotSetzen,
  terminSpielerAbrufen,
} from "@/lib/mcp/werkzeuge/spieler";
import {
  kaderAbrufen,
  kaderAnlegen,
  kaderEntfernen,
  kaderHerausnehmen,
  kaderUmbenennen,
  kaderZuteilen,
} from "@/lib/mcp/werkzeuge/kader";

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
  uebungAnlegen,
  uebungAendern,
  uebungVeroeffentlichen,
  uebungAufEntwurfSetzen,
  uebungKopieren,
  diagrammKatalogAbrufen,
  uebungDiagrammSetzen,
  uebungDiagrammMaengelAbrufen,
  trainingAnlegen,
  trainingUebungenFuerBlock,
  trainingUebungZuordnen,
  trainingAbrufen,
  trainingsSuchen,
  trainingUmbenennen,
  trainingZielSetzen,
  trainingKategorienSetzen,
  trainingUebungEntfernen,
  trainingUebungenOrdnen,
  trainingUebungDauerSetzen,
  trainingUebungNotizSetzen,
  gruppeAnlegen,
  gruppeUmbenennen,
  gruppeEntfernen,
  trainingUebungDurchlaufSetzen,
  trainingDurchlaufAbrufen,
  varianteAnlegen,
  varianteUmbenennen,
  varianteEntfernen,
  variantenOrdnen,
  trainingHinweiseAbrufen,
  trainingVeroeffentlichen,
  trainingAufEntwurfSetzen,
  trainingKopieren,
  trainingLoeschen,
  teamsAbrufen,
  teamPlanAbrufen,
  teamMitgliederAbrufen,
  terminFestlegen,
  terminAendern,
  terminEntfernen,
  terminserieFestlegen,
  terminDerSerieFolgen,
  terminTrainerAendern,
  terminTrainerAbsagen,
  terminAusfallenLassen,
  terminAusfallZuruecknehmen,
  trainingZuordnen,
  trainingLoesen,
  spielerlisteAbrufen,
  spielerAufnehmen,
  spielerAendern,
  spielerEntfernen,
  terminSpielerAbrufen,
  terminAbmeldungSetzen,
  terminAufgebotSetzen,
  terminAnwesenheitSetzen,
  spielerLinkAbrufen,
  spielerLinkErneuern,
  selbstabholungAbrufen,
  selbstabholungSchalten,
  abholadresseErneuern,
  kaderAbrufen,
  kaderAnlegen,
  kaderUmbenennen,
  kaderEntfernen,
  kaderZuteilen,
  kaderHerausnehmen,
] as const;

export function registriereWerkzeuge(server: McpServer): void {
  WERKZEUGE.forEach((w) => w.registriere(server));
}
