/**
 * Gelesenes CSS — die gemeinsame Grundlage der beiden Farb-Wächter
 * (`pruefe-farben.ts` für die Oberfläche, `pruefe-diagramm-farben.ts` für das
 * Diagramm).
 *
 * Beide lesen `app/globals.css` als **Text**, nicht als Build-Ergebnis: Die
 * Prüfung soll auch dann greifen, wenn niemand `next build` laufen lässt.
 * Ausgelagert ist hier alles, was dabei zweimal gebraucht würde — nicht mehr;
 * die Regeln selbst bleiben in ihrem jeweiligen Wächter, weil sie sich
 * unterscheiden (Schrift will 4.5:1, ein gezeichnetes Symbol 3:1).
 */

/** Den Inhalt des Blocks, dessen `{` ab `ab` als erstes kommt — mit Zählung der
 *  Klammern, damit verschachtelte Regeln (`&:hover { … }`) nicht abschneiden. */
export function blockAb(css: string, ab: number, was: string): string {
  const auf = css.indexOf("{", ab);
  if (auf < 0) throw new Error(`${was}: keine öffnende Klammer gefunden.`);
  let tiefe = 0;
  for (let i = auf; i < css.length; i++) {
    if (css[i] === "{") tiefe++;
    else if (css[i] === "}" && --tiefe === 0) return css.slice(auf + 1, i);
  }
  throw new Error(`${was}: Block wird nicht geschlossen.`);
}

export function blockVon(css: string, anfang: RegExp, was: string): string {
  const treffer = anfang.exec(css);
  if (!treffer) throw new Error(`${was}: nicht gefunden in app/globals.css.`);
  return blockAb(css, treffer.index, was);
}

/** Einen CSS-Farbwert auf die Schreibweise von `lib/farben.ts` bringen:
 *  Kleinschrift, Hex statt `rgb()`, und ein volldeckendes `ff` weg — `#ffffffff`
 *  und `#ffffff` sind dieselbe Farbe, und der Vergleich soll an der Farbe
 *  scheitern, nicht an der Notation. */
export function normalisiere(wert: string): string {
  const roh = wert
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toLowerCase();
  const rgb = /^rgba?\(([^)]*)\)$/.exec(roh);
  if (rgb) {
    const teile = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const kanal = (t: string) =>
      Math.round(t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));
    const alpha =
      teile[3] === undefined ? 1 : parseFloat(teile[3]) / (teile[3].endsWith("%") ? 100 : 1);
    const hex = teile
      .slice(0, 3)
      .map((t) => kanal(t).toString(16).padStart(2, "0"))
      .join("");
    return alpha >= 1 ? `#${hex}` : `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  }
  return /^#[0-9a-f]{6}ff$/.test(roh) ? roh.slice(0, 7) : roh;
}

/** Alle `--<praefix>-*`-Zuweisungen eines Blocks als Rolle → Wert. Werte, die
 *  keine Farbe sind (die Strichstärke des Balls), gehen unverändert durch —
 *  `normalisiere` lässt alles liegen, was es nicht als Farbe erkennt. */
export function tokens(block: string, praefix: string): Map<string, string> {
  const gefunden = new Map<string, string>();
  const muster = new RegExp(`--${praefix}-([a-z0-9-]+)\\s*:\\s*([^;]+);`, "gi");
  for (const treffer of block.matchAll(muster)) {
    gefunden.set(treffer[1].toLowerCase(), normalisiere(treffer[2]));
  }
  return gefunden;
}
