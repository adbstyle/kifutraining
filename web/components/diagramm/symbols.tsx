import type { ReactNode } from "react";
import {
  FARBEN,
  type FarbSlug,
  type SymbolTyp,
  type SpielerPose,
  type Rotation,
  DREHBARE_TYPEN,
  FIGUR_TYPEN,
} from "@/lib/diagramm";
import { dv } from "@/lib/diagramm-farben";
import { FigurGrafik, TORWART_TRIKOT } from "./figur";

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
 *
 * PERSPEKTIVISCHE Symbole (`perspektivisch: true`, z. B. Minitor) ändern ihre
 * *Form* je Winkel statt sich flach zu drehen: sie bekommen die Rotation über
 * `opts.rotation` und zeichnen pro Orientierung ein eigenes 2.5D-Sprite (wie
 * im SFV-Manual). Der äussere `rotate()` entfällt für sie (DiagrammView).
 */
/** Render-Optionen. Figuren (Spieler/Torwart) nutzen `pose`/`spiegeln`/`seed`;
 *  perspektivische Symbole (Minitor) nutzen `rotation`. Symbole ignorieren,
 *  was sie nicht brauchen. `seed` (die Element-id) steuert die deterministische
 *  Frisur-/Hautton-Variation der Figuren. */
export type SymbolRenderOpts = {
  pose?: SpielerPose;
  spiegeln?: boolean;
  seed?: string;
  rotation?: Rotation;
};

export type SymbolDef = {
  label: string;
  breite: number;
  hoehe: number;
  drehbar: boolean;
  faerbbar: boolean;
  /** Form ändert sich je Rotation (2.5D-Perspektive) statt flacher Drehung —
   *  render() bekommt `opts.rotation`, der äussere rotate() entfällt. */
  perspektivisch?: boolean;
  defaultFarbe?: FarbSlug;
  render: (farbe: string, opts?: SymbolRenderOpts) => ReactNode;
};

const KONTUR = dv("symbol-kontur");

/** Netz-Schraffur für Tore. */
function Netz({ x, y, b, h }: { x: number; y: number; b: number; h: number }) {
  const linien: ReactNode[] = [];
  for (let i = x + 8; i < x + b; i += 10)
    linien.push(<line key={`v${i}`} x1={i} y1={y} x2={i} y2={y + h} />);
  for (let j = y + 7; j < y + h; j += 9)
    linien.push(<line key={`h${j}`} x1={x} y1={j} x2={x + b} y2={j} />);
  return (
    <g stroke={dv("tornetz")} strokeWidth={1.5}>
      {linien}
    </g>
  );
}

/* ───────────────────────── Minitor (perspektivisch) ─────────────────────────
 * Pop-up-Minitor: vom Nutzer gezeichnete 2.5D-Ansichten (0/45/90/135/180°);
 * die übrigen vier Orientierungen entstehen durch Spiegelung (siehe
 * MINITOR_ANSICHT). Die Originalpfade werden 1:1 übernommen und nur über
 * mtView() auf den Anker (0,0) zentriert und skaliert — eine einzige
 * Transformation für alle Ansichten, damit das Tor in jeder Lage gleich gross
 * bleibt. Anker = Mittelpunkt der gemeinsamen Bezugsbox (#55 Anker-Vertrag). */
const MT_NETZ = dv("minitor-netz");
const MT_NETZ_FILL = 0.4;
const MT_SCHNUR = dv("minitor-schnur");
/** Bezugspunkt der Zeichnungen (Canvas 161×108): Tor-Mittelpunkt ~ (92.5, 50). */
const MT_CX = 92.5;
const MT_CY = 50;
/** Skalierung der Original-Zeichnung in Symbol-Einheiten. */
const MT_SKALA = 1.3;

/** Zentriert + skaliert die Original-Zeichnung auf den Anker (0,0). Gemeinsam
 *  für alle Ansichten → konsistente Grösse; mit dem äusseren scale(-1,1) der
 *  gespiegelten Orientierungen verträglich (Spiegelung um die Tor-Achse). */
function mtView(children: ReactNode) {
  return <g transform={`scale(${MT_SKALA}) translate(${-MT_CX} ${-MT_CY})`}>{children}</g>;
}

/** Torschnur (Bodenschnur) — Originalpfad, graue Linie. */
const mtSchnur = (d: string) => <path d={d} stroke={MT_SCHNUR} strokeWidth={2} strokeLinecap="round" />;
/** Netz/Bügel — Originalpfad. `modus`: "voll" = Fläche + weisser Rand,
 *  "flaeche" = nur Netzfläche, "rand" = nur weisser Bügelrand. */
