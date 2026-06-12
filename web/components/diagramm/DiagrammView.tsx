import { FLAECHE, type DiagrammData, type DiagrammElement } from "@/lib/diagramm";
import { symbolDef, symbolFarbe } from "./symbols";
import { cn } from "@/lib/cn";

/**
 * Anzeige eines Spielfeld-Diagramms — überall dieselbe Komponente
 * (Liste, Detail, Trainings, Druck, mobil). Rendert das SVG direkt aus der
 * gespeicherten Struktur + dem aktuellen Symbol-Register: zentrale
 * Symbol-Updates wirken dadurch sofort, ohne gespeichertes Standbild
 * (Decision Record Spike #48, Gate 2).
 */

/** Rasen mit dezenten Mähstreifen, wie in den SFV-Diagrammen. */
export function Rasen() {
  const streifen = 8;
  const b = FLAECHE.breite / streifen;
  return (
    <>
      <rect width={FLAECHE.breite} height={FLAECHE.hoehe} fill="#69a956" />
      {Array.from({ length: streifen / 2 }, (_, i) => (
        <rect
          key={i}
          x={(i * 2 + 1) * b}
          width={b}
          height={FLAECHE.hoehe}
          fill="#5f9c4d"
        />
      ))}
    </>
  );
}

/** Stapelreihenfolge: Zonen unten, dann Pfade, Symbole, Text oben. */
const ART_ORDNUNG = { zone: 0, pfad: 1, symbol: 2, text: 3 } as const;

export function sortiertNachEbene(elemente: DiagrammElement[]): DiagrammElement[] {
  return [...elemente].sort((a, b) => ART_ORDNUNG[a.art] - ART_ORDNUNG[b.art]);
}

/** Ein einzelnes Element (ohne Interaktion) — vom Editor wiederverwendet. */
export function ElementGrafik({ element }: { element: DiagrammElement }) {
  switch (element.art) {
    case "symbol": {
      const def = symbolDef(element.typ);
      return (
        <g
          transform={`translate(${element.x} ${element.y}) rotate(${element.rotation ?? 0})`}
        >
          {def.render(symbolFarbe(element.typ, element.farbe))}
        </g>
      );
    }
    // Pfade (#52), Zonen und Text (#53) folgen in ihren Stories.
    default:
      return null;
  }
}

export function DiagrammView({
  diagramm,
  title,
  className,
}: {
  diagramm: DiagrammData;
  /** Zugänglicher Titel, z. B. "Feld-Diagramm: Autorennen". */
  title: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}`}
      role="img"
      aria-label={title}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <Rasen />
      {sortiertNachEbene(diagramm.elemente).map((e) => (
        <ElementGrafik key={e.id} element={e} />
      ))}
    </svg>
  );
}
