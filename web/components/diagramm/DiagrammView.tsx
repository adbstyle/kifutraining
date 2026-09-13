import {
  FLAECHE,
  FARBEN,
  FORM_DEFAULT_FARBE,
  LINIE_DEFAULT_FARBE,
  bbox,
  dreieckEcken,
  type DiagrammData,
  type DiagrammElement,
  type PfadElement,
  type FormElement,
  type TextElement,
  type Punkt,
} from "@/lib/diagramm";
import { dv } from "@/lib/diagramm-farben";
import { symbolDef, symbolFarbe, symbolMasse, symbolRotation } from "./symbols";
import { cn } from "@/lib/cn";

/**
 * Anzeige eines Spielfeld-Diagramms — überall dieselbe Komponente
 * (Liste, Detail, Trainings, Druck, mobil). Rendert das SVG direkt aus der
 * gespeicherten Struktur + dem aktuellen Symbol-Register: zentrale
 * Symbol-Updates wirken dadurch sofort, ohne gespeichertes Standbild
 * (Decision Record Spike #48, Gate 2).
 */

/** Rasen mit dezenten Mähstreifen, wie in den SFV-Diagrammen.
 *
 *  Die Kante zeichnet immer mit, ist am Bildschirm aber durchsichtig: Dort
 *  trägt der Rasen sich selbst, auf Papier ginge das weisse Feld ohne sie
 *  nahtlos ins weisse Blatt über. Welcher Fall gilt, entscheidet die Rolle —
 *  hier steht keine Bedingung. */
export function Rasen() {
  const streifen = 8;
  const b = FLAECHE.breite / streifen;
  return (
    <>
      <rect width={FLAECHE.breite} height={FLAECHE.hoehe} fill={dv("rasen")} />
      {Array.from({ length: streifen / 2 }, (_, i) => (
        <rect
          key={i}
          x={(i * 2 + 1) * b}
          width={b}
          height={FLAECHE.hoehe}
          fill={dv("rasen-streifen")}
        />
      ))}
      <rect
        x={0.75}
        y={0.75}
        width={FLAECHE.breite - 1.5}
        height={FLAECHE.hoehe - 1.5}
        fill="none"
        stroke={dv("feldkante")}
        strokeWidth={1.5}
      />
    </>
  );
}

/** Stapelreihenfolge: Formen unten, dann Pfade, Symbole, Text oben. */
const ART_ORDNUNG = { form: 0, pfad: 1, symbol: 2, text: 3 } as const;

export function sortiertNachEbene(elemente: DiagrammElement[]): DiagrammElement[] {
  return [...elemente].sort((a, b) => ART_ORDNUNG[a.art] - ART_ORDNUNG[b.art]);
}

/** Auf 2 Nachkommastellen runden. Wichtig für SVG-Koordinaten aus
 *  transzendenten Funktionen (Welle: sin, Pfeilspitze: cos/sin): Server- und
 *  Client-Engine runden das letzte Float-Bit minimal verschieden — vollpräzise
 *  Ausgabe löst sonst einen Hydration-Mismatch aus. Gerundet ist sie stabil. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const punkteAttr = (punkte: Punkt[]) =>
  punkte.map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ");

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
      points={`${r2(b.x)},${r2(b.y)} ${r2(l.x)},${r2(l.y)} ${r2(r.x)},${r2(r.y)}`}
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

/** Farbe der Bewegungspfeile. Die Manual-Zeichenerklärung (Abb. 24) zeichnet
 *  sie schwarz, und auf Papier tun wir das weiterhin; auf dem dunklen Rasen
 *  läge Schwarz bei 1.3:1 und wäre schlicht weg. Welcher Fall gilt, entscheidet
 *  die Rolle. */
const PFEIL = dv("bewegung");

/** Bewegungs- und Linien-Darstellung (#52) gemäss SFV-Manual-Zeichenerklärung
 *  (Abb. 24): Laufweg (Lauf ohne Ball) gestrichelt + Pfeil, Pass/Schuss
 *  durchgezogen + Pfeil, Dribbling wellenförmig + Pfeil — alle drei schwarz;
 *  freie Linie farbig, wahlweise gestrichelt. Der Linienstil — nicht die
 *  Strichstärke — unterscheidet die Bewegungsarten. */
