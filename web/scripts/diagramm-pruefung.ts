// Inhaltliche Prüfung gezeichneter Diagramme (data/diagramme/<slug>.json).
//
// Warum eigenständig neben `parseDiagramm`: der Parser ist die Trust-Boundary
// für DB-Inhalte und lässt unbekannte Symbol-Typen bewusst durch (#55 AK5,
// Fallback-Rendering) — ein Tippfehler im Typ oder eine unbekannte Farbe wäre
// damit „gültig" und fiele erst als „?"-Kreis bzw. schwarze Fläche im Browser
// auf. Für die von uns *verfassten* Vorlagen gilt der strengere Maßstab: jeder
// Typ, jede Farbe bekannt, alles auf der Zeichenfläche.
import {
  FLAECHE,
  MAX_ELEMENTE,
  SYMBOL_TYPEN,
  DREHBARE_TYPEN,
  farbSlugs,
  type DiagrammData,
  type DiagrammElement,
} from "../lib/diagramm";
import { symbolDef } from "../components/diagramm/symbols";

const FIGUREN = new Set(["spieler", "torwart"]);

/** Begrenzungsrahmen eines Elements in Flächen-Koordinaten. */
function box(e: DiagrammElement): { x0: number; y0: number; x1: number; y1: number } | null {
  switch (e.art) {
    case "symbol": {
      const { breite, hoehe } = symbolDef(e.typ);
      return { x0: e.x - breite / 2, y0: e.y - hoehe / 2, x1: e.x + breite / 2, y1: e.y + hoehe / 2 };
    }
    case "form": {
      const ecken = e.punkte?.length ? e.punkte : null;
      if (ecken) {
        return {
          x0: Math.min(...ecken.map((p) => p.x)), y0: Math.min(...ecken.map((p) => p.y)),
          x1: Math.max(...ecken.map((p) => p.x)), y1: Math.max(...ecken.map((p) => p.y)),
        };
      }
      return { x0: e.x, y0: e.y, x1: e.x + e.breite, y1: e.y + e.hoehe };
    }
    case "pfad":
      return {
        x0: Math.min(...e.punkte.map((p) => p.x)), y0: Math.min(...e.punkte.map((p) => p.y)),
        x1: Math.max(...e.punkte.map((p) => p.x)), y1: Math.max(...e.punkte.map((p) => p.y)),
      };
    case "text":
      return { x0: e.x, y0: e.y, x1: e.x, y1: e.y };
    default:
      return null;
  }
}

/** Alle Probleme eines Diagramms als lesbare Zeilen; leer = in Ordnung.
 *  `rohAnzahl` ist die Elementzahl VOR `parseDiagramm` — weicht sie ab, hat der
 *  Parser strukturell Kaputtes verworfen, was in einer Vorlage ein Fehler ist. */
export function diagrammProbleme(daten: DiagrammData, rohAnzahl?: number): string[] {
  const probleme: string[] = [];

  if (rohAnzahl !== undefined && rohAnzahl !== daten.elemente.length) {
    probleme.push(
      `${rohAnzahl - daten.elemente.length} Element(e) von parseDiagramm verworfen ` +
        `(strukturell ungültig: fehlende id/Koordinaten, unbekannte Pose oder Rotation)`,
    );
  }
  if (daten.elemente.length === 0) probleme.push("keine Elemente");
  if (daten.elemente.length > MAX_ELEMENTE) {
    probleme.push(`${daten.elemente.length} Elemente über MAX_ELEMENTE (${MAX_ELEMENTE})`);
  }

  const gesehen = new Set<string>();
  for (const e of daten.elemente) {
    if (gesehen.has(e.id)) probleme.push(`doppelte id: ${e.id}`);
    gesehen.add(e.id);

    if ("farbe" in e && e.farbe !== undefined && !(farbSlugs as string[]).includes(e.farbe)) {
      probleme.push(`${e.id}: unbekannte Farbe "${e.farbe}"`);
    }

    if (e.art === "symbol") {
      if (!(SYMBOL_TYPEN as readonly string[]).includes(e.typ)) {
        probleme.push(`${e.id}: unbekannter Symbol-Typ "${e.typ}" (rendert als „?")`);
      } else {
        if (e.rotation !== undefined && e.rotation !== 0 && !DREHBARE_TYPEN.has(e.typ)) {
          probleme.push(`${e.id}: rotation ${e.rotation}° auf nicht drehbarem "${e.typ}" (wirkungslos)`);
        }
        if (e.pose !== undefined && !FIGUREN.has(e.typ)) {
          probleme.push(`${e.id}: pose "${e.pose}" auf "${e.typ}" (wirkungslos)`);
        }
      }
    }

    const b = box(e);
    if (b && (b.x0 < 0 || b.y0 < 0 || b.x1 > FLAECHE.breite || b.y1 > FLAECHE.hoehe)) {
      probleme.push(
        `${e.id}: ragt über die Zeichenfläche hinaus ` +
          `(${Math.round(b.x0)}..${Math.round(b.x1)} / ${Math.round(b.y0)}..${Math.round(b.y1)})`,
      );
    }
  }
  return probleme;
}
