import type { ReactNode } from "react";
import { FARBEN, type FarbSlug, type SymbolTyp, DREHBARE_TYPEN } from "@/lib/diagramm";

/**
 * Zentrales Symbol-Register (Decision Record Spike #48, Gate 3).
 *
 * VERTRAG: Jedes Symbol zeichnet zentriert um (0,0) — der Anker ist der
 * Symbol-Mittelpunkt und entspricht dem gespeicherten (x, y) des Elements;
 * Rotation dreht um den Anker. Eine neue Symbol-Version darf Form und Stil
 * ändern, aber NIE den Anker verschieben — sonst wandern bestehende
 * Diagramme (#55 AK4). `breite`/`hoehe` beschreiben die Begrenzung für
 * Auswahl-Rahmen und Treffer-Fläche.
 *
 * Richtungskonvention drehbarer Symbole: 0° = Öffnung bzw. Blick nach unten
 * (zum Betrachter); Hürde 0° = Überquerung von oben nach unten.
 */
export type SymbolDef = {
  label: string;
  breite: number;
  hoehe: number;
  drehbar: boolean;
  faerbbar: boolean;
  defaultFarbe?: FarbSlug;
  render: (farbe: string) => ReactNode;
};

const KONTUR = "rgba(0,0,0,.3)";

/** Netz-Schraffur für Tore. */
function Netz({ x, y, b, h }: { x: number; y: number; b: number; h: number }) {
  const linien: ReactNode[] = [];
  for (let i = x + 8; i < x + b; i += 10)
    linien.push(<line key={`v${i}`} x1={i} y1={y} x2={i} y2={y + h} />);
  for (let j = y + 7; j < y + h; j += 9)
    linien.push(<line key={`h${j}`} x1={x} y1={j} x2={x + b} y2={j} />);
  return (
    <g stroke="rgba(255,255,255,.75)" strokeWidth={1.5}>
      {linien}
    </g>
  );
}

