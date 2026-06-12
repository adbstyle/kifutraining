import {
  FLAECHE,
  FARBEN,
  type DiagrammData,
  type DiagrammElement,
  type PfadElement,
  type ZoneElement,
  type TextElement,
  type Punkt,
} from "@/lib/diagramm";
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

const punkteAttr = (punkte: Punkt[]) =>
  punkte.map((p) => `${p.x},${p.y}`).join(" ");

/** Pfeilspitze am Linienende, ausgerichtet am letzten Segment. */
function PfeilSpitze({ punkte, farbe }: { punkte: Punkt[]; farbe: string }) {
  const b = punkte[punkte.length - 1];
  const a = punkte[punkte.length - 2] ?? b;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const g = 20;
  const seite = (off: number): Punkt => ({
    x: b.x - g * Math.cos(ang + off),
    y: b.y - g * Math.sin(ang + off),
  });
  const l = seite(-0.45);
  const r = seite(0.45);
  return (
    <polygon
      points={`${b.x},${b.y} ${l.x},${l.y} ${r.x},${r.y}`}
      fill={farbe}
    />
  );
}

/** Zickzack entlang der Stützpunkte — die SFV-Darstellung des Dribblings. */
export function zickzackPunkte(punkte: Punkt[], amplitude = 9, schritt = 26): Punkt[] {
  const out: Punkt[] = [punkte[0]];
  let seite = 1;
  for (let s = 0; s < punkte.length - 1; s++) {
    const a = punkte[s];
    const b = punkte[s + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const n = Math.max(2, Math.round(len / schritt));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      out.push({
        x: a.x + dx * t + (-dy / len) * amplitude * seite,
        y: a.y + dy * t + (dx / len) * amplitude * seite,
      });
      seite = -seite;
    }
    out.push(b);
  }
  return out;
}

/** Bewegungs- und Linien-Darstellung (#52): Laufweg durchgezogen + Pfeil,
 *  Dribbling als Zickzack + Pfeil, Pass als kräftiger gerader Pfeil,
 *  freie Linie farbig, wahlweise gestrichelt. */
export function PfadGrafik({ element }: { element: PfadElement }) {
  const weiss = "#fafafa";
  const farbe = element.farbe ? FARBEN[element.farbe] : weiss;
  const basis = {
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (element.typ) {
    case "laufweg":
      return (
        <>
          <polyline points={punkteAttr(element.punkte)} {...basis} stroke={weiss} strokeWidth={5} />
          <PfeilSpitze punkte={element.punkte} farbe={weiss} />
        </>
      );
    case "dribbling": {
      const zz = zickzackPunkte(element.punkte);
      return (
        <>
          <polyline points={punkteAttr(zz)} {...basis} stroke={weiss} strokeWidth={4.5} />
          <PfeilSpitze punkte={element.punkte} farbe={weiss} />
        </>
      );
    }
    case "pass":
      return (
        <>
          <polyline points={punkteAttr(element.punkte)} {...basis} stroke={weiss} strokeWidth={8} />
          <PfeilSpitze punkte={element.punkte} farbe={weiss} />
        </>
      );
    case "linie":
    default:
      return (
        <polyline
          points={punkteAttr(element.punkte)}
          {...basis}
          stroke={farbe}
          strokeWidth={5}
          strokeDasharray={element.gestrichelt ? "16 12" : undefined}
        />
      );
  }
}

/** Markierte Zone (#53): farbige Füllung + Umriss, vier Formen. */
export function ZoneGrafik({ element }: { element: ZoneElement }) {
  const farbe = FARBEN[element.farbe ?? "gelb"];
  const stil = { fill: farbe, fillOpacity: 0.28, stroke: farbe, strokeWidth: 4 };
  const { x, y, breite: b, hoehe: h } = element;
  switch (element.form) {
    case "ellipse":
      return <ellipse cx={x + b / 2} cy={y + h / 2} rx={b / 2} ry={h / 2} {...stil} />;
    case "dreieck":
      return <polygon points={`${x + b / 2},${y} ${x + b},${y + h} ${x},${y + h}`} {...stil} />;
    case "polygon":
      return <polygon points={(element.punkte ?? []).map((p) => `${p.x},${p.y}`).join(" ")} {...stil} />;
    case "rechteck":
    default:
      return <rect x={x} y={y} width={b} height={h} {...stil} />;
  }
}

/** Geschätzte Begrenzung einer Textbox (für Treffer-Fläche und Rahmen). */
export function textBox(element: TextElement) {
  const breite = Math.max(80, element.text.length * 17 + 28);
  const hoehe = 48;
  return { x: element.x - breite / 2, y: element.y - hoehe / 2, breite, hoehe };
}

/** Textbox (#53): dunkle Schrift auf hellem Träger, lesbar auf Rasen. */
export function TextGrafik({ element }: { element: TextElement }) {
  const box = textBox(element);
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.breite}
        height={box.hoehe}
        rx={5}
        fill="rgba(255,255,255,.88)"
        stroke="rgba(0,0,0,.25)"
        strokeWidth={1.5}
      />
      <text
        x={element.x}
        y={element.y + 10}
        textAnchor="middle"
        fontSize={30}
        fontFamily="var(--font-sans, sans-serif)"
        fill="#212121"
      >
        {element.text}
      </text>
    </>
  );
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
    case "pfad":
      return <PfadGrafik element={element} />;
    case "zone":
      return <ZoneGrafik element={element} />;
    case "text":
      return <TextGrafik element={element} />;
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
