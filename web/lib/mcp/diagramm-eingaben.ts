// Das Eingabeschema eines Feld-Diagramms für die KI-Werkzeuge (Story #145).
//
// Bewusst locker: Zod prüft nur, dass «elemente» eine Liste ist
// (lib/mcp/werkzeug.ts: nur Typ, Enum, Kennung). Jedes Element prüft der Kern
// über `pruefeDiagramm` — so nennt die Ablehnung jedes schlechte Element
// einzeln mit Pfad und Grund, statt dass das SDK beim ersten abbricht.
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";
import { FLAECHE, MAX_ELEMENTE } from "@/lib/diagramm";
import { ELEMENT_ERLAUBT } from "@/lib/diagramm-pruefung";

export const DiagrammEingabe = z
  .looseObject({ elemente: z.array(z.unknown()) })
  .describe(
    "Das Diagramm: {elemente: […]}. Jedes Element ist ein Objekt mit «id» (eindeutiger Text, etwa " +
      `«tor-oben») und «art»: ${Object.keys(ELEMENT_ERLAUBT).join(", ")}. Felder und alle zulässigen ` +
      `Werte nennt «diagramm_katalog_abrufen». Höchstens ${MAX_ELEMENTE} Elemente auf einer Fläche von ` +
      `${FLAECHE.breite}×${FLAECHE.hoehe} (0/0 oben links).`,
  );
