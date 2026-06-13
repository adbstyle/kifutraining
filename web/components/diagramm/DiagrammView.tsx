import {
  FLAECHE,
  FARBEN,
  ZONE_DEFAULT_FARBE,
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

export const punkteAttr = (punkte: Punkt[]) =>
  punkte.map((p) => `${p.x},${p.y}`).join(" ");

/** Pfeilkopf-Geometrie (Single Source für Zeichnung UND Linienkürzung): Länge
 *  entlang der Achse und halber Öffnungswinkel. Bewusst deutlich breiter als
 *  die Linie, damit die Richtung klar erkennbar ist. */
const PFEIL_LAENGE = 30;
const PFEIL_WINKEL = 0.5;
/** Axiale Tiefe des Pfeilkopfs (Spitze → Basis) — so weit wird die Linie
 *  gekürzt, damit sie an der Basis endet und nicht aus der Spitze ragt. */
const PFEIL_BASIS = PFEIL_LAENGE * Math.cos(PFEIL_WINKEL);

/** Pfeilspitze am Linienende, ausgerichtet am letzten Segment. */
function PfeilSpitze({ punkte, farbe }: { punkte: Punkt[]; farbe: string }) {
  const b = punkte[punkte.length - 1];
  const a = punkte[punkte.length - 2] ?? b;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const seite = (off: number): Punkt => ({
    x: b.x - PFEIL_LAENGE * Math.cos(ang + off),
    y: b.y - PFEIL_LAENGE * Math.sin(ang + off),
  });
  const l = seite(-PFEIL_WINKEL);
  const r = seite(PFEIL_WINKEL);
  return (
    <polygon
      points={`${b.x},${b.y} ${l.x},${l.y} ${r.x},${r.y}`}
      fill={farbe}
    />
  );
}

/** Kürzt eine Polylinie am Ende um `inset` (gemessen entlang der Linie), damit
 *  die Linie an der Pfeilbasis endet statt durch die Spitze zu ragen. Robust
 *  auch für die gewellte Dribbling-Linie. */
function endeKuerzen(punkte: Punkt[], inset: number): Punkt[] {
  const out = [...punkte];
  let rest = inset;
  while (out.length >= 2) {
    const b = out[out.length - 1];
    const a = out[out.length - 2];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg >= rest) {
      const t = (seg - rest) / seg;
      out[out.length - 1] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      return out;
    }
    rest -= seg;
    out.pop();
  }
  return out;
}

/** Glatte Sinus-Welle entlang der Stützpunkte — manual-getreue Dribbling-
 *  Darstellung (echte Wellenform statt Zickzack). Dicht abgetastet, daher mit
 *  rundem Linejoin optisch weich; die Amplitude läuft zum Ende hin auf 0 aus,
 *  damit die Welle sauber an der Pfeilspitze ansetzt. */
export function wellenPunkte(punkte: Punkt[], amplitude = 8, wellenlaenge = 44): Punkt[] {
  const segLen = punkte
    .slice(1)
    .map((p, i) => Math.hypot(p.x - punkte[i].x, p.y - punkte[i].y));
  const total = segLen.reduce((s, l) => s + l, 0);
  if (total === 0) return [...punkte];
  const schritt = 5; // Abtastabstand entlang der Linie
  const auslauf = wellenlaenge * 0.75; // Strecke, über die die Welle ausklingt
  const out: Punkt[] = [];
  let bogen = 0; // kumulierte Bogenlänge für durchgehende Phase über Segmente
  for (let s = 0; s < punkte.length - 1; s++) {
    const a = punkte[s];
    const len = segLen[s];
    if (len === 0) continue;
    const ux = (punkte[s + 1].x - a.x) / len;
    const uy = (punkte[s + 1].y - a.y) / len;
    const n = Math.max(1, Math.round(len / schritt));
    for (let i = 0; i <= n; i++) {
      if (i === 0 && out.length > 0) continue; // Naht zwischen Segmenten meiden
      const d = (i / n) * len;
      const arc = bogen + d;
      const env = Math.min(1, (total - arc) / auslauf);
      const off = amplitude * env * Math.sin((2 * Math.PI * arc) / wellenlaenge);
      out.push({ x: a.x + ux * d - uy * off, y: a.y + uy * d + ux * off });
    }
    bogen += len;
  }
  return out;
}

/** Schwarz der Bewegungspfeile — wie in der Manual-Zeichenerklärung (Abb. 24),
 *  klar auf dem Rasen erkennbar. */
const PFEIL_SCHWARZ = "#1b1b1b";

/** Bewegungs- und Linien-Darstellung (#52) gemäss SFV-Manual-Zeichenerklärung
 *  (Abb. 24): Laufweg (Lauf ohne Ball) gestrichelt + Pfeil, Pass/Schuss
 *  durchgezogen + Pfeil, Dribbling wellenförmig + Pfeil — alle drei schwarz;
 *  freie Linie farbig, wahlweise gestrichelt. Der Linienstil — nicht die
 *  Strichstärke — unterscheidet die Bewegungsarten. */
export function PfadGrafik({ element }: { element: PfadElement }) {
  const farbe = element.farbe ? FARBEN[element.farbe] : "#fafafa";
  const basis = {
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (element.typ) {
    case "laufweg":
      return (
        <>
          <polyline
            points={punkteAttr(endeKuerzen(element.punkte, PFEIL_BASIS))}
            {...basis}
            stroke={PFEIL_SCHWARZ}
            strokeWidth={5}
            strokeDasharray="18 14"
          />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL_SCHWARZ} />
        </>
      );
    case "dribbling":
      return (
        <>
          <polyline points={punkteAttr(endeKuerzen(wellenPunkte(element.punkte), PFEIL_BASIS))} {...basis} stroke={PFEIL_SCHWARZ} strokeWidth={4.5} />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL_SCHWARZ} />
        </>
      );
    case "pass":
      return (
        <>
          <polyline points={punkteAttr(endeKuerzen(element.punkte, PFEIL_BASIS))} {...basis} stroke={PFEIL_SCHWARZ} strokeWidth={5} />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL_SCHWARZ} />
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
  const farbe = FARBEN[element.farbe ?? ZONE_DEFAULT_FARBE];
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