function mtNetzPfad(d: string, modus: "voll" | "flaeche" | "rand" = "voll") {
  return (
    <path
      d={d}
      fill={modus === "rand" ? "none" : MT_NETZ}
      fillOpacity={modus === "rand" ? undefined : MT_NETZ_FILL}
      stroke={modus === "flaeche" ? "none" : MT_NETZ}
      strokeWidth={modus === "flaeche" ? undefined : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Front (0°). */
function mtFront() {
  return mtView(
    <>
      {mtSchnur("M64.5 56H120.5")}
      {mtNetzPfad("M64 56.0009C80 45.0002 104 45.0002 120.5 56.0002C114 15.5 71.5 15.0002 64 56.0009Z")}
    </>,
  );
}

/** Rück (180°): Netz hängt unter die Torschnur. */
function mtRueck() {
  return mtView(
    <>
      {mtSchnur("M64.5 56H120.5")}
      {mtNetzPfad("M64 56.001C71 66.5 107.5 71.5 120.5 56.0002C114 15.5001 71.5 15.0003 64 56.001Z")}
    </>,
  );
}

/** Seite (90°, Spiegel für 270°). */
function mtSeite() {
  return mtView(
    <>
      {mtSchnur("M92.5 28V84")}
      {mtNetzPfad(
        "M80.9783 31.8956C77.6141 43.5002 78.7228 65.8352 91.646 84.1111C51.8704 57.5817 61.6449 41.3133 80.9783 31.8956C83.249 24.0629 87.5574 21.1187 91.646 27.6111C87.9423 28.8466 84.3177 30.2689 80.9783 31.8956Z",
        "flaeche",
      )}
      {mtNetzPfad("M91.646 84.1111C70 53.4995 81.5 11.5 91.646 27.6111C66.5 35.9993 45 52.9993 91.646 84.1111Z", "rand")}
    </>,
  );
}

/** Dreiviertel vorn (45°, Spiegel für 315°). */
function mtDreiviertelVorn() {
  return mtView(
    <>
      {mtSchnur("M111.598 41.402L72 81")}
      {mtNetzPfad(
        "M72 80.9999C64.3266 76.2494 55.3181 62.1532 75.6126 51.3953C84.3573 18.5273 106.326 9.25879 111.5 41.4997C94.5404 43.9226 83.0884 47.4325 75.6126 51.3953C73.3724 59.8152 72 69.7837 72 80.9999Z",
        "flaeche",
      )}
      {mtNetzPfad("M72 80.9999C61.5 74.4995 48.5 50.5 111.5 41.4997C105 0.999567 72 26 72 80.9999Z", "rand")}
    </>,
  );
}

/** Dreiviertel hinten (135°, Spiegel für 225°). */
function mtDreiviertelHinten() {
  return mtView(
    <>
      {mtSchnur("M71.5 36.5L111.098 76.098")}
      {mtNetzPfad("M111 76.0004C111 31.5003 77.5 9.50018 72.5 36.0003C60 45 75.5 67 111 76.0004Z")}
    </>,
  );
}

/** Orientierung → Ansicht + Spiegelung. Acht 45°-Schritte auf fünf Sprites,
 *  Spiegelung über scale(-1,1) (anker-treu, da zentriert um 0). */
const MINITOR_ANSICHT: Record<Rotation, { sprite: () => ReactNode; spiegeln: boolean }> = {
  0: { sprite: mtFront, spiegeln: false },
  45: { sprite: mtDreiviertelVorn, spiegeln: false },
  90: { sprite: mtSeite, spiegeln: false },
  135: { sprite: mtDreiviertelHinten, spiegeln: false },
  180: { sprite: mtRueck, spiegeln: false },
  225: { sprite: mtDreiviertelHinten, spiegeln: true },
  270: { sprite: mtSeite, spiegeln: true },
  315: { sprite: mtDreiviertelVorn, spiegeln: true },
};

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
          stroke={dv("geraet")}
          strokeWidth={9}
          strokeLinecap="round"
        />
        <circle cx={-90} cy={38} r={6} fill={dv("geraet")} />
        <circle cx={90} cy={38} r={6} fill={dv("geraet")} />
      </>
    ),
  },
  minitor: {
    label: "Minitor",
    // Box deckt die gemeinsame Hülle aller acht Orientierungen ab (die Seiten-
    // ansichten sind perspektivisch am höchsten); gemessen aus den Zeichnungen.
    breite: 80,
    hoehe: 92,
    drehbar: DREHBARE_TYPEN.has("minitor"),
    faerbbar: false,
    // Pop-up-Minitor im Manual-Look: je Orientierung eine eigene 2.5D-Ansicht
    // (Front/Dreiviertel/Seite/Rück) statt flacher Drehung — siehe Vertrag oben.
    perspektivisch: true,
    render: (_farbe, opts) => {
      const a = MINITOR_ANSICHT[opts?.rotation ?? 0] ?? MINITOR_ANSICHT[0];
      return a.spiegeln ? <g transform="scale(-1,1)">{a.sprite()}</g> : a.sprite();
    },
  },
  pylone: {
    label: "Pylone",
    breite: 34,
    hoehe: 40,
    drehbar: DREHBARE_TYPEN.has("pylone"),
    faerbbar: true,
    defaultFarbe: "orange",
    render: (farbe) => (
      <>
        {/* Markierkegel in Seitenansicht (SFV-Manual-Stil): Fussplatte +
            kegelförmiger Körper, plastisch schattiert. Anker bleibt der
            Mittelpunkt (0,0). */}
        <rect x={-16} y={12} width={32} height={6} rx={2.5} fill={farbe} stroke={KONTUR} strokeWidth={1.4} />
        <path
          d="M -13 13 Q -9 -1 -4 -12 Q 0 -16 4 -12 Q 9 -1 13 13 Z"
          fill={farbe}
          stroke={KONTUR}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {/* Schattierte rechte Flanke + Lichtkante links für Tiefe */}
        <path d="M 0 -14 Q 9 -1 13 13 L 2 13 Q 1.5 -3 0 -14 Z" fill={dv("schatten")} />
        <path d="M -1 -13 Q -6 -3 -8 11" fill="none" stroke={dv("symbol-glanz")} strokeWidth={2} strokeLinecap="round" />
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
        <ellipse rx={6} ry={3} fill={dv("teller-loch")} />
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
        <line x1={0} y1={-40} x2={0} y2={40} stroke={dv("stange-stab")} strokeWidth={4} strokeLinecap="round" />
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
  leibchen: {
    label: "Überziehleibchen",
    breite: 46,
    // Der Pfad spannt y −8 … 8.5 (Wellenkämme) plus halbe Strichbreite, liegt
    // also mittig im 20er-Rahmen — Auswahl-Rahmen und Treffer-Fläche sitzen
    // damit auf dem gezeichneten Tuch.
    hoehe: 20,
    drehbar: DREHBARE_TYPEN.has("leibchen"),
    faerbbar: true,
    defaultFarbe: "rot",
    render: (farbe) => (
      <>
        {/* Zusammengelegtes Leibchen: gerade Oberkante, unten ein Wellensaum.
         *  Die unruhige Silhouette grenzt es vom flachen Teller (Ellipse mit
         *  Loch) ab — im Manual liegt es in der Hand oder am Boden. */}
        <path
          d="M-20 -6 L18 -8 Q22 -7 21 -3 Q16 1 18 5 Q13 10 8 6 Q2 11 -3 6 Q-9 11 -14 6 Q-19 10 -21 4 Z"
          fill={farbe}
          stroke={KONTUR}
          strokeWidth={1.4}
        />
        {/* Lichtkante an der Faltkante, dazu eine senkrechte Falte */}
        <path d="M-16 -4 L14 -5.5" stroke={dv("leibchen-glanz")} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <path d="M-6 -6 Q-4 0 -3 6" stroke={KONTUR} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      </>
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
        <line x1={-30} y1={-12} x2={-30} y2={12} stroke={dv("geraet")} strokeWidth={5} strokeLinecap="round" />
        <line x1={30} y1={-12} x2={30} y2={12} stroke={dv("geraet")} strokeWidth={5} strokeLinecap="round" />
        <line x1={-34} y1={0} x2={34} y2={0} stroke={dv("huerde-latte")} strokeWidth={7} strokeLinecap="round" />
      </>
    ),
  },
  spieler: {
    label: "Spieler",
    breite: 75,
    hoehe: 145,
    drehbar: DREHBARE_TYPEN.has("spieler"),
    faerbbar: true,
    defaultFarbe: "rot",
    // Cartoon-Kind, Trikot = Team-Farbe; Pose/Spiegeln/Frisur über opts (Epic #47).
    render: (farbe, opts) => (
      <FigurGrafik
        art="spieler"
        pose={opts?.pose}
        trikot={farbe}
        seed={opts?.seed ?? "spieler"}
        spiegeln={opts?.spiegeln}
      />
    ),
  },
  torwart: {
    label: "Torwart",
    breite: 75,
    hoehe: 145,
    drehbar: DREHBARE_TYPEN.has("torwart"),
    faerbbar: false,
    // Feste Standfigur mit Handschuhen, Neon-Trikot (hebt sich ab).
    render: (_farbe, opts) => (
      <FigurGrafik
        art="torwart"
        trikot={TORWART_TRIKOT}
        seed={opts?.seed ?? "torwart"}
        spiegeln={opts?.spiegeln}
      />
    ),
  },
  trainer: {
    label: "Trainer",
    // Erwachsene Figur: rund 38 % grösser als ein Kind (TRAINER_SCALE). Die
    // Zeichnung spannt im Figuren-Raum y 22…251, anker-relativ also −90…+84
    // — der Rahmen deckt beides.
    breite: 76,
    hoehe: 184,
    drehbar: DREHBARE_TYPEN.has("trainer"),
    faerbbar: true,
    defaultFarbe: "orange",
    // Feste Standfigur mit Kappe, langen Ärmeln und langer Hose; Überzieher in
    // der Elementfarbe. Posenlos wie der Torwart.
    render: (farbe, opts) => (
      <FigurGrafik
        art="trainer"
        trikot={farbe}
        seed={opts?.seed ?? "trainer"}
        spiegeln={opts?.spiegeln}
      />
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
        <circle
          r={12}
          fill={dv("ball-koerper")}
          stroke={dv("ball-zeichnung")}
          // Strichstärke über style, nicht als Attribut: Für Farben ist
          // var() im Präsentationsattribut erprobt, für Zahlen nicht —
          // und ein nicht aufgelöstes var() fiele still auf 1 zurück.
          style={{ strokeWidth: dv("ball-strich") }}
        />
        <circle r={3.5} fill={dv("ball-zeichnung")} />
        <circle cx={-7} cy={-5} r={2} fill={dv("ball-zeichnung")} />
        <circle cx={7} cy={-5} r={2} fill={dv("ball-zeichnung")} />
        <circle cx={0} cy={9} r={2} fill={dv("ball-zeichnung")} />
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
        <circle r={10} fill={dv("handball")} stroke={KONTUR} strokeWidth={1.5} />
        <path d="M -9 -4 Q 0 2 9 -4 M -9 4 Q 0 -2 9 4" fill="none" stroke={dv("handball-naht")} strokeWidth={1.5} />
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
        <circle r={7} fill={dv("tennisball")} stroke={KONTUR} strokeWidth={1} />
        <path d="M -6 -3 Q 0 0 -6 3 M 6 -3 Q 0 0 6 3" fill="none" stroke={dv("tennisball-naht")} strokeWidth={1.2} />
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
      <circle r={15} fill={dv("fallback-grund")} stroke={dv("fallback-strich")} strokeWidth={2} strokeDasharray="4 3" />
      <text y={5} textAnchor="middle" fontSize={16} fill={dv("fallback-strich")}>?</text>
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

/** Wirksame Drehung eines Symbols — Single Source für Zeichnung, Trefferfläche
 *  und Begrenzungsrahmen. Figuren nutzen Blickrichtung statt Rotation, und
 *  perspektivische Symbole (Minitor) zeichnen den Winkel selbst als eigenes
 *  Sprite: beide bleiben achsenparallel, eine gespeicherte Rotation ist dort
 *  wirkungslos. */
export function symbolRotation(typ: string, rotation?: Rotation): number {
  if (FIGUR_TYPEN.has(typ as SymbolTyp) || symbolDef(typ).perspektivisch) return 0;
  return rotation ?? 0;
}

/** Achsenparallele Masse eines Symbols in seiner Drehlage. Der Anker bleibt der
 *  Mittelpunkt (Anker-Vertrag), die Rotation dreht um ihn — Auswahl-Rahmen,
 *  Rand-Begrenzung und Vorschau-Einpassung müssen sie darum mitdrehen, sonst
 *  liegt etwa um eine waagrecht gedrehte Stange ein hochkanter Rahmen.
 *  45°-Schritte: 90/270 tauschen die Masse, die Diagonalen ergeben das
 *  umschliessende Quadrat mit Seite (b + h) / √2. */
export function symbolMasse(typ: string, rotation?: Rotation): { breite: number; hoehe: number } {
  const { breite, hoehe } = symbolDef(typ);
  switch (symbolRotation(typ, rotation)) {
    case 0:
    case 180:
      return { breite, hoehe };
    case 90:
    case 270:
      return { breite: hoehe, hoehe: breite };
    default: {
      const seite = (breite + hoehe) / Math.SQRT2;
      return { breite: seite, hoehe: seite };
    }
  }
}
