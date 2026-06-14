import type { ReactNode } from "react";
import { FARBEN, type FarbSlug, type SymbolTyp, type SpielerPose, type Rotation, DREHBARE_TYPEN } from "@/lib/diagramm";
import { figurMarkup, figurTransform } from "./figur";

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

/* ───────────────────────── Minitor (perspektivisch) ─────────────────────────
 * Pop-up-Minitor im SFV-Manual-Look: heller Bügel, weisses Netz, dunkelgraue
 * Bodenstange + Füsse. Statt sich flach zu drehen, zeigt es je Orientierung
 * eine eigene 2.5D-Ansicht (Front / Dreiviertel / Seite / Rück). Alle Sprites
 * zeichnen zentriert um (0,0) und passen in die 100×48-Box (#55 Anker-Vertrag).
 */
const MT = {
  rohr: "#eceff1",
  rohrKante: "rgba(0,0,0,.18)",
  netz: (o: number) => `rgba(255,255,255,${o})`,
  boden: "#37474f",
  fuss: "#263238",
};

/** Auf 2 Nachkommastellen runden — Netzkoordinaten entstehen aus sqrt/Potenz;
 *  Server- und Client-Engine runden das letzte Float-Bit minimal verschieden,
 *  gerundet bleibt die Ausgabe hydrations-stabil (vgl. DiagrammView.r2). */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Kuppel-Geometrie der Front-/Rückansicht: Parabel vom Fuss (±44, 20) über die
 *  Kuppe (0, -28). Das Netz endet aber bereits am Saum (MT_SAUM) — der grüne
 *  Spalt darunter zur Torschnur (Bodenschnur) ist gewollt (Soll-Vorgabe). */
const MT_HALB = 44;
const MT_KUPPE = -28; // Scheitel
const MT_SAUM = 14; // Eckpunkte des Bügels (unterer Rahmenrand)
const MT_RIM_SAG = 18; // Durchhang der unteren Rahmenkante in der Mitte
const MT_BODEN = 22; // Torschnur / Boden vorn (mit Lücke zum Saum darüber)
const mtTop = (x: number) => MT_KUPPE + (MT_SAUM - MT_KUPPE) * (x / MT_HALB) ** 2;
/** x-Halbweite der Kuppel auf Höhe y (Umkehrung der Parabel). */
const mtHalbweite = (y: number) => MT_HALB * Math.sqrt(Math.max(0, (y - MT_KUPPE) / (MT_SAUM - MT_KUPPE)));
/** Oberer Bügel: Parabel von Ecke (±44, 14) über die Kuppe (0, -28). */
const MT_BOGEN = `M ${-MT_HALB} ${MT_SAUM} Q ${-MT_HALB - 6} ${MT_KUPPE + 2} 0 ${MT_KUPPE} Q ${MT_HALB + 6} ${MT_KUPPE + 2} ${MT_HALB} ${MT_SAUM}`;
/** Untere Rahmenkante (verstärkter weisser Rand AUCH am Boden): leichter
 *  Durchhang zwischen den Ecken — schliesst den Bügel zur Schlaufe. */
const MT_RAND = `M ${-MT_HALB} ${MT_SAUM} Q 0 ${MT_RIM_SAG} ${MT_HALB} ${MT_SAUM}`;
/** Netzfläche: oben Bügel, unten die durchhängende Rahmenkante. */
const MT_NETZ_FLAECHE = `M ${-MT_HALB} ${MT_SAUM} Q -50 ${MT_KUPPE - 2} 0 ${MT_KUPPE} Q 50 ${MT_KUPPE - 2} ${MT_HALB} ${MT_SAUM} Q 0 ${MT_RIM_SAG} ${-MT_HALB} ${MT_SAUM} Z`;

/** Feines Netz unter der Kuppel: zur Kuppe konvergierende Meridiane +
 *  Breitengrad-Bögen, bis zum Saum. `dichte` kleiner = feineres Netz;
 *  `opacity` steuert das Durchschimmern. */
