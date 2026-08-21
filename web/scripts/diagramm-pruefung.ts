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
  POSEN_TYPEN,
  farbSlugs,
  type DiagrammData,
  type DiagrammElement,
  type SymbolTyp,
} from "../lib/diagramm";
import { symbolMasse } from "../components/diagramm/symbols";
import { haende } from "../components/diagramm/figur";

/** Begrenzungsrahmen eines Elements in Flächen-Koordinaten. */
function box(e: DiagrammElement): { x0: number; y0: number; x1: number; y1: number } | null {
  switch (e.art) {
    case "symbol": {
      // Gedrehte Symbole mit ihren gedrehten Massen prüfen, sonst geht eine
      // liegende Stange am Rand durch, obwohl ihr Ende hinausragt.
      const { breite, hoehe } = symbolMasse(e.typ, e.rotation);
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

/** Gehaltene Gegenstände (Leibchen) gehören an eine Hand. Geprüft wird die
 *  Beziehung, nicht die absolute Lage: liegt das Tuch nahe an einer Figur, muss
 *  es an deren Hand sitzen. Sonst löst eine globale Geometrie-Änderung (etwa
 *  eine korrigierte Ankerhöhe) gehaltene Gegenstände still von der Hand — genau
 *  das ist bei der Fusskorrektur passiert, ohne dass eine Prüfung anschlug. */
const HAND_TOLERANZ = 28;
const FIGUR_NAEHE = 120;

function leibchenProbleme(elemente: DiagrammElement[]): string[] {
  const figuren = elemente.filter(
    (e): e is Extract<DiagrammElement, { art: "symbol" }> =>
      e.art === "symbol" && (e.typ === "spieler" || e.typ === "torwart" || e.typ === "trainer"),
  );
  const probleme: string[] = [];
  for (const e of elemente) {
    if (e.art !== "symbol" || e.typ !== "leibchen") continue;
    let hand = Infinity;
    let figur = Infinity;
    for (const f of figuren) {
      const art = f.typ as "spieler" | "torwart" | "trainer";
      figur = Math.min(figur, Math.hypot(e.x - f.x, e.y - f.y));
      for (const h of haende(art, f.pose, f.spiegeln)) {
        hand = Math.min(hand, Math.hypot(e.x - (f.x + h.x), e.y - (f.y + h.y)));
      }
    }
    if (hand > HAND_TOLERANZ && figur < FIGUR_NAEHE) {
      probleme.push(
        `${e.id}: liegt ${Math.round(figur)} Einheiten neben einer Figur, aber ` +
          `${Math.round(hand)} von deren nächster Hand (Toleranz ${HAND_TOLERANZ}) — ` +
          `entweder an die Hand setzen oder deutlich ablegen`,
      );
    }
  }
  return probleme;
}

/** Tore öffnen ins Feld. Das Tor-Symbol öffnet bei rotation 0 nach unten, also
 *  gehört auf die Oberkante eines Feldes 0, auf die Unterkante 180, links 90 und
 *  rechts 270. Ohne Prüfung fällt das kaum auf — Minitore sehen von vorn und von
 *  hinten ähnlich aus —, gezeigt wird aber ein Tor, das vom Feld weg öffnet (so
 *  standen 18 Minitore an Unterkanten falsch, bis diese Regel sie fand).
 *  Als Feld gilt ein Rechteck ab FELD_MINDESTFLAECHE; kleine Zonen (Schusszone,
 *  Kiste) sind keine Feldkante. */
const FELD_MINDESTFLAECHE = 200_000;
const KANTEN_NAEHE = 45;

function torRichtungProbleme(elemente: DiagrammElement[]): string[] {
  const felder = elemente.filter(
    (e): e is Extract<DiagrammElement, { art: "form" }> =>
      e.art === "form" && e.form === "rechteck" && e.breite * e.hoehe >= FELD_MINDESTFLAECHE,
  );
  const tore = elemente.filter(
    (e): e is Extract<DiagrammElement, { art: "symbol" }> =>
      e.art === "symbol" && (e.typ === "tor" || e.typ === "minitor"),
  );
  const probleme: string[] = [];
  for (const f of felder) {
    for (const t of tore) {
      const rot = t.rotation ?? 0;
      const kanten: [string, boolean, number][] = [
        ["Oberkante", Math.abs(t.y - f.y) < KANTEN_NAEHE, 0],
        ["Unterkante", Math.abs(t.y - (f.y + f.hoehe)) < KANTEN_NAEHE, 180],
        ["linke Feldkante", Math.abs(t.x - f.x) < KANTEN_NAEHE, 90],
        ["rechte Feldkante", Math.abs(t.x - (f.x + f.breite)) < KANTEN_NAEHE, 270],
      ];
      const laengs = t.y >= f.y - 20 && t.y <= f.y + f.hoehe + 20;
      const quer = t.x >= f.x - 20 && t.x <= f.x + f.breite + 20;
      for (const [name, aufKante, soll] of kanten) {
        const passend = name.startsWith("Ober") || name.startsWith("Unter") ? quer : laengs;
        if (aufKante && passend && rot !== soll) {
          probleme.push(
            `${t.id}: steht auf der ${name} von ${f.id}, hat aber rotation ${rot} ` +
              `statt ${soll} — das Tor öffnet vom Feld weg`,
          );
        }
      }
    }
  }
  return [...new Set(probleme)];
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

  probleme.push(...leibchenProbleme(daten.elemente));
  probleme.push(...torRichtungProbleme(daten.elemente));

  const gesehen = new Set<string>();
  for (const e of daten.elemente) {
    if (gesehen.has(e.id)) probleme.push(`doppelte id: ${e.id}`);
    gesehen.add(e.id);

    if ("farbe" in e && e.farbe !== undefined && !(farbSlugs as string[]).includes(e.farbe)) {
      probleme.push(`${e.id}: unbekannte Farbe "${e.farbe}"`);
    }

    if (e.art === "pfad" && e.typ !== "linie") {
      // Farbe und Strichelung wertet nur die Linie aus; Laufweg, Dribbling und
      // Pass zeichnen in fester Optik (DiagrammView.PfadGrafik).
      if (e.farbe !== undefined) {
        probleme.push(`${e.id}: farbe "${e.farbe}" auf "${e.typ}" (wirkungslos)`);
      }
      if (e.gestrichelt !== undefined) {
        probleme.push(`${e.id}: gestrichelt auf "${e.typ}" (wirkungslos)`);
      }
    }

    if (e.art === "symbol") {
      if (!(SYMBOL_TYPEN as readonly string[]).includes(e.typ)) {
        probleme.push(`${e.id}: unbekannter Symbol-Typ "${e.typ}" (rendert als „?")`);
      } else {
        if (e.rotation !== undefined && e.rotation !== 0 && !DREHBARE_TYPEN.has(e.typ)) {
          probleme.push(`${e.id}: rotation ${e.rotation}° auf nicht drehbarem "${e.typ}" (wirkungslos)`);
        }
        if (e.pose !== undefined && !POSEN_TYPEN.has(e.typ as SymbolTyp)) {
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
