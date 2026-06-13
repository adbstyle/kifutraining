/**
 * Cartoon-Kinder als Spieler-/Torwart-Figuren der Feld-Diagramme (Epic #47).
 *
 * Die Figuren ersetzen die früheren Aufsicht-Tokens (Decision: „Ersetzen").
 * Trikotfarbe ist EIN konfigurierbarer Fill (Team-Farbe, kommt aus dem
 * Element); Hose/Stutzen/Schuhe/Haut/Haar sind fix. Frisur und Hautton werden
 * pro Element deterministisch aus der id variiert (Vielfalt ohne Persistenz),
 * die Pose wird gewählt und gespeichert.
 *
 * Die Geometrie ist bewusst hier zentral (wie das Symbol-Register): eine neue
 * Figuren-Version wirkt sofort auf bestehende Diagramme, ohne Standbild.
 *
 * Zeichen-Raum: 0..200 (x) × 0..280 (y), Figur-Anker (Körpermitte) bei
 * (100, 140). `figurTransform` zentriert den Anker auf (0,0), skaliert auf
 * Feldgrösse und spiegelt optional die Blickrichtung.
 */

import type { SpielerPose } from "@/lib/diagramm";

// --- Palette (fix, unabhängig von der Trikotfarbe) ---
const SKIN = ["#ffdbac", "#e6a878", "#c68642", "#8d5524"] as const;
const HAAR = ["#3a2a20", "#1c1c1c", "#e8b84b", "#7a4a1e"] as const;
const FRISUREN = ["kurz", "lockig", "zopf", "dutt", "lang"] as const;
type Frisur = (typeof FRISUREN)[number];
const SHORT = "#37474f";
const SOCK = "#fafafa";
const SHOE = "#222";
const TORWART_TRIKOT = "#c0ca33"; // Neon, hebt den Torwart ab (faerbbar:false)

/** Figur-Anker (Körpermitte) im Zeichen-Raum. */
const ANKER_X = 100;
const ANKER_Y = 140;
/** Skalierung Zeichen-Raum → Feld-Einheiten (Figurhöhe ~125). */
const SCALE = 0.55;

/** Transform für die Figur: Anker auf (0,0), skaliert, optional gespiegelt.
 *  Wird im Symbol-Register an das zentrierte `<g>` gehängt. */
export function figurTransform(spiegeln?: boolean): string {
  const sx = spiegeln ? -SCALE : SCALE;
  return `scale(${sx} ${SCALE}) translate(${-ANKER_X} ${-ANKER_Y})`;
}

/** Stabiler kleiner Hash einer id → Frisur + Hautton + Haarfarbe. */
export function figurVariante(seed: string): { frisur: Frisur; haut: string; haar: string } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  return {
    frisur: FRISUREN[u % FRISUREN.length],
    haut: SKIN[(u >> 3) % SKIN.length],
    haar: HAAR[(u >> 6) % HAAR.length],
  };
}

