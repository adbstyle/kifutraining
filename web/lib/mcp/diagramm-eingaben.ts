// Ein- und Ausgabeschema eines Feld-Diagramms für die KI-Werkzeuge (Stories
// #145, #146).
//
// Die Eingabe ist bewusst locker: Zod prüft nur, dass «elemente» eine Liste ist
// (lib/mcp/werkzeug.ts: nur Typ, Enum, Kennung). Jedes Element prüft der Kern
// über `pruefeDiagramm` — so nennt die Ablehnung jedes schlechte Element
// einzeln mit Pfad und Grund, statt dass das SDK beim ersten abbricht.
//
// Die Mängel (#146) reisen im Erfolg, nie als Fehler — wie die Hinweise eines
// Trainings (#195).
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";
import { FLAECHE, MAX_ELEMENTE } from "@/lib/diagramm";
import { BEFUND_CODES, ELEMENT_ERLAUBT, type Befund, type BefundCode } from "@/lib/diagramm-pruefung";

export const DiagrammEingabe = z
  .looseObject({ elemente: z.array(z.unknown()) })
  .describe(
    "Das Diagramm: {elemente: […]}. Jedes Element ist ein Objekt mit «id» (eindeutiger Text, etwa " +
      `«tor-oben») und «art»: ${Object.keys(ELEMENT_ERLAUBT).join(", ")}. Felder und alle zulässigen ` +
      `Werte nennt «diagramm_katalog_abrufen». Höchstens ${MAX_ELEMENTE} Elemente auf einer Fläche von ` +
      `${FLAECHE.breite}×${FLAECHE.hoehe} (0/0 oben links).`,
  );

/** Was jeder Code bedeutet — für die Beschreibung der Werkzeuge. */
export const MANGEL_ERKLAERT: Record<BefundCode, string> = {
  aufbau: "das Diagramm oder ein Element ist nicht so aufgebaut, wie KiFu es liest",
  unbekannt: "ein Typ, eine Farbe, eine Drehung oder eine Pose, die KiFu nicht kennt (erscheint als «?»)",
  wert: "ein Wert in falscher Form, etwa eine Koordinate, die keine Zahl ist",
  id: "eine Kennung fehlt oder steht doppelt",
  anzahl: "mehr Elemente, als ein Diagramm führen kann",
  ausserhalb: "ein Element liegt ausserhalb der Zeichenfläche",
  leibchen: "ein Leibchen liegt neben einer Figur, aber nicht an ihrer Hand",
  tor_richtung: "ein Tor an einer Feldkante öffnet vom Feld weg",
  wirkungslos: "eine Angabe, die am Element nicht vorgesehen ist — eine unbekannte speichert KiFu gar nicht",
  ragt_hinaus: "die Mitte eines Symbols liegt auf der Fläche, sein Rahmen ragt über den Rand",
  text_leer: "ein Text ohne Inhalt",
};

/** Ein Befund, wie ihn der Assistent liest. */
export const MangelAusgabe = z.object({
  code: z.enum(BEFUND_CODES),
  element_id: z.string().optional().describe("Die «id» des Elements, soweit lesbar."),
  stelle: z.string().optional().describe("Die Stelle in «elemente», etwa «elemente[3]»."),
  angabe: z.string().optional().describe("Die betroffene Angabe am Element, etwa «rotation»."),
  meldung: z.string().describe("Was nicht stimmt und wie es sich beheben lässt."),
  zulaessig: z.array(z.string()).optional(),
});

export function alsMangel(b: Befund): z.infer<typeof MangelAusgabe> {
  return {
    code: b.code,
    ...(b.element !== undefined && { element_id: b.element }),
    ...(b.index !== undefined && { stelle: `elemente[${b.index}]` }),
    ...(b.angabe !== undefined && { angabe: b.angabe }),
    meldung: b.meldung,
    ...(b.zulaessig && { zulaessig: [...b.zulaessig] }),
  };
}
