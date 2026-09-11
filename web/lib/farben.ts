/**
 * Die Farbpalette des Designsystems als TypeScript-Zwilling von
 * `app/globals.css` (Material 2 Dark: Grund plus weisses Overlay je Höhe).
 *
 * Warum es diese Datei gibt, obwohl die Farben schon im CSS stehen:
 *
 * - **Kontrast ist eine Rechnung, keine Meinung.** Ob Schrift auf einer Fläche
 *   lesbar bleibt, entscheidet die relative Luminanz nach WCAG 2.1 — nicht der
 *   Eindruck im Screenshot. Diese Datei liefert die Zahlen, mit denen
 *   `scripts/pruefe-farben.ts` jede Paarung nachrechnet, statt sie zu glauben.
 * - **CSS kann nicht rechnen.** Die Höhenleiter ist definitionsgemäss weisses
 *   Overlay über dem Grund; im `@theme` stehen aber literale Hex-Werte, weil
 *   `color-mix()` für eine Prüfung nicht lesbar ist und Tailwind v4 die Werte
 *   in Utilities einbacken muss. Hier steht die Herleitung (`overlay`) neben
 *   dem Ergebnis (`hex`), sodass ein Tippfehler auffällt.
 * - **Zwei Quellen driften.** Darum ist keine der beiden generiert: Das CSS
 *   bleibt die Quelle für den Browser, dieses Modul die Quelle für Rechnung
 *   und Prüfung — und `scripts/pruefe-farben.ts` hält sie Wert für Wert
 *   gleich, so wie `lib/altersstufe.ts` seinen SQL-Zwilling benennt.
 *
 * Keine Abhängigkeiten, alle Funktionen rein: Das Modul läuft im Skript
 * (Node), im Server und im Browser gleich.
 */

/** Der Grund, über dem die ganze Höhenleiter liegt (`--color-elev-00`). */
export const GRUND = "#101613";

/**
 * Die Höhenleiter: Material 2 drückt Höhe im Dunkelmodus durch ein weisses
 * Overlay aus, dessen Deckung mit den dp steigt. `dp` ist die Materialhöhe
 * (und damit der Tokenname), `overlay` die Deckung in Prozent, `hex` das
 * ausgerechnete Ergebnis — genau der Wert, der im `@theme` steht.
 *
 * Dass `hex` wirklich aus `overlay` folgt, prüft `pruefe-farben.ts` Stufe für
 * Stufe; von Hand nachgerechnet wird hier nichts.
 */
export const ELEV = [
  { dp: 0, overlay: 0, hex: "#101613" },
  { dp: 1, overlay: 5, hex: "#1c221f" },
  { dp: 2, overlay: 7, hex: "#212624" },
  { dp: 3, overlay: 8, hex: "#232926" },
  { dp: 4, overlay: 9, hex: "#262b28" },
  { dp: 6, overlay: 11, hex: "#2a302d" },
  { dp: 8, overlay: 12, hex: "#2d322f" },
  { dp: 12, overlay: 14, hex: "#313734" },
  { dp: 16, overlay: 15, hex: "#343936" },
  { dp: 24, overlay: 16, hex: "#363b39" },
] as const;

export type ElevStufe = (typeof ELEV)[number];

/** Der Tokenname einer Höhenstufe: zweistellig, wie im CSS (`elev-04`). */
export function elevName(dp: number): string {
  return `elev-${String(dp).padStart(2, "0")}`;
}

/** Eine Höhenstufe nachschlagen — wirft, statt `undefined` weiterzureichen. */
export function elev(dp: ElevStufe["dp"]): string {
  const stufe = ELEV.find((s) => s.dp === dp);
  if (!stufe) throw new Error(`Keine Höhenstufe ${dp} dp in der Leiter.`);
  return stufe.hex;
}

// ── Akzente ────────────────────────────────────────────────────────────────
// Die Baseline-Palette von Material 2 Dark. `SECONDARY` trägt die Rolle, wird
// aber nirgends angewendet (Vertrag §1) — sie steht hier, damit die Prüfung
// den Token im CSS nicht als tot meldet.
export const PRIMARY = "#bb86fc";
export const ON_PRIMARY = "#000000";
export const SECONDARY = "#03dac6";
export const ON_SECONDARY = "#000000";
export const ERROR = "#cf6679";
export const ON_ERROR = "#000000";
/** Verdunkelung hinter Dialogen und über Bildern; nie als Schriftfarbe. */
export const SCRIM = "#000000";