// --- Kopf / Frisur ---
function frisurBack(haar: string, fr: Frisur): string {
  if (fr === "zopf")
    return `<path d="M126 40 Q150 44 150 66 Q150 86 137 90 Q147 70 132 56 Z" fill="${haar}"/>`;
  if (fr === "lang")
    return `<path d="M68 50 Q60 92 72 116 L82 116 Q74 84 82 56 Z" fill="${haar}"/><path d="M132 50 Q140 92 128 116 L118 116 Q126 84 118 56 Z" fill="${haar}"/>`;
  return "";
}
function frisurTop(haar: string, fr: Frisur): string {
  let s = `<circle cx="100" cy="48" r="33" fill="${haar}"/>`;
  if (fr === "lockig")
    s += [[78, 32], [92, 24], [108, 24], [122, 32], [70, 46], [130, 46]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${haar}"/>`)
      .join("");
  if (fr === "dutt") s += `<circle cx="100" cy="18" r="11" fill="${haar}"/>`;
  if (fr === "zopf") s += `<circle cx="129" cy="46" r="4" fill="#e53935"/>`;
  return s;
}
function kopfFront(skin: string, haar: string, fr: Frisur): string {
  return (
    frisurBack(haar, fr) +
    frisurTop(haar, fr) +
    `<circle cx="100" cy="56" r="29" fill="${skin}"/>` +
    `<circle cx="72" cy="58" r="6" fill="${skin}"/><circle cx="128" cy="58" r="6" fill="${skin}"/>` +
    `<circle cx="90" cy="56" r="3.2" fill="#222"/><circle cx="110" cy="56" r="3.2" fill="#222"/>` +
    `<circle cx="84" cy="66" r="4.4" fill="#ff9e9e" opacity="0.6"/><circle cx="116" cy="66" r="4.4" fill="#ff9e9e" opacity="0.6"/>` +
    `<path d="M91 66 Q100 76 109 66" stroke="#222" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
  );
}
/** Profilkopf, Blick nach rechts; Mitte (hx,hy). */
function kopfProfil(hx: number, hy: number, skin: string, haar: string, fr: Frisur): string {
  let s = `<circle cx="${hx - 2}" cy="${hy - 7}" r="31" fill="${haar}"/>`;
  if (fr === "zopf")
    s += `<path d="M${hx - 22} ${hy - 6} Q${hx - 44} ${hy - 2} ${hx - 44} ${hy + 18} Q${hx - 44} ${hy + 34} ${hx - 30} ${hy + 34} Q${hx - 36} ${hy + 14} ${hx - 22} ${hy + 6} Z" fill="${haar}"/>`;
  if (fr === "lockig")
    s += [[hx - 18, hy - 26], [hx - 2, hy - 30], [hx + 12, hy - 24], [hx - 30, hy - 12]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${haar}"/>`)
      .join("");
  s += `<circle cx="${hx}" cy="${hy}" r="27" fill="${skin}"/>`;
  s += `<path d="M${hx + 25} ${hy - 3} q9 5 1 11 q-3 -5 -1 -11 Z" fill="${skin}"/>`;
  s += `<circle cx="${hx - 13}" cy="${hy + 2}" r="5.5" fill="${skin}"/>`;
  s += `<circle cx="${hx + 10}" cy="${hy - 2}" r="3.2" fill="#222"/>`;
  s += `<circle cx="${hx + 4}" cy="${hy + 10}" r="4" fill="#ff9e9e" opacity="0.6"/>`;
  s += `<path d="M${hx + 13} ${hy + 13} q6 4 11 -1" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return s;
}
function schuh(x: number, y: number, dir: 1 | -1): string {
  return `<path d="M${x} ${y} q${-6 * dir} 11 ${10 * dir} 11 l${8 * dir} -2 q1 -10 ${-7 * dir} -11 Z" fill="${SHOE}"/>`;
}
const schatten = (cx: number, rx: number) =>
  `<ellipse cx="${cx}" cy="262" rx="${rx}" ry="9" fill="#000" opacity=".1"/>`;

// --- Posen (liefern Markup im Zeichen-Raum 0..200 × 0..280) ---
function stehen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    schatten(100, 50) +
    `<path d="M91 154 L87 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M109 154 L113 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M88 196 L85 218" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    <path d="M112 196 L115 218" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    ${schuh(80, 218, -1)}${schuh(120, 218, 1)}
    <path d="M70 148 L130 148 L128 178 Q128 184 121 184 L110 184 L100 162 L90 184 L79 184 Q72 184 72 178 Z" fill="${SHORT}"/>
    <path d="M74 106 L60 152" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
    <path d="M126 106 L140 152" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="60" cy="152" r="8" fill="${skin}"/><circle cx="140" cy="152" r="8" fill="${skin}"/>
    <path d="M72 98 Q72 92 82 92 L118 92 Q128 92 128 98 L131 150 Q131 156 123 156 L77 156 Q69 156 69 150 Z" fill="${j}"/>
    <path d="M74 100 L60 118" stroke="${j}" stroke-width="22" stroke-linecap="round"/>
    <path d="M126 100 L140 118" stroke="${j}" stroke-width="22" stroke-linecap="round"/>
    <rect x="93" y="80" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfFront(skin, haar, fr)}`
  );
}
function laufen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    schatten(104, 52) +
    `<path d="M96 156 Q82 186 74 210" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M84 188 Q78 200 74 210" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(70, 206, -1)}
    <path d="M124 108 Q140 118 136 134" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="136" cy="134" r="8" fill="${skin}"/>
    <path d="M72 148 L130 148 L130 176 Q130 182 123 182 L112 182 L100 162 L92 182 L80 182 Q73 182 73 176 Z" fill="${SHORT}"/>
    <path d="M106 156 Q124 178 126 200" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M124 184 Q126 192 126 200" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(122, 198, 1)}
    <path d="M76 108 Q62 120 66 136" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="66" cy="136" r="8" fill="${skin}"/>
    <path d="M73 100 Q73 94 83 94 L117 94 Q127 94 127 100 L130 150 Q130 156 122 156 L78 156 Q70 156 70 150 Z" fill="${j}"/>
    <path d="M76 102 Q66 110 62 122" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M124 102 Q134 110 138 122" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="93" y="82" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfFront(skin, haar, fr)}`
  );
}
function dribbeln(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    schatten(104, 50) +
    `<path d="M96 150 Q90 188 84 222" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M88 196 Q86 210 84 222" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(80, 220, -1)}
    <path d="M92 106 Q82 120 84 134" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="84" cy="134" r="7" fill="${skin}"/>
    <path d="M82 100 L122 98 Q128 100 126 122 L122 150 Q120 156 112 156 L88 156 Q82 156 82 150 Z" fill="${j}"/>
    <rect x="93" y="82" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfProfil(118, 54, skin, haar, fr)}
    <path d="M108 150 Q126 176 132 204" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M128 184 Q131 196 132 204" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(130, 202, 1)}
    <path d="M114 106 Q128 116 132 132" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M114 104 Q124 110 128 120" stroke="${j}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="132" cy="132" r="7" fill="${skin}"/>`
  );
}
function schiessen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    schatten(96, 52) +
    `<path d="M94 150 L90 224" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M91 198 L89 220" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    ${schuh(86, 220, -1)}
    <path d="M84 108 Q72 112 70 126" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="126" r="7" fill="${skin}"/>
    <path d="M82 98 L120 100 Q126 102 124 122 L120 150 Q118 156 110 156 L88 156 Q82 156 82 150 Z" fill="${j}"/>
    <rect x="92" y="82" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfProfil(110, 54, skin, haar, fr)}
    <path d="M106 150 Q132 152 150 142" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M134 148 Q144 145 150 142" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(150, 140, 1)}
    <path d="M116 106 Q130 112 134 126" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M116 104 Q124 110 128 118" stroke="${j}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="134" cy="126" r="7" fill="${skin}"/>`
  );
}
function graetschen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    `<ellipse cx="110" cy="248" rx="64" ry="9" fill="#000" opacity=".12"/>` +
    `<path d="M96 206 Q120 210 156 212" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M128 210 Q142 211 156 212" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(154, 208, 1)}
    <path d="M92 204 Q86 224 102 230" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    ${schuh(98, 226, 1)}
    <path d="M70 168 Q60 188 60 204" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="205" r="7" fill="${skin}"/>
    <path d="M70 170 L104 196 Q110 200 106 208 L86 214 Q80 214 78 208 L66 184 Q62 176 70 170 Z" fill="${j}"/>
    <path d="M74 168 Q86 158 96 156" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="96" cy="156" r="7" fill="${skin}"/>
    ${kopfProfil(64, 150, skin, haar, fr)}`
  );
}
/** Torwart: Standfigur mit Handschuhen, Neon-Trikot (fix). */
function torhueter(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    schatten(100, 56) +
    `<path d="M88 154 L74 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M112 154 L126 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M82 198 L76 218" stroke="#212121" stroke-width="17" stroke-linecap="round"/>
    <path d="M118 198 L124 218" stroke="#212121" stroke-width="17" stroke-linecap="round"/>
    ${schuh(70, 218, -1)}${schuh(130, 218, 1)}
    <path d="M70 148 L130 148 L128 178 Q128 184 121 184 L110 184 L100 162 L90 184 L79 184 Q72 184 72 178 Z" fill="#212121"/>
    <path d="M74 106 Q54 120 50 142" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M126 106 Q146 120 150 142" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <rect x="40" y="136" width="20" height="22" rx="8" fill="#eceff1" stroke="#b0bec5" stroke-width="1.5"/>
    <rect x="140" y="136" width="20" height="22" rx="8" fill="#eceff1" stroke="#b0bec5" stroke-width="1.5"/>
    <path d="M72 98 Q72 92 82 92 L118 92 Q128 92 128 98 L131 150 Q131 156 123 156 L77 156 Q69 156 69 150 Z" fill="${j}"/>
    <path d="M74 100 Q60 110 56 124" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M126 100 Q140 110 144 124" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="93" y="80" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfFront(skin, haar, fr)}`
  );
}

const POSEN: Record<SpielerPose, (j: string, s: string, h: string, fr: Frisur) => string> = {
  stehen,
  laufen,
  dribbeln,
  schiessen,
  graetschen,
};

/** Markup einer Figur im Zeichen-Raum. `trikot` ist die gerenderte Team-Farbe
 *  (beim Torwart ignoriert — fixes Neon). Frisur/Hautton aus `seed` abgeleitet. */
export function figurMarkup(args: {
  torwart: boolean;
  pose?: SpielerPose;
  trikot: string;
  seed: string;
}): string {
  const { frisur, haut, haar } = figurVariante(args.seed);
  if (args.torwart) return torhueter(TORWART_TRIKOT, haut, haar, frisur);
  return POSEN[args.pose ?? "stehen"](args.trikot, haut, haar, frisur);
}
