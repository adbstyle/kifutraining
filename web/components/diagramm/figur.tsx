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
 * (100, 140). `FigurGrafik` ist der einzige Einstiegspunkt: sie zentriert den
 * Anker auf (0,0), skaliert je Figurenart auf Feldgrösse (der Trainer ist
 * erwachsen und grösser) und spiegelt optional die Blickrichtung.
 */

import type { Punkt, SpielerPose } from "@/lib/diagramm";

// --- Palette (fix, unabhängig von der Trikotfarbe) ---
// Hauttöne bewusst als warme Brauntöne von hell bis dunkel — auch der dunkelste
// bleibt deutlich heller als das (oft schwarze) Haar, damit Gesichtszüge
// (dunkle Augen/Mund) lesbar bleiben (kein schwarzer Kopf-Klumpen).
const SKIN = ["#ffe0c2", "#f0c096", "#d39b66", "#b27a45", "#915f33"] as const;
const HAAR = ["#3a2a20", "#1c1c1c", "#e8b84b", "#a9622a", "#5a3826", "#caa05a"] as const;
// Augen/Mund: kräftiges, aber nicht reines Schwarz — trägt auf jedem Hautton.
const TINTE = "#26201c";
const FRISUREN = [
  "kurz",
  "scheitel",
  "lockig",
  "wuschel",
  "zopf",
  "zoepfe",
  "dutt",
  "iro",
  "stirnband",
  "lang",
] as const;
type Frisur = (typeof FRISUREN)[number];
const SHORT = "#37474f";
const SOCK = "#fafafa";
const SHOE = "#222";
/** Festes Neon-Trikot des Torhüters (`faerbbar: false`) — hebt ihn vom Team ab.
 *  Exportiert, damit das Register die Farbe nicht doppelt notiert. */
export const TORWART_TRIKOT = "#c0ca33";
// Trainer: lange graue Hose, dunkle lange Ärmel, Kappe mit hellem Rand — so
// zeichnet ihn das KiFu-Manual (z. B. „Trikottausch", S. 62).
const TRAINER_HOSE = "#78909c";
const TRAINER_ARM = "#2f3a40";
const KAPPE = "#37474f";
const KAPPE_RAND = "#eceff1";

/** Figur-Anker (Körpermitte) im Zeichen-Raum. */
const ANKER_X = 100;
const ANKER_Y = 140;
/** Skalierung Zeichen-Raum → Feld-Einheiten (Figurhöhe ~125). */
const SCALE = 0.55;
/** Der Trainer ist erwachsen: die Vorlage zeichnet ihn rund 38 % grösser als
 *  ein Kind (gemessen 40 px gegen 29 px auf `images/trikottausch.png`). Die
 *  Proportionen (kleinerer Kopf, längere Beine) macht die Zeichnung, die
 *  Körpergrösse dieser Faktor. */
const TRAINER_SCALE = 0.76;

/** Welche Figur gezeichnet wird. Die Körpergrösse hängt daran (siehe
 *  `ART_SCALE`), darum ist die Art der einzige Schalter nach draussen. */
export type FigurArt = "spieler" | "torwart" | "trainer";
const ART_SCALE: Record<FigurArt, number> = {
  spieler: SCALE,
  torwart: SCALE,
  trainer: TRAINER_SCALE,
};

/** Transform für die Figur: Anker auf (0,0), skaliert, optional gespiegelt. */
function figurTransform(spiegeln: boolean | undefined, scale: number): string {
  const sx = spiegeln ? -scale : scale;
  return `scale(${sx} ${scale}) translate(${-ANKER_X} ${-ANKER_Y})`;
}

/** Handmitten je Figur im Zeichen-Raum (aus den Posen abgelesen: die Hände sind
 *  dort eigene Kreise bzw. beim Torhüter die Handschuhe). Erste Hand ist die im
 *  Zeichen-Raum linke. */
