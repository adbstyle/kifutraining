/**
 * Die Farbpalette des Designsystems als TypeScript-Zwilling von
 * `app/globals.css` (Material 2 Dark: Grund plus weisses Overlay je Höhe;
 * dazu die Rollen der Atlassian-Bausteine Lozenge und Section Message).
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
// Aus der Baseline-Palette von Material 2 Dark nur der eine Akzent: Secondary
// ist entfallen — ein zweiter Akzent neben Primary konkurrierte nur, ohne
// etwas zu benennen.
export const PRIMARY = "#bb86fc";
export const ON_PRIMARY = "#000000";
/**
 * Eine Stufe heller als Materials Baseline (#cf6679): Die ist als Fläche
 * gedacht und trägt als Schrift nur auf dem Grund (5.09), im Dialog fällt sie
 * auf 3.17. Diese Anwendung setzt Error fast überall als SCHRIFT — auf Karten,
 * in Menüzeilen, in Dialogen —, darum der hellere Ton: er trägt auf jeder
 * Höhenstufe über 4.5:1. Der Druckwert (`DRUCK.error`) bleibt davon unberührt,
 * er hat auf Papier ein anderes Problem.
 */
export const ERROR = "#e58a95";
/**
 * Die Fläche des destruktiven Knopfs (PO 2026-10-06: gefüllt rot, weisse
 * Schrift). Nicht `ERROR`: Auf dem hellen Schrift-Rot käme Weiss nur auf
 * 2.50:1. Der Wert ist Atlassians `color.background.danger.bold` (helles
 * Theme) und trägt Weiss mit 5.16:1. Gegen den Dialog (24dp) hebt sich die
 * Fläche nur mit gut 2:1 ab — den Knopf erkennbar macht seine Aufschrift.
 */
export const DANGER = "#c9372c";
export const ON_DANGER = "#ffffff";
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

// ── Umgekehrte Fläche ──────────────────────────────────────────────────────
/**
 * Die eine Fläche, die die Palette umkehrt: die Snackbar (#234). Sie meldet
 * einen Vorgang am Bildrand und geht von selbst — sie muss darum beim ersten
 * Hinsehen auffallen. Auf elev-06 hob sie sich nur 1.36:1 vom Grund ab; hell
 * steht sie bei rund 14:1. So meint Material die Snackbar auch (M2 Dark wie
 * M3 «Inverse Surface»).
 *
 * Die Fläche ist Weiss in `deckung` über dem Grund — dieselbe Herleitung wie
 * die Höhenleiter, nur am anderen Ende. Die Schrift darauf ist der Grund
 * selbst, der Akzent das dunkle Violett, das auch auf Papier trägt: Auf der
 * hellen Fläche hätte `PRIMARY` nur 2:1.
 */
export const UMKEHR = {
  deckung: 0.87,
  flaeche: "#e0e1e0",
  schrift: GRUND,
  akzent: "#4527a0",
} as const;

// ── Atlassian: Lozenge, Badge, Section Message ────────────────────────────
/**
 * Drei Bausteine folgen nicht Material, sondern dem Atlassian Design System
 * (wie Jira): die Lozenge (Plakette), die Badge (Zähler) und die Section
 * Message (Meldung im Fluss der Seite). Ihre Farben stehen hier WÖRTLICH aus
 * `@atlaskit/tokens` (20.2.0) — der Bildschirm aus dem Theme `atlassian-dark`,
 * der Druck aus `atlassian-light`. Nachgemischt wird nichts: Wer Jira kennt,
 * soll dieselben Töne wiedererkennen.
 *
 * Lozenge: `flaeche` ist ADS `color.background.<x>.subtler` (bei `neutral`
 * `color.background.neutral`, bei `accent-gray` `…accent.gray.subtlest`),
 * `schrift` ist `color.text.<x>.bolder` (bei `neutral` `color.text`).
 * Die Akzente tragen die Alterskategorien; geführt sind nur die sieben, die
 * eine Kategorie belegt.
 */
export const LOZENGE = {
  neutral: { flaeche: "#ceced912", schrift: "#cecfd2" },
  success: { flaeche: "#37471f", schrift: "#d3f1a7" },
  warning: { flaeche: "#693200", schrift: "#fce4a6" },
  danger: { flaeche: "#5d1f1a", schrift: "#ffd5d2" },
  information: { flaeche: "#123263", schrift: "#cfe1fd" },
  discovery: { flaeche: "#48245d", schrift: "#eed7fc" },
  "accent-blue": { flaeche: "#123263", schrift: "#cfe1fd" },
  "accent-yellow": { flaeche: "#533f04", schrift: "#f5e989" },
  "accent-orange": { flaeche: "#693200", schrift: "#fce4a6" },
  "accent-green": { flaeche: "#164b35", schrift: "#baf3db" },
  "accent-magenta": { flaeche: "#50253f", schrift: "#fdd0ec" },
  "accent-purple": { flaeche: "#48245d", schrift: "#eed7fc" },
  "accent-gray": { flaeche: "#303134", schrift: "#e2e3e4" },
} as const;

export type LozengeAppearance = keyof typeof LOZENGE;