function mtNetz(dichte: number, opacity: number) {
  const linien: ReactNode[] = [];
  for (let x = -MT_HALB + 4; x <= MT_HALB - 4; x += dichte) {
    const top = mtTop(x);
    if (top >= MT_SAUM - 1) continue;
    linien.push(<line key={`v${x}`} x1={r2(x)} y1={MT_SAUM} x2={r2(x * 0.42)} y2={r2(top + 1.5)} />);
  }
  for (let y = MT_KUPPE + 6; y < MT_SAUM - 1; y += dichte * 0.82) {
    const xw = mtHalbweite(y) - 1.5;
    linien.push(<path key={`h${y}`} d={`M ${r2(-xw)} ${r2(y)} Q 0 ${r2(y + 2.4)} ${r2(xw)} ${r2(y)}`} />);
  }
  return (
    <g fill="none" stroke={MT.netz(opacity)} strokeWidth={0.7} strokeLinecap="round">
      {linien}
    </g>
  );
}

/** Helles Rohr mit dunkler Aussenkante — gibt dem verstärkten Rand Tube-
 *  Plastizität. `breite` = Rohrstärke (Bügel kräftiger als Bodenrand). */
function mtRohr(d: string, opacity = 1, breite = 4.5) {
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={MT.rohrKante} strokeWidth={breite + 2} strokeLinecap="round" />
      <path d={d} fill="none" stroke={MT.rohr} strokeWidth={breite} strokeLinecap="round" />
    </g>
  );
}

/** Klare Torschnur (Bodenschnur) auf Höhe y, mit dunklen Füssen — vorne, vor
 *  dem Netz, mit grünem Spalt zum Saum darüber. */
function mtTorschnur(y: number) {
  return (
    <>
      <line x1={-MT_HALB} y1={y} x2={MT_HALB} y2={y} stroke={MT.boden} strokeWidth={5} strokeLinecap="round" />
      <circle cx={-MT_HALB} cy={y} r={4.5} fill={MT.fuss} />
      <circle cx={MT_HALB} cy={y} r={4.5} fill={MT.fuss} />
    </>
  );
}

/** Schwach durchschimmernde Torschnur (Rückseite): sie liegt HÖHER als der
 *  untere Netzrand — das Netz hängt davor/darunter (Soll-Vorgabe). */
function mtTorschnurSchwach(y: number) {
  return <line x1={-MT_HALB + 5} y1={y} x2={MT_HALB - 5} y2={y} stroke={MT.boden} strokeWidth={3} strokeLinecap="round" opacity={0.3} />;
}

/** Kuppel (Single Source für Front + Dreiviertel). Bügel + verstärkter Boden-
 *  rand bilden eine geschlossene weisse Schlaufe; das Netz liegt darin.
 *  `rueck` = Blick auf die geschlossene Netzwand: dichteres, blasseres Netz,
 *  die Torschnur schimmert HÖHER als der Netzrand durch, kein Logo. Vorn:
 *  klare Torschnur tiefer mit grünem Spalt zum Saum. */
function mtKuppel(rueck: boolean) {
  return (
    <>
      <path d={MT_NETZ_FLAECHE} fill={MT.netz(rueck ? 0.18 : 0.1)} stroke="none" />
      {/* Rückseite: Schnur höher und HINTER dem Netz → Netz hängt davor/tiefer. */}
      {rueck && mtTorschnurSchwach(MT_SAUM - 6)}
      {mtNetz(rueck ? 5 : 6.5, rueck ? 0.3 : 0.42)}
      {mtRohr(MT_BOGEN, rueck ? 0.92 : 1)}
      {mtRohr(MT_RAND, rueck ? 0.92 : 1, 3.5)}
      {/* Front: Torschnur klar, tiefer als der Saum (grüner Spalt dazwischen). */}
      {!rueck && mtTorschnur(MT_BODEN)}
      {!rueck && <circle cx={0} cy={-14} r={3} fill="none" stroke={MT.netz(0.5)} strokeWidth={1.1} />}
    </>
  );
}

function mtFront() {
  return mtKuppel(false);
}

function mtRueck() {
  return mtKuppel(true);
}