export const SYMBOLE: Record<SymbolTyp, SymbolDef> = {
  tor: {
    label: "Tor",
    breite: 180,
    hoehe: 76,
    drehbar: DREHBARE_TYPEN.has("tor"),
    faerbbar: false,
    render: () => (
      <>
        {/* Grosstor in Aufsicht, Öffnung unten: Rückwand + Pfosten + Netz */}
        <Netz x={-86} y={-34} b={172} h={62} />
        <path
          d="M -90 38 L -90 -38 L 90 -38 L 90 38"
          fill="none"
          stroke="#fafafa"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <circle cx={-90} cy={38} r={6} fill="#fafafa" />
        <circle cx={90} cy={38} r={6} fill="#fafafa" />
      </>
    ),
  },
  minitor: {
    label: "Minitor",
    breite: 100,
    hoehe: 48,
    drehbar: DREHBARE_TYPEN.has("minitor"),
    faerbbar: false,
    render: () => (
      <>
        {/* Pop-up-Minitor: Bogen-Rückwand, Öffnung unten */}
        <path d="M -44 22 Q -50 -22 0 -24 Q 50 -22 44 22 Z" fill="rgba(229,57,53,.85)" stroke={KONTUR} strokeWidth={2} />
        <path d="M -32 14 Q -36 -14 0 -15 Q 36 -14 32 14" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth={1.5} />
        <path d="M -20 17 Q -22 -8 0 -9 Q 22 -8 20 17" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth={1.5} />
        <line x1={-44} y1={22} x2={44} y2={22} stroke="#fafafa" strokeWidth={4} />
      </>
    ),
  },
  pylone: {
    label: "Pylone",
    breite: 34,
    hoehe: 34,
    drehbar: DREHBARE_TYPEN.has("pylone"),
    faerbbar: true,
    defaultFarbe: "rot",
    render: (farbe) => (
      <>
        {/* Markierkegel in Aufsicht: Basisring + Spitze */}
        <circle r={16} fill={farbe} stroke={KONTUR} strokeWidth={1.5} />
        <circle r={7} fill="#ffffff" opacity={0.85} />
        <circle r={3} fill={farbe} />
      </>
    ),
  },
  teller: {
    label: "Markierungsteller",
    breite: 36,
    hoehe: 20,
    drehbar: DREHBARE_TYPEN.has("teller"),
    faerbbar: true,
    defaultFarbe: "gelb",
    render: (farbe) => (
      <>
        {/* Flacher Teller: Ellipse mit Loch */}
        <ellipse rx={17} ry={9} fill={farbe} stroke={KONTUR} strokeWidth={1.5} />
        <ellipse rx={6} ry={3} fill="rgba(255,255,255,.9)" />
      </>
    ),
  },
  stange: {
    label: "Stange",
    breite: 34,
    hoehe: 86,
    drehbar: DREHBARE_TYPEN.has("stange"),
    faerbbar: true,
    defaultFarbe: "weiss",
    render: (farbe) => (
      <>
        {/* Fahnenstange in Seitenansicht (wie im Manual): Stab + Fähnchen */}
        <line x1={0} y1={-40} x2={0} y2={40} stroke="#eceff1" strokeWidth={4} strokeLinecap="round" />
        <line x1={0} y1={-40} x2={0} y2={40} stroke={KONTUR} strokeWidth={5.5} strokeLinecap="round" opacity={0.35} />
        <path d="M 2 -40 L 26 -32 L 2 -24 Z" fill={farbe} stroke={KONTUR} strokeWidth={1} />
      </>
    ),
  },
  reifen: {
    label: "Reifen",
    breite: 46,
    hoehe: 46,
    drehbar: DREHBARE_TYPEN.has("reifen"),
    faerbbar: true,
    defaultFarbe: "blau",
    render: (farbe) => (
      <circle r={19} fill="none" stroke={farbe} strokeWidth={6} />
    ),
  },
  huerde: {
    label: "Hürde",
    breite: 76,
    hoehe: 36,
    drehbar: DREHBARE_TYPEN.has("huerde"),
    faerbbar: false,
    render: () => (
      <>
        {/* Kleine Hürde: Querlatte auf zwei Füssen, Überquerung oben/unten */}
        <line x1={-30} y1={-12} x2={-30} y2={12} stroke="#fafafa" strokeWidth={5} strokeLinecap="round" />
        <line x1={30} y1={-12} x2={30} y2={12} stroke="#fafafa" strokeWidth={5} strokeLinecap="round" />
        <line x1={-34} y1={0} x2={34} y2={0} stroke="#ffb300" strokeWidth={7} strokeLinecap="round" />
      </>
    ),
  },
  spieler: {
    label: "Spieler",
    breite: 46,
    hoehe: 46,
    drehbar: DREHBARE_TYPEN.has("spieler"),
    faerbbar: true,
    defaultFarbe: "rot",
    render: (farbe) => (
      <>
        {/* Feldspieler in Aufsicht: Leibchen-Kreis + Blickrichtungs-Nase (0° = unten) */}
        <path d="M 0 30 L -9 16 L 9 16 Z" fill={farbe} stroke={KONTUR} strokeWidth={1} />
        <circle r={17} fill={farbe} stroke={KONTUR} strokeWidth={2} />
        <circle r={6.5} fill="#ffe0b2" stroke={KONTUR} strokeWidth={1} />
      </>
    ),
  },
  torwart: {
    label: "Torwart",
    breite: 46,
    hoehe: 46,
    drehbar: DREHBARE_TYPEN.has("torwart"),
    faerbbar: false,
    render: () => (
      <>
        {/* Torwart hebt sich ab: Neon-Leibchen + Handschuh-Punkte */}
        <path d="M 0 30 L -9 16 L 9 16 Z" fill="#c0ca33" stroke={KONTUR} strokeWidth={1} />
        <circle r={17} fill="#c0ca33" stroke="#212121" strokeWidth={3} />
        <circle r={6.5} fill="#ffe0b2" stroke={KONTUR} strokeWidth={1} />
        <circle cx={-19} cy={6} r={5} fill="#fafafa" stroke={KONTUR} strokeWidth={1} />
        <circle cx={19} cy={6} r={5} fill="#fafafa" stroke={KONTUR} strokeWidth={1} />
      </>
    ),
  },
  fussball: {
    label: "Fussball",
    breite: 28,
    hoehe: 28,
    drehbar: DREHBARE_TYPEN.has("fussball"),
    faerbbar: false,
    render: () => (
      <>
        <circle r={12} fill="#fafafa" stroke="#424242" strokeWidth={1.5} />
        <circle r={3.5} fill="#424242" />
        <circle cx={-7} cy={-5} r={2} fill="#424242" />
        <circle cx={7} cy={-5} r={2} fill="#424242" />
        <circle cx={0} cy={9} r={2} fill="#424242" />
      </>
    ),
  },
  handball: {
    label: "Handball",
    breite: 24,
    hoehe: 24,
    drehbar: DREHBARE_TYPEN.has("handball"),
    faerbbar: false,
    render: () => (
      <>
        <circle r={10} fill="#ef6c00" stroke={KONTUR} strokeWidth={1.5} />
        <path d="M -9 -4 Q 0 2 9 -4 M -9 4 Q 0 -2 9 4" fill="none" stroke="#fff3e0" strokeWidth={1.5} />
      </>
    ),
  },
  tennisball: {
    label: "Tennisball",
    breite: 18,
    hoehe: 18,
    drehbar: DREHBARE_TYPEN.has("tennisball"),
    faerbbar: false,
    render: () => (
      <>
        <circle r={7} fill="#cddc39" stroke={KONTUR} strokeWidth={1} />
        <path d="M -6 -3 Q 0 0 -6 3 M 6 -3 Q 0 0 6 3" fill="none" stroke="#fafafa" strokeWidth={1.2} />
      </>
    ),
  },
};

/** Neutraler Platzhalter für unbekannte/fehlerhafte Symbol-Typen: das
 *  Diagramm bleibt intakt und editierbar, Daten werden nie angefasst (#55 AK5). */
export const FALLBACK_SYMBOL: SymbolDef = {
  label: "Unbekanntes Element",
  breite: 34,
  hoehe: 34,
  drehbar: false,
  faerbbar: false,
  render: () => (
    <>
      <circle r={15} fill="rgba(255,255,255,.6)" stroke="#616161" strokeWidth={2} strokeDasharray="4 3" />
      <text y={5} textAnchor="middle" fontSize={16} fill="#616161">?</text>
    </>
  ),
};

export function symbolDef(typ: string): SymbolDef {
  return SYMBOLE[typ as SymbolTyp] ?? FALLBACK_SYMBOL;
}

/** Hex-Farbe eines Elements mit Registry-Default. */
export function symbolFarbe(typ: string, farbe?: FarbSlug): string {
  const def = symbolDef(typ);
  const slug = farbe ?? def.defaultFarbe;
  return slug ? FARBEN[slug] : FARBEN.rot;
}