// ── Schrift und Striche ────────────────────────────────────────────────────
/**
 * Schrift ist immer Weiss — unterschieden wird über die Deckung, nicht über
 * eine zweite Farbe. `tief` ist ausschliesslich für Deaktiviertes und braucht
 * darum nur die 3:1 für unwesentlichen Text.
 */
export const SCHRIFT = { hoch: 1, mittel: 0.74, tief: 0.38 } as const;

/** Trenner und Haarlinien (1 px). */
export const LINIE = 0.12;
/** Kontur von Feld, Chip und Knopf (1.5 px) — muss tragen, nicht nur teilen. */
export const KANTE = 0.28;

// ── Alterskategorien ───────────────────────────────────────────────────────
/**
 * G/F/E Kinderfussball, D/C/B/A Juniorenfussball. Sie erscheinen als Kontur
 * und Schrift auf dem Grund und auf der Karte (nie als Fläche — ausser im
 * Druck), müssen also auf elev-00 UND elev-01 als Schrift lesbar sein.
 *
 * Zweite Bedingung: Keine darf mit Primary verwechselbar sein, sonst liest
 * sich eine Kategorie-Plakette wie ein aktiver Zustand.
 */
export const KAT = {
  g: "#5eb3f5",
  f: "#e6c044",
  e: "#ff8a65",
  d: "#5ee0a0",
  c: "#f48fb1",
  b: "#a5b4fc",
  a: "#cfd8dc",
} as const;

export type KatSchluessel = keyof typeof KAT;

// ── Zustände ───────────────────────────────────────────────────────────────
/**
 * Deckung der Zustands-Ebene (`@utility state`), in der Farbe des Inhalts.
 *
 * Drei Zustände, nicht Materials vier: «gezogen» fehlt, weil das Einzige, was
 * in dieser Anwendung gezogen wird, Diagramm-Elemente sind — und die leben im
 * SVG, nicht im DOM. Eine Deckung, die kein DOM-Zustand je auslöst, wäre ein
 * totes Token.
 */
export const ZUSTAND = {
  hover: 0.04,
  focus: 0.12,
  pressed: 0.1,
} as const;

// ── Rollen-Tabellen (der eigentliche Zwilling) ─────────────────────────────
/**
 * Alle `--color-*`-Rollen des Bildschirms mit ihrem literalen Wert — aus den
 * Einzelwerten oben zusammengesetzt, damit es keine dritte Stelle gibt, an
 * der eine Farbe steht.
 */
export const BILDSCHIRM: Readonly<Record<string, string>> = {
  ...Object.fromEntries(ELEV.map((s) => [elevName(s.dp), s.hex])),
  primary: PRIMARY,
  "on-primary": ON_PRIMARY,
  secondary: SECONDARY,
  "on-secondary": ON_SECONDARY,
  error: ERROR,
  "on-error": ON_ERROR,
  scrim: SCRIM,
  // Deckend — `SCHRIFT.hoch` ist 1, ein Alphakanal wäre nur Rauschen.
  "on-surface": "#ffffff",
  "on-surface-mittel": hex8("#ffffff", SCHRIFT.mittel),
  "on-surface-tief": hex8("#ffffff", SCHRIFT.tief),
  linie: hex8("#ffffff", LINIE),
  kante: hex8("#ffffff", KANTE),
  ...Object.fromEntries(Object.entries(KAT).map(([k, v]) => [`kat-${k}`, v])),
};

/**
 * Die Überschreibungen im `@media print`. Papier ist weiss und hat keine
 * Höhenleiter im Wortsinn — die Stufen werden zu immer dunkleren Grautönen,
 * damit gestapelte Karten sich weiter voneinander abheben.
 *
 * Primary und Error werden dunkel: Ein Lila mit 4.3:1 auf Schwarz hat auf
 * Weiss nur noch 2.8:1. Die beiden Kategorien, die im Druck als Fläche
 * erscheinen (kat-a und kat-f), tragen darum eigene, kräftigere Werte.
 */