const HAENDE_ROH: Record<FigurArt | SpielerPose, readonly [Punkt, Punkt]> = {
  stehen: [{ x: 60, y: 152 }, { x: 140, y: 152 }],
  "stehen-hinten": [{ x: 67, y: 152 }, { x: 133, y: 152 }],
  laufen: [{ x: 66, y: 136 }, { x: 136, y: 134 }],
  "laufen-hinten": [{ x: 73, y: 136 }, { x: 129, y: 134 }],
  dribbeln: [{ x: 84, y: 134 }, { x: 132, y: 132 }],
  passen: [{ x: 62, y: 128 }, { x: 134, y: 126 }],
  schiessen: [{ x: 70, y: 126 }, { x: 134, y: 126 }],
  graetschen: [{ x: 60, y: 205 }, { x: 96, y: 156 }],
  spieler: [{ x: 60, y: 152 }, { x: 140, y: 152 }], // = stehen (Default-Pose)
  torwart: [{ x: 50, y: 147 }, { x: 150, y: 147 }],
  trainer: [{ x: 62, y: 154 }, { x: 138, y: 154 }],
};

/**
 * Anker-relative Handpositionen einer Figur in Flächen-Einheiten — Single Source
 * für gehaltene Gegenstände (Leibchen in „Trikottausch", „Spiel mit dem Feuer")
 * und für die Prüfung der Manual-Vorlagen. Wer ein Tuch in die Hand legt,
 * rechnet damit statt Zahlen aus dieser Datei abzuschreiben.
 *
 * `spiegeln` kehrt die x-Werte um (die Figur skaliert mit negativem x um den
 * Anker); die Reihenfolge der beiden Hände bleibt „links, rechts" im Ergebnis.
 */
export function haende(
  art: FigurArt,
  pose?: SpielerPose,
  spiegeln?: boolean,
): [Punkt, Punkt] {
  const scale = ART_SCALE[art];
  const roh = HAENDE_ROH[art === "spieler" ? pose ?? "stehen" : art];
  const punkte = roh.map((p) => ({
    x: (p.x - ANKER_X) * scale * (spiegeln ? -1 : 1),
    y: (p.y - ANKER_Y) * scale,
  }));
  return punkte[0].x <= punkte[1].x ? [punkte[0], punkte[1]] : [punkte[1], punkte[0]];
}

/** Stabiler kleiner Hash einer id → Frisur + Hautton + Haarfarbe. */
export function figurVariante(seed: string): { frisur: Frisur; haut: string; haar: string } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  // Unsigned Shifts (>>>): ein vorzeichenbehaftetes >> liefert bei gesetztem
  // Bit 31 negative Indizes → undefined → fill="undefined" (schwarz).
  return {
    frisur: FRISUREN[u % FRISUREN.length],
    haut: SKIN[(u >>> 3) % SKIN.length],
    haar: HAAR[(u >>> 6) % HAAR.length],
  };
}

// --- Kopf / Frisur ---
const BAND = "#fafafa"; // Stirnband
const ZOPF_TIE = "#e53935"; // Haargummi

/** Hinter dem Kopf liegende Haarteile (Vorderansicht): Zöpfe, lange Haare. */
function frisurBack(haar: string, fr: Frisur): string {
  if (fr === "zopf")
    return `<path d="M126 40 Q150 44 150 66 Q150 86 137 90 Q147 70 132 56 Z" fill="${haar}"/>`;
  if (fr === "zoepfe")
    return `<ellipse cx="64" cy="82" rx="11" ry="18" fill="${haar}"/><ellipse cx="136" cy="82" rx="11" ry="18" fill="${haar}"/>`;
  if (fr === "lang")
    return `<path d="M68 50 Q60 92 72 116 L82 116 Q74 84 82 56 Z" fill="${haar}"/><path d="M132 50 Q140 92 128 116 L118 116 Q126 84 118 56 Z" fill="${haar}"/>`;
  return "";
}
/** Haar auf/über dem Kopf (Vorderansicht). Grund-Schopf als Halbmond, je
 *  Stil ergänzt. */