export function PfadGrafik({ element }: { element: PfadElement }) {
  const farbe = FARBEN[element.farbe ?? LINIE_DEFAULT_FARBE];
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
            stroke={PFEIL}
            strokeWidth={5}
            strokeDasharray="18 14"
          />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL} />
        </>
      );
    case "dribbling":
      return (
        <>
          <polyline points={punkteAttr(endeKuerzen(wellenPunkte(element.punkte), PFEIL_BASIS))} {...basis} stroke={PFEIL} strokeWidth={4.5} />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL} />
        </>
      );
    case "pass":
      return (
        <>
          <polyline points={punkteAttr(endeKuerzen(element.punkte, PFEIL_BASIS))} {...basis} stroke={PFEIL} strokeWidth={5} />
          <PfeilSpitze punkte={element.punkte} farbe={PFEIL} />
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

/** Form: farbiger Umriss; die Fläche ist optional gefüllt, sonst nur
 *  Umriss. Im ungefüllten Fall hält eine transparente (unsichtbare) Füllung
 *  die Form greifbar — ein Klick in die Fläche selektiert sie weiterhin. */
export function FormGrafik({ element }: { element: FormElement }) {
  const farbe = FARBEN[element.farbe ?? FORM_DEFAULT_FARBE];
  const stil = {
    fill: element.gefuellt ? farbe : "transparent",
    stroke: farbe,
    strokeWidth: 4,
    // Die Deckung geht über style statt als Attribut: Für Farben ist var() im
    // Präsentationsattribut erprobt, für Zahlen nicht — und ein nicht
    // aufgelöstes var() fiele still auf volle Deckung zurück, also auf eine
    // deckende Fläche statt eines Hauchs.
    style: element.gefuellt ? { fillOpacity: dv("form-deckung") } : undefined,
  };
  const { x, y, breite: b, hoehe: h } = element;
  switch (element.form) {
    case "ellipse":
      return <ellipse cx={x + b / 2} cy={y + h / 2} rx={b / 2} ry={h / 2} {...stil} />;
    case "dreieck": {
      // Frei bearbeitete Dreiecke (#66) tragen ihre drei Ecken als punkte;
      // unbearbeitete leiten sie weiterhin gleichschenklig aus der Box ab.
      const ecken = element.punkte?.length === 3 ? element.punkte : dreieckEcken(x, y, b, h);
      return <polygon points={punkteAttr(ecken)} {...stil} />;
    }
    case "polygon":
      return <polygon points={punkteAttr(element.punkte ?? [])} {...stil} />;
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
        fill={dv("textbox-grund")}
        stroke={dv("textbox-rand")}
        strokeWidth={1.5}
      />
      <text
        x={element.x}
        y={element.y + 10}
        textAnchor="middle"
        fontSize={30}
        fontFamily="var(--font-sans, sans-serif)"
        fill={dv("textbox-schrift")}
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
      // Figuren nutzen Blickrichtung statt Rotation (Pose/Spiegelung/Frisur
      // kommen über die Render-Optionen), perspektivische Symbole (Minitor)
      // zeichnen die Orientierung selbst als eigenes Sprite — für beide ist die
      // wirksame Drehung 0, der Winkel geht dort über opts.rotation.
      const rot = symbolRotation(element.typ, element.rotation);
      return (
        <g transform={`translate(${element.x} ${element.y}) rotate(${rot})`}>
          {def.render(symbolFarbe(element.typ, element.farbe), {
            pose: element.pose,
            spiegeln: element.spiegeln,
            seed: element.id,
            rotation: element.rotation,
          })}
        </g>
      );
    }
    case "pfad":
      return <PfadGrafik element={element} />;
    case "form":
      return <FormGrafik element={element} />;
    case "text":
      return <TextGrafik element={element} />;
    default:
      return null;
  }
}

/** Inhalts-Begrenzung eines Elements in Flächen-Koordinaten — Basis für das
 *  Einpassen der Mini-Vorschau. Pfade bekommen Rand für Pfeilspitze + Strich. */
function inhaltBox(element: DiagrammElement): { x: number; y: number; b: number; h: number } {
  switch (element.art) {
    case "symbol": {
      // Gedrehte Symbole brauchen ihre gedrehten Masse, sonst passt die Vorschau
      // eine hochkante Box um eine liegende Stange ein.
      const m = symbolMasse(element.typ, element.rotation);
      return { x: element.x - m.breite / 2, y: element.y - m.hoehe / 2, b: m.breite, h: m.hoehe };
    }
    case "pfad": {
      const r = 18;
      const bb = bbox(element.punkte);
      return { x: bb.minX - r, y: bb.minY - r, b: bb.maxX - bb.minX + 2 * r, h: bb.maxY - bb.minY + 2 * r };
    }
    case "form": {
      if (element.form === "polygon" && element.punkte?.length) {
        const bb = bbox(element.punkte);
        return { x: bb.minX, y: bb.minY, b: bb.maxX - bb.minX, h: bb.maxY - bb.minY };
      }
      return { x: element.x, y: element.y, b: element.breite, h: element.hoehe };
    }
    case "text": {
      const tb = textBox(element);
      return { x: tb.x, y: tb.y, b: tb.breite, h: tb.hoehe };
    }
  }
}

/** Quadratische Mini-Vorschau eines Elements für Paletten/Bibliothek: rendert
 *  exakt dasselbe `ElementGrafik` wie auf dem Feld, auf Rasen-Grün, zentriert
 *  in eine Kachel eingepasst (WYSIWYG — die Vorschau ist das Resultat in klein).
 *  Weisse Glyphen brauchen den grünen Grund, sonst wären sie unsichtbar. */
export function GlyphVorschau({
  element,
  groesse = 44,
  rand = 0.16,
}: {
  element: DiagrammElement;
  groesse?: number;
  /** Luft um den Inhalt, relativ zur längeren Kante. */
  rand?: number;
}) {
  const ib = inhaltBox(element);
  const seite = Math.max(ib.b, ib.h, 1) * (1 + rand * 2);
  const cx = ib.x + ib.b / 2;
  const cy = ib.y + ib.h / 2;
  const ox = cx - seite / 2;
  const oy = cy - seite / 2;
  return (
    <svg
      viewBox={`${ox} ${oy} ${seite} ${seite}`}
      width={groesse}
      height={groesse}
      aria-hidden
      className="block"
    >
      <rect x={ox} y={oy} width={seite} height={seite} fill={dv("rasen-streifen")} />
      <ElementGrafik element={element} />
    </svg>
  );
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