export const DRUCK = {
  "elev-00": "#ffffff",
  "elev-01": "#f6f7f6",
  "elev-02": "#f1f2f1",
  "elev-03": "#eeefee",
  "elev-04": "#ececec",
  "elev-06": "#e9e9e9",
  "elev-08": "#e6e6e6",
  "elev-12": "#e2e2e2",
  "elev-16": "#dfdfdf",
  "elev-24": "#dcdcdc",
  "on-surface": "#121a16",
  "on-surface-mittel": "#3c423f",
  "on-surface-tief": "#6b716e",
  kante: "#9aa0a0",
  linie: "#cfd3d2",
  primary: "#4527a0",
  "on-primary": "#ffffff",
  error: "#a32036",
  "on-error": "#ffffff",
  "kat-a": "#78909c",
  "kat-f": "#b8960f",
} as const;

/** Die Schriftfarbe des Drucks — sie liegt auf jeder gedruckten Fläche. */
export const DRUCK_SCHRIFT = DRUCK["on-surface"];

// ── Rechnung ───────────────────────────────────────────────────────────────

/** Die drei Kanäle eines 6-stelligen Hex-Werts als 0…255. */
function kanaele(hex: string): [number, number, number] {
  const treffer = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!treffer) {
    throw new Error(`Kein 6-stelliger Hex-Wert: ${hex}`);
  }
  const roh = treffer[1];
  return [
    parseInt(roh.slice(0, 2), 16),
    parseInt(roh.slice(2, 4), 16),
    parseInt(roh.slice(4, 6), 16),
  ];
}

function zweiHex(wert: number): string {
  return Math.max(0, Math.min(255, wert)).toString(16).padStart(2, "0");
}

/**
 * Einen halbtransparenten Vordergrund über einen deckenden Hintergrund legen
 * und den entstehenden deckenden Wert zurückgeben (sRGB-Komposit, kanalweise
 * gerundet — genau das, was der Browser zeichnet).
 *
 * Das ist die Rechnung hinter der Höhenleiter (Weiss über GRUND) und hinter
 * jeder Kontrastprüfung von Schrift, die über Hex8 gesetzt ist: Gegen eine
 * halbtransparente Farbe lässt sich kein Kontrast rechnen, gegen ihr
 * Kompositergebnis schon.
 */
export function ueberlagern(
  vordergrundHex: string,
  alpha: number,
  hintergrundHex: string,
): string {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new Error(`Deckung ausserhalb 0…1: ${alpha}`);
  }
  const v = kanaele(vordergrundHex);
  const h = kanaele(hintergrundHex);
  return `#${v.map((c, i) => zweiHex(Math.round(alpha * c + (1 - alpha) * h[i]))).join("")}`;
}

/** Relative Luminanz nach WCAG 2.1 (sRGB linearisiert, nach Y gewichtet). */
export function relativeLuminanz(hex: string): number {
  const [r, g, b] = kanaele(hex).map((c) => {
    const anteil = c / 255;
    return anteil <= 0.03928 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Kontrastverhältnis zweier deckender Farben nach WCAG 2.1, 1…21.
 * Die Reihenfolge der Argumente spielt keine Rolle.
 */
export function kontrast(a: string, b: string): number {
  const la = relativeLuminanz(a);
  const lb = relativeLuminanz(b);
  const [hell, dunkel] = la >= lb ? [la, lb] : [lb, la];
  return (hell + 0.05) / (dunkel + 0.05);
}

/**
 * Einen Hex6-Wert mit einer Deckung zu Hex8 verbinden — die Schreibweise, in
 * der Schrift- und Strichfarben im `@theme` stehen (`#ffffffbd` = Weiss, 74 %).
 */
export function hex8(hexRgb: string, alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new Error(`Deckung ausserhalb 0…1: ${alpha}`);
  }
  const [r, g, b] = kanaele(hexRgb);
  return `#${zweiHex(r)}${zweiHex(g)}${zweiHex(b)}${zweiHex(Math.round(alpha * 255))}`;
}

/** Euklidischer Abstand zweier Farben im RGB-Würfel (0…441). Grobes Mass —
 *  es genügt, um «verwechselbar» von «klar verschieden» zu trennen. */
export function rgbAbstand(a: string, b: string): number {
  const ka = kanaele(a);
  const kb = kanaele(b);
  return Math.hypot(ka[0] - kb[0], ka[1] - kb[1], ka[2] - kb[2]);
}