function frisurTop(haar: string, fr: Frisur): string {
  let s = `<circle cx="100" cy="48" r="33" fill="${haar}"/>`;
  if (fr === "lockig")
    s += [[78, 32], [92, 24], [108, 24], [122, 32], [70, 46], [130, 46]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${haar}"/>`)
      .join("");
  if (fr === "wuschel")
    s += [[72, 30], [86, 18], [100, 14], [114, 18], [128, 30]]
      .map(([x, y]) => `<path d="M${x - 8} ${y + 13} L${x} ${y} L${x + 8} ${y + 13} Z" fill="${haar}"/>`)
      .join("");
  if (fr === "scheitel")
    // seitlich gescheitelter Pony: deckt eine Stirnseite stärker
    s += `<path d="M100 22 Q136 24 134 58 Q133 44 114 42 Q102 38 99 28 Z" fill="${haar}"/>`;
  if (fr === "dutt") s += `<circle cx="100" cy="17" r="11" fill="${haar}"/>`;
  if (fr === "iro")
    s += `<path d="M90 6 Q100 -2 110 6 L113 46 L87 46 Z" fill="${haar}"/>`;
  if (fr === "stirnband")
    s += `<path d="M68 47 Q100 41 132 47 L132 39 Q100 33 68 39 Z" fill="${BAND}"/>`;
  if (fr === "zopf") s += `<circle cx="129" cy="46" r="4" fill="${ZOPF_TIE}"/>`;
  if (fr === "zoepfe")
    s += `<circle cx="64" cy="66" r="4" fill="${ZOPF_TIE}"/><circle cx="136" cy="66" r="4" fill="${ZOPF_TIE}"/>`;
  return s;
}
function gesichtFront(skin: string): string {
  return (
    `<circle cx="100" cy="56" r="29" fill="${skin}"/>` +
    `<circle cx="72" cy="58" r="6" fill="${skin}"/><circle cx="128" cy="58" r="6" fill="${skin}"/>` +
    `<circle cx="90" cy="56" r="3.4" fill="${TINTE}"/><circle cx="110" cy="56" r="3.4" fill="${TINTE}"/>` +
    `<circle cx="84" cy="66" r="4.4" fill="#ff8f8f" opacity="0.5"/><circle cx="116" cy="66" r="4.4" fill="#ff8f8f" opacity="0.5"/>` +
    `<path d="M91 66 Q100 76 109 66" stroke="${TINTE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
  );
}
function kopfFront(skin: string, haar: string, fr: Frisur): string {
  return frisurBack(haar, fr) + frisurTop(haar, fr) + gesichtFront(skin);
}
/** Kopf von hinten: kein Gesicht — der Haarschopf deckt den Schädel, sichtbar
 *  bleiben Ohren und ein Streifen Nacken unter dem Haar. Frisur, Haarfarbe und
 *  Hautton stammen aus derselben Ableitung wie vorne, damit es dasselbe Kind
 *  bleibt; die von hinten sichtbaren Merkmale (Zopf, Zöpfe, langes Haar, Dutt,
 *  Iro, Stirnband) tragen die Wiedererkennung. */
function kopfRuecken(skin: string, haar: string, fr: Frisur): string {
  return (
    frisurBack(haar, fr) +
    `<circle cx="100" cy="56" r="29" fill="${skin}"/>` +
    frisurTop(haar, fr) +
    // Ohren nach dem Schopf, sonst deckt ihn die Haarkappe zu.
    `<circle cx="70" cy="60" r="6.5" fill="${skin}"/><circle cx="130" cy="60" r="6.5" fill="${skin}"/>`
  );
}
/** Kragennaht des Trikots — nur in der Rückansicht, als leiser Schatten auf
 *  jeder Trikotfarbe. */
const KRAGEN = `<path d="M86 97 Q100 105 114 97" stroke="rgba(0,0,0,.16)" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
/** Profilkopf, Blick nach rechts; Mitte (hx,hy). */
function kopfProfil(hx: number, hy: number, skin: string, haar: string, fr: Frisur): string {
  let s = "";
  // Hinten liegende Haarteile zuerst.
  if (fr === "zopf" || fr === "zoepfe")
    s += `<path d="M${hx - 22} ${hy - 6} Q${hx - 44} ${hy - 2} ${hx - 44} ${hy + 18} Q${hx - 44} ${hy + 34} ${hx - 30} ${hy + 34} Q${hx - 36} ${hy + 14} ${hx - 22} ${hy + 6} Z" fill="${haar}"/>`;
  if (fr === "lang")
    s += `<path d="M${hx - 24} ${hy - 8} Q${hx - 34} ${hy + 34} ${hx - 22} ${hy + 56} L${hx - 8} ${hy + 56} Q${hx - 16} ${hy + 24} ${hx - 12} ${hy} Z" fill="${haar}"/>`;
  // Grund-Schopf.
  s += `<circle cx="${hx - 2}" cy="${hy - 7}" r="31" fill="${haar}"/>`;
  if (fr === "lockig")
    s += [[hx - 18, hy - 26], [hx - 2, hy - 30], [hx + 12, hy - 24], [hx - 30, hy - 12]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${haar}"/>`)
      .join("");
  if (fr === "wuschel")
    s += [[hx - 22, hy - 12], [hx - 8, hy - 26], [hx + 8, hy - 26], [hx + 18, hy - 14]]
      .map(([x, y]) => `<path d="M${x - 8} ${y + 12} L${x} ${y - 1} L${x + 8} ${y + 12} Z" fill="${haar}"/>`)
      .join("");
  if (fr === "dutt") s += `<circle cx="${hx - 10}" cy="${hy - 30}" r="10" fill="${haar}"/>`;
  if (fr === "iro")
    s += `<path d="M${hx - 18} ${hy - 14} Q${hx - 6} ${hy - 40} ${hx + 8} ${hy - 38} L${hx + 8} ${hy - 30} Q${hx - 4} ${hy - 30} ${hx - 10} ${hy - 14} Z" fill="${haar}"/>`;
  // Gesicht in Profil.
  s += `<circle cx="${hx}" cy="${hy}" r="27" fill="${skin}"/>`;
  s += `<path d="M${hx + 25} ${hy - 3} q9 5 1 11 q-3 -5 -1 -11 Z" fill="${skin}"/>`;
  s += `<circle cx="${hx - 13}" cy="${hy + 2}" r="5.5" fill="${skin}"/>`;
  if (fr === "stirnband")
    s += `<path d="M${hx - 20} ${hy - 12} Q${hx + 4} ${hy - 24} ${hx + 24} ${hy - 14} L${hx + 24} ${hy - 6} Q${hx + 4} ${hy - 16} ${hx - 20} ${hy - 4} Z" fill="${BAND}"/>`;
  s += `<circle cx="${hx + 10}" cy="${hy - 2}" r="3.4" fill="${TINTE}"/>`;
  s += `<circle cx="${hx + 4}" cy="${hy + 10}" r="4" fill="#ff8f8f" opacity="0.5"/>`;
  s += `<path d="M${hx + 13} ${hy + 13} q6 4 11 -1" stroke="${TINTE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  return s;
}
function schuh(x: number, y: number, dir: 1 | -1): string {
  return `<path d="M${x} ${y} q${-6 * dir} 11 ${10 * dir} 11 l${8 * dir} -2 q1 -10 ${-7 * dir} -11 Z" fill="${SHOE}"/>`;
}

// --- Posen (liefern Markup im Zeichen-Raum 0..200 × 0..280) ---
/** `hinten`: dieselbe Haltung von hinten gesehen — Kopf ohne Gesicht,
 *  Kragennaht sichtbar, Hände etwas weiter vorn am Körper. */
function stehen(j: string, skin: string, haar: string, fr: Frisur, hinten = false): string {
  const hx = hinten ? 7 : 0;
  return (
    `<path d="M91 154 L87 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M109 154 L113 222" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M88 196 L85 218" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    <path d="M112 196 L115 218" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    ${schuh(80, 218, -1)}${schuh(120, 218, 1)}
    <path d="M70 148 L130 148 L128 178 Q128 184 121 184 L110 184 L100 162 L90 184 L79 184 Q72 184 72 178 Z" fill="${SHORT}"/>
    <path d="M74 106 L${60 + hx} 152" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
    <path d="M126 106 L${140 - hx} 152" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${60 + hx}" cy="152" r="8" fill="${skin}"/><circle cx="${140 - hx}" cy="152" r="8" fill="${skin}"/>
    <path d="M72 98 Q72 92 82 92 L118 92 Q128 92 128 98 L131 150 Q131 156 123 156 L77 156 Q69 156 69 150 Z" fill="${j}"/>
    ${hinten ? KRAGEN : ""}
    <path d="M74 100 L60 118" stroke="${j}" stroke-width="22" stroke-linecap="round"/>
    <path d="M126 100 L140 118" stroke="${j}" stroke-width="22" stroke-linecap="round"/>
    <rect x="93" y="80" width="14" height="18" rx="5" fill="${skin}"/>
    ${hinten ? kopfRuecken(skin, haar, fr) : kopfFront(skin, haar, fr)}`
  );
}
function laufen(j: string, skin: string, haar: string, fr: Frisur, hinten = false): string {
  const hx = hinten ? 7 : 0;
  return (
    `<path d="M96 156 Q82 186 74 210" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M84 188 Q78 200 74 210" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(70, 206, -1)}
    <path d="M124 108 Q140 118 ${136 - hx} 134" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="${136 - hx}" cy="134" r="8" fill="${skin}"/>
    <path d="M72 148 L130 148 L130 176 Q130 182 123 182 L112 182 L100 162 L92 182 L80 182 Q73 182 73 176 Z" fill="${SHORT}"/>
    <path d="M106 156 Q124 178 126 200" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M124 184 Q126 192 126 200" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    ${schuh(122, 198, 1)}
    <path d="M76 108 Q62 120 ${66 + hx} 136" stroke="${skin}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="${66 + hx}" cy="136" r="8" fill="${skin}"/>
    <path d="M73 100 Q73 94 83 94 L117 94 Q127 94 127 100 L130 150 Q130 156 122 156 L78 156 Q70 156 70 150 Z" fill="${j}"/>
    ${hinten ? KRAGEN : ""}
    <path d="M76 102 Q66 110 62 122" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M124 102 Q134 110 138 122" stroke="${j}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="93" y="82" width="14" height="18" rx="5" fill="${skin}"/>
    ${hinten ? kopfRuecken(skin, haar, fr) : kopfFront(skin, haar, fr)}`
  );
}
function dribbeln(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
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
/** Innenseit-Pass (Profil, Blick nach rechts): Standbein gepflanzt, Passbein
 *  tief quer zum Ball geführt (flacher Innenseit-Fuss am Boden), Arme zur
 *  Balance offen — bewusst flacher als der hohe Schuss. */
function passen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
    `<path d="M92 150 L86 224" stroke="${skin}" stroke-width="16" stroke-linecap="round"/>
    <path d="M89 198 L86 220" stroke="${SOCK}" stroke-width="17" stroke-linecap="round"/>
    ${schuh(82, 220, -1)}
    <path d="M84 108 Q66 112 62 128" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="62" cy="128" r="7" fill="${skin}"/>
    <path d="M82 98 L120 100 Q126 102 124 122 L120 150 Q118 156 110 156 L88 156 Q82 156 82 150 Z" fill="${j}"/>
    <rect x="92" y="82" width="14" height="18" rx="5" fill="${skin}"/>
    ${kopfProfil(110, 54, skin, haar, fr)}
    <path d="M106 150 Q126 178 136 202" stroke="${skin}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M130 186 Q134 195 136 202" stroke="${SOCK}" stroke-width="17" fill="none" stroke-linecap="round"/>
    <path d="M129 198 q19 -1 25 7 q1 6 -7 6 l-18 0 q-5 -7 0 -13 Z" fill="${SHOE}"/>
    <path d="M116 106 Q130 112 134 126" stroke="${skin}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M116 104 Q124 110 128 118" stroke="${j}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="134" cy="126" r="7" fill="${skin}"/>`
  );
}
function graetschen(j: string, skin: string, haar: string, fr: Frisur): string {
  return (
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

/** Trainer: erwachsene Standfigur. Kappe mit hellem Rand, dunkle lange Ärmel,
 *  Überzieher in der Elementfarbe, lange graue Hose — so zeichnet ihn das
 *  Manual. Kopf kleiner und Beine länger als beim Kind (erwachsene Proportion),
 *  die Körpergrösse kommt über `TRAINER_SCALE`. Kennt wie der Torhüter keine
 *  Posen; das Haar bleibt unter der Kappe, nur der Hautton variiert. */
function trainer(j: string, skin: string): string {
  return (
    // Lange Hose mit Hüftteil, darauf die Schuhe
    `<path d="M90 158 L86 240" stroke="${TRAINER_HOSE}" stroke-width="21" stroke-linecap="round"/>
    <path d="M110 158 L114 240" stroke="${TRAINER_HOSE}" stroke-width="21" stroke-linecap="round"/>
    ${schuh(80, 240, -1)}${schuh(120, 240, 1)}
    <path d="M74 146 L126 146 L128 176 Q128 182 121 182 L79 182 Q72 182 72 176 Z" fill="${TRAINER_HOSE}"/>` +
    // Dunkle lange Ärmel mit Händen, darüber der farbige Überzieher
    `<path d="M78 88 L62 150" stroke="${TRAINER_ARM}" stroke-width="17" stroke-linecap="round"/>
    <path d="M122 88 L138 150" stroke="${TRAINER_ARM}" stroke-width="17" stroke-linecap="round"/>
    <circle cx="62" cy="154" r="8" fill="${skin}"/><circle cx="138" cy="154" r="8" fill="${skin}"/>
    <path d="M74 84 Q74 78 84 78 L116 78 Q126 78 126 84 L129 156 Q129 162 121 162 L79 162 Q71 162 71 156 Z" fill="${j}"/>` +
    // Hals, Kopf, Kappe
    `<rect x="94" y="70" width="12" height="14" rx="4" fill="${skin}"/>
    <circle cx="100" cy="52" r="24" fill="${skin}"/>
    <circle cx="93" cy="52" r="3" fill="${TINTE}"/><circle cx="107" cy="52" r="3" fill="${TINTE}"/>
    <path d="M93 61 Q100 68 107 61" stroke="${TINTE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M77 40 Q78 22 100 22 Q122 22 123 40 Z" fill="${KAPPE}"/>
    <rect x="76" y="37" width="48" height="7" rx="3.5" fill="${KAPPE_RAND}"/>
    <path d="M120 37 Q142 38 147 44 Q138 47 120 45 Z" fill="${KAPPE}"/>`
  );
}

const POSEN: Record<SpielerPose, (j: string, s: string, h: string, fr: Frisur) => string> = {
  stehen,
  "stehen-hinten": (j, s, h, fr) => stehen(j, s, h, fr, true),
  laufen,
  "laufen-hinten": (j, s, h, fr) => laufen(j, s, h, fr, true),
  dribbeln,
  passen,
  schiessen,
  graetschen,
};

/** Markup einer Figur im Zeichen-Raum. `trikot` ist die gerenderte Team-Farbe
 *  (beim Torwart ignoriert — fixes Neon). Frisur/Hautton aus `seed` abgeleitet.
 *  Nur für `FigurGrafik` — das Markup passt allein zur Skalierung seiner Art. */
function figurMarkup(args: {
  art: FigurArt;
  pose?: SpielerPose;
  trikot: string;
  seed: string;
}): string {
  const { frisur, haut, haar } = figurVariante(args.seed);
  if (args.art === "torwart") return torhueter(TORWART_TRIKOT, haut, haar, frisur);
  if (args.art === "trainer") return trainer(args.trikot, haut);
  return POSEN[args.pose ?? "stehen"](args.trikot, haut, haar, frisur);
}

/** Fertige Figur für das Symbol-Register: Markup **und** Transform in einem
 *  Aufruf. Beide gehören zusammen — die Zeichnung des Trainers stimmt nur bei
 *  seiner eigenen Skalierung —, darum gibt es nach draussen nur diesen
 *  Einstiegspunkt und keine einzeln aufrufbaren Hälften. */
export function FigurGrafik({
  art,
  pose,
  trikot,
  seed,
  spiegeln,
}: {
  art: FigurArt;
  pose?: SpielerPose;
  trikot: string;
  seed: string;
  spiegeln?: boolean;
}) {
  return (
    <g
      transform={figurTransform(spiegeln, ART_SCALE[art])}
      dangerouslySetInnerHTML={{ __html: figurMarkup({ art, pose, trikot, seed }) }}
    />
  );
}
