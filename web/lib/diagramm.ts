/**
 * Datenmodell des Spielfeld-Diagramms (Epic #47).
 *
 * Single Source für Editor (Client), Anzeige (Server) und Autosave-Action.
 * Die Geometrie der Symbole lebt bewusst NICHT hier, sondern im Symbol-
 * Register (components/diagramm/symbols.tsx) — Elemente speichern nur
 * Typ/Position/Rotation/Farbe, damit zentrale Symbol-Updates bestehende
 * Diagramme nie verschieben (Decision Record Spike #48, Gate 1+3).
 */

/** Logische Zeichenfläche: 16:10 wie die SFV-Manual-Diagramme. */
export const FLAECHE = { breite: 1600, hoehe: 1000 } as const;

/** Aktuelle Strukturversion gespeicherter Diagramme. */
export const DIAGRAMM_VERSION = 1;

/** Farbpalette für färbbare Elemente (Pylonen, Teller, Stangen, Linien, Zonen,
 *  Spieler-Teams). Slugs werden gespeichert, Hex nur gerendert. */
export const FARBEN = {
  rot: "#d32f2f",
  blau: "#1565c0",
  gelb: "#f9a825",
  gruen: "#2e7d32",
  orange: "#ef6c00",
  weiss: "#ffffff",
  schwarz: "#212121",
} as const;
export type FarbSlug = keyof typeof FARBEN;
export const farbSlugs = Object.keys(FARBEN) as FarbSlug[];

/** Gegenständliche Symbole (Story #50). */
export const SYMBOL_TYPEN = [
  "tor",
  "minitor",
  "pylone",
  "teller",
  "stange",
  "reifen",
  "huerde",
  "spieler",
  "torwart",
  "fussball",
  "handball",
  "tennisball",
] as const;
export type SymbolTyp = (typeof SYMBOL_TYPEN)[number];

/** Richtungsbehaftete Elemente: genau diese sind drehbar (Story #51). */
export const DREHBARE_TYPEN: ReadonlySet<SymbolTyp> = new Set([
  "tor",
  "minitor",
  "spieler",
  "torwart",
  "huerde",
]);

/** Acht feste Orientierungen in 45°-Schritten (Story #51). */
export const ROTATIONEN = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type Rotation = (typeof ROTATIONEN)[number];

/** Bewegungs- und Linien-Typen (Story #52). */
export const PFAD_TYPEN = ["laufweg", "dribbling", "pass", "linie"] as const;
export type PfadTyp = (typeof PFAD_TYPEN)[number];

export const ZONEN_FORMEN = ["rechteck", "ellipse", "dreieck", "polygon"] as const;
export type ZonenForm = (typeof ZONEN_FORMEN)[number];

export type Punkt = { x: number; y: number };

export type SymbolElement = {
  id: string;
  art: "symbol";
  typ: SymbolTyp;
  x: number;
  y: number;
  rotation?: Rotation;
  farbe?: FarbSlug;
};

export type PfadElement = {
  id: string;
  art: "pfad";
  typ: PfadTyp;
  punkte: Punkt[];
  farbe?: FarbSlug;
  gestrichelt?: boolean; // nur für typ "linie"
};

export type ZoneElement = {
  id: string;
  art: "zone";
  form: ZonenForm;
  /** rechteck/ellipse/dreieck: Begrenzungsrahmen; polygon: punkte. */
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  punkte?: Punkt[];
  farbe?: FarbSlug;
};

export type TextElement = {
  id: string;
  art: "text";
  x: number;
  y: number;
  text: string;
};

export type DiagrammElement =
  | SymbolElement
  | PfadElement
  | ZoneElement
  | TextElement;

export type DiagrammData = {
  version: number;
  elemente: DiagrammElement[];
};

export const LEERES_DIAGRAMM: DiagrammData = {
  version: DIAGRAMM_VERSION,
  elemente: [],
};

const istZahl = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const istPunkt = (v: unknown): v is Punkt =>
  !!v && typeof v === "object" && istZahl((v as Punkt).x) && istZahl((v as Punkt).y);

/** Defensive Prüfung eines Elements aus der DB. Unbekannte Symbol-Typen sind
 *  ERLAUBT (Fallback-Rendering, #55 AK5) — nur strukturell Kaputtes fliegt raus. */
function istElement(v: unknown): v is DiagrammElement {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  if (typeof e.id !== "string") return false;
  switch (e.art) {
    case "symbol":
      return typeof e.typ === "string" && istZahl(e.x) && istZahl(e.y);
    case "pfad":
      return (
        typeof e.typ === "string" &&
        Array.isArray(e.punkte) &&
        e.punkte.length >= 2 &&
        e.punkte.every(istPunkt)
      );
    case "zone":
      return (
        typeof e.form === "string" &&
        istZahl(e.x) && istZahl(e.y) && istZahl(e.breite) && istZahl(e.hoehe) &&
        (e.punkte === undefined ||
          (Array.isArray(e.punkte) && e.punkte.every(istPunkt)))
      );
    case "text":
      return istZahl(e.x) && istZahl(e.y) && typeof e.text === "string";
    default:
      return false;
  }
}

/** JSONB aus der DB -> validiertes Diagramm; null bei fehlender/kaputter
 *  Struktur. Kaputte Einzel-Elemente werden übersprungen, nie das Ganze. */
export function parseDiagramm(json: unknown): DiagrammData | null {
  if (!json || typeof json !== "object") return null;
  const d = json as Record<string, unknown>;
  if (!istZahl(d.version) || !Array.isArray(d.elemente)) return null;
  return { version: d.version, elemente: d.elemente.filter(istElement) };
}

/** Hat die Übung ein anzeigbares Diagramm? */
export function hatDiagramm(json: unknown): boolean {
  const d = parseDiagramm(json);
  return !!d && d.elemente.length > 0;
}

/** Effektiv aktives Anzeige-Bild (#56 AK3: Diagramm bevorzugt, bis der
 *  USER umschaltet). */
export function aktivesBild(args: {
  bildQuelle: string | null;
  bildUrl: string | null;
  diagramm: unknown;
}): "foto" | "diagramm" | null {
  const mitDiagramm = hatDiagramm(args.diagramm);
  if (args.bildQuelle === "diagramm" && mitDiagramm) return "diagramm";
  if (args.bildQuelle === "foto" && args.bildUrl) return "foto";
  if (mitDiagramm) return "diagramm";
  if (args.bildUrl) return "foto";
  return null;
}