/** Dreiviertel = dieselbe Kuppel um eine feste Neigung gekippt; dadurch läuft
 *  die Torschnur diagonal und man blickt schräg auf das Tor (Soll). Vorn mit
 *  perspektivisch verkürzter Öffnung, hinten geschlossene Netzwand. */
function mtDreiviertel(rueck: boolean) {
  return (
    <g transform="rotate(-17)">
      {!rueck && <ellipse cx={0} cy={MT_SAUM} rx={mtHalbweite(MT_SAUM - 1)} ry={7} fill={MT.netz(0.08)} stroke="none" />}
      {mtKuppel(rueck)}
    </g>
  );
}

function mtDreiviertelVorn() {
  return mtDreiviertel(false);
}

function mtDreiviertelHinten() {
  return mtDreiviertel(true);
}

/** Seite (90°, Spiegel für 270°): Halbkuppel-Profil — vertikale Rückkante
 *  rechts, gewölbte Front nach links, die zum Boden ausläuft (Öffnung links).
 *  Verstärkter weisser Rand rundum, Saumlücke + kleine Torschnur (Soll-Skizze). */
function mtSeite() {
  // Viertelkuppel von der Seite: kräftige, fast senkrechte Rückkante rechts;
  // die Front wölbt sich nach links und läuft zum Boden aus (Öffnung links) —
  // gemäss der Soll-Skizze. Verstärkter Rand rundum, Saumlücke + Torschnur.
  const frame = "M 10 15 L 10 -25 Q 10 -30 4 -30 Q -19 -27 -16 15";
  const rand = "M -16 15 Q -4 18 10 15";
  const flaeche = "M 10 15 L 10 -24 Q 10 -28 4 -28 Q -16 -25 -13 15 Q -2 17 10 15 Z";
  return (
    <>
      <path d={flaeche} fill={MT.netz(0.12)} stroke="none" />
      <g fill="none" stroke={MT.netz(0.4)} strokeWidth={0.7} strokeLinecap="round">
        {/* Meridiane: vom vorderen Boden hoch zur hinteren Kuppe */}
        <path d="M -10 13 Q 1 -15 7 -27" />
        <path d="M -3 14 Q 5 -12 9 -25" />
        <path d="M 5 14 Q 8 -9 10 -22" />
        {/* Breitengrade entlang der Wölbung */}
        <path d="M -14 5 Q -2 1 9 3" />
        <path d="M -11 -8 Q 0 -12 9 -10" />
        <path d="M -4 -19 Q 3 -22 8 -20" />
      </g>
      {mtRohr(frame)}
      {mtRohr(rand, 1, 3.5)}
      {/* schmale Torschnur am Boden, mit Lücke zum Saum darüber */}
      <line x1={-16} y1={MT_BODEN} x2={10} y2={MT_BODEN} stroke={MT.boden} strokeWidth={5} strokeLinecap="round" />
      <circle cx={-16} cy={MT_BODEN} r={4.5} fill={MT.fuss} />
      <circle cx={10} cy={MT_BODEN} r={4.5} fill={MT.fuss} />
    </>
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
        <path d="M 0 -14 Q 9 -1 13 13 L 2 13 Q 1.5 -3 0 -14 Z" fill="rgba(0,0,0,.16)" />
        <path d="M -1 -13 Q -6 -3 -8 11" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth={2} strokeLinecap="round" />
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
    breite: 75,
    hoehe: 145,
    drehbar: DREHBARE_TYPEN.has("spieler"),
    faerbbar: true,
    defaultFarbe: "rot",
    // Cartoon-Kind, Trikot = Team-Farbe; Pose/Spiegeln/Frisur über opts (Epic #47).
    render: (farbe, opts) => (
      <g
        transform={figurTransform(opts?.spiegeln)}
        dangerouslySetInnerHTML={{
          __html: figurMarkup({
            torwart: false,
            pose: opts?.pose,
            trikot: farbe,
            seed: opts?.seed ?? "spieler",
          }),
        }}
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
      <g
        transform={figurTransform(opts?.spiegeln)}
        dangerouslySetInnerHTML={{
          __html: figurMarkup({
            torwart: true,
            trikot: "#c0ca33",
            seed: opts?.seed ?? "torwart",
          }),
        }}
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
