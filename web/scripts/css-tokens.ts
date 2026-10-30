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

/** Einen Wert in seine zwei Erscheinungsbilder teilen: `light-dark(a, b)` wird
 *  zu `{ hell: a, dunkel: b }` (normalisiert), alles andere gilt für beide.
 *  Geteilt wird am obersten Komma — `rgb(0 0 0 / 0.5)` darin bleibt ganz. */
export function hellDunkel(wert: string): { hell: string; dunkel: string } {
  const roh = wert.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const treffer = /^light-dark\(([\s\S]*)\)$/i.exec(roh);
  if (!treffer) {
    const beide = normalisiere(roh);
    return { hell: beide, dunkel: beide };
  }
  let tiefe = 0;
  for (let i = 0; i < treffer[1].length; i++) {
    const zeichen = treffer[1][i];
    if (zeichen === "(") tiefe++;
    else if (zeichen === ")") tiefe--;
    else if (zeichen === "," && tiefe === 0) {
      return {
        hell: normalisiere(treffer[1].slice(0, i)),
        dunkel: normalisiere(treffer[1].slice(i + 1)),
      };
    }
  }
  throw new Error(`light-dark() ohne zwei Werte: ${wert}`);
}

/** Wie `tokens`, aber jede Rolle in ihre zwei Erscheinungsbilder geteilt. */
export function tokenPaare(block: string, praefix: string): Map<string, { hell: string; dunkel: string }> {
  const gefunden = new Map<string, { hell: string; dunkel: string }>();
  const muster = new RegExp(`--${praefix}-([a-z0-9-]+)\\s*:\\s*([^;]+);`, "gi");
  for (const treffer of block.matchAll(muster)) {
    gefunden.set(treffer[1].toLowerCase(), hellDunkel(treffer[2]));
  }
  return gefunden;
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

/** Ersetzt jedes `light-dark(a, b)` in einem Wert durch `a` — auch mitten in
 *  einem Schatten (`0 4px 12px light-dark(…, …)`). Für den Ersatz-Block der
 *  Browser ohne `light-dark()`. */
export function hellerTeil(wert: string): string {
  let rest = wert.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
  for (let i = rest.indexOf("light-dark("); i >= 0; i = rest.indexOf("light-dark(")) {
    const anfang = i + "light-dark(".length;
    let tiefe = 0;
    let komma = -1;
    let ende = -1;
    for (let k = anfang; k < rest.length && ende < 0; k++) {
      const zeichen = rest[k];
      if (zeichen === "(") tiefe++;
      else if (zeichen === ")") {
        if (tiefe === 0) ende = k;
        else tiefe--;
      } else if (zeichen === "," && tiefe === 0 && komma < 0) komma = k;
    }
    if (komma < 0 || ende < 0) throw new Error(`light-dark() ohne zwei Werte: ${wert}`);
    rest = rest.slice(0, i) + rest.slice(anfang, komma).trim() + rest.slice(ende + 1);
  }
  return rest;
}

/** Alle Zuweisungen eines Blocks, deren Wert `light-dark()` enthält: voller
 *  Name (`--color-primary`) → roher Wert. */
export function zweiteilige(block: string): Map<string, string> {
  const gefunden = new Map<string, string>();
  for (const treffer of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    if (/light-dark\(/i.test(treffer[2])) gefunden.set(treffer[1].toLowerCase(), treffer[2]);
  }
  return gefunden;
}

/** Alle Zuweisungen eines Blocks: voller Name → roher Wert, ohne Kommentare. */
export function zuweisungen(block: string): Map<string, string> {
  const gefunden = new Map<string, string>();
  const ohne = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const treffer of ohne.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    gefunden.set(treffer[1].toLowerCase(), treffer[2].replace(/\s+/g, " ").trim());
  }
  return gefunden;
}