/** Dieselben Rollen aus `atlassian-light` — die Lozenge auf Papier. */
export const LOZENGE_DRUCK: Record<LozengeAppearance, { flaeche: string; schrift: string }> = {
  neutral: { flaeche: "#0515240f", schrift: "#292a2e" },
  success: { flaeche: "#d3f1a7", schrift: "#37471f" },
  warning: { flaeche: "#fce4a6", schrift: "#693200" },
  danger: { flaeche: "#ffd5d2", schrift: "#5d1f1a" },
  information: { flaeche: "#cfe1fd", schrift: "#123263" },
  discovery: { flaeche: "#eed7fc", schrift: "#48245d" },
  "accent-blue": { flaeche: "#cfe1fd", schrift: "#123263" },
  "accent-yellow": { flaeche: "#f5e989", schrift: "#533f04" },
  "accent-orange": { flaeche: "#fce4a6", schrift: "#693200" },
  "accent-green": { flaeche: "#baf3db", schrift: "#164b35" },
  "accent-magenta": { flaeche: "#fdd0ec", schrift: "#50253f" },
  "accent-purple": { flaeche: "#eed7fc", schrift: "#48245d" },
  "accent-gray": { flaeche: "#f0f1f2", schrift: "#1e1f21" },
};

/**
 * Section Message: `flaeche` ist ADS `color.background.<x>`, `icon` ist
 * `color.icon.<x>`. Die Schrift darauf ist die gewöhnliche (`on-surface`).
 * Die Darstellung `error` der Section Message liegt auf `danger` — so heisst
 * die Rolle bei Atlassian, nur die Komponente sagt «error».
 */
export const SECTION = {
  information: { flaeche: "#1c2b42", icon: "#4688ec" },
  warning: { flaeche: "#3a2c1f", icon: "#fbc828" },
  danger: { flaeche: "#42221f", icon: "#f15b50" },
  success: { flaeche: "#28311b", icon: "#82b536" },
  discovery: { flaeche: "#35243f", icon: "#bf63f3" },
} as const;

export type SectionRolle = keyof typeof SECTION;

/** Dieselben Rollen aus `atlassian-light` — die Section Message auf Papier. */
export const SECTION_DRUCK: Record<SectionRolle, { flaeche: string; icon: string }> = {
  information: { flaeche: "#e9f2fe", icon: "#357de8" },
  warning: { flaeche: "#fff5db", icon: "#e06c00" },
  danger: { flaeche: "#ffeceb", icon: "#c9372c" },
  success: { flaeche: "#efffd6", icon: "#6a9a23" },
  discovery: { flaeche: "#f8eefe", icon: "#af59e1" },
};

/** Die `--color-*`-Rollen eines Lozenge- und eines Section-Satzes. */
function atlassianRollen(
  lozenge: Record<LozengeAppearance, { flaeche: string; schrift: string }>,
  section: Record<SectionRolle, { flaeche: string; icon: string }>,
): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(lozenge).flatMap(([k, { flaeche, schrift }]) => [
        [`lozenge-${k}`, flaeche],
        [`on-lozenge-${k}`, schrift],
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(section).flatMap(([k, { flaeche, icon }]) => [
        [`section-${k}`, flaeche],
        [`icon-${k}`, icon],
      ]),
    ),
  };
}

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
  error: ERROR,
  danger: DANGER,
  "on-danger": ON_DANGER,
  scrim: SCRIM,
  // Deckend — `SCHRIFT.hoch` ist 1, ein Alphakanal wäre nur Rauschen.
  "on-surface": "#ffffff",
  "on-surface-mittel": hex8("#ffffff", SCHRIFT.mittel),
  "on-surface-tief": hex8("#ffffff", SCHRIFT.tief),
  linie: hex8("#ffffff", LINIE),
  kante: hex8("#ffffff", KANTE),
  umkehr: UMKEHR.flaeche,
  "on-umkehr": UMKEHR.schrift,
  "umkehr-akzent": UMKEHR.akzent,
  ...atlassianRollen(LOZENGE, SECTION),
};

/**
 * Die Überschreibungen im `@media print`. Papier ist weiss und hat keine
 * Höhenleiter im Wortsinn — die Stufen werden zu immer dunkleren Grautönen,
 * damit gestapelte Karten sich weiter voneinander abheben.
 *
 * Primary und Error werden dunkel: Ein Lila mit 4.3:1 auf Schwarz hat auf
 * Weiss nur noch 2.8:1. Lozenge und Section Message wechseln auf Papier in
 * Atlassians helles Theme.
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
  danger: "#a32036",
  "on-danger": "#ffffff",
  ...atlassianRollen(LOZENGE_DRUCK, SECTION_DRUCK),
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

/**
 * Eine Farbe deckend machen: Hex8 wird über den Untergrund gelegt, Hex6 bleibt
 * wie er ist. Nötig für Rollen mit Alphakanal wie `lozenge-neutral`, gegen die
 * sich sonst kein Kontrast rechnen lässt.
 */
export function deckend(farbe: string, untergrund: string): string {
  const treffer = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(farbe.trim());
  return treffer ? ueberlagern(`#${treffer[1]}`, parseInt(treffer[2], 16) / 255, untergrund) : farbe;
}

/** Euklidischer Abstand zweier Farben im RGB-Würfel (0…441). Grobes Mass —
 *  es genügt, um «verwechselbar» von «klar verschieden» zu trennen. */
export function rgbAbstand(a: string, b: string): number {
  const ka = kanaele(a);
  const kb = kanaele(b);
  return Math.hypot(ka[0] - kb[0], ka[1] - kb[1], ka[2] - kb[2]);
}
