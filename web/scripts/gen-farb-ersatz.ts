// Schreibt den Ersatz für Browser ohne light-dark() (Safari vor 17.5) in
// app/globals.css neu: die helle Hälfte jeder zweiteiligen Zuweisung davor —
// Farben, Schatten, Diagramm. Nur der Inhalt von `:root` im
// `@supports not (color: light-dark(…))`-Block wird ersetzt; Kopf und
// Begründung darüber bleiben stehen.
//
//   npm run gen:farb-ersatz
//
// `npm run check:farben` scheitert, solange der Block nicht passt.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ERSATZ_KOPF, blockAb, ersatzSoll } from "./css-tokens";

const DATEI = join(resolve(fileURLToPath(import.meta.url), "../.."), "app/globals.css");
const css = readFileSync(DATEI, "utf8");

const ab = css.indexOf(ERSATZ_KOPF);
if (ab < 0) throw new Error(`${ERSATZ_KOPF} fehlt in app/globals.css — Kopf und Begründung zuerst von Hand anlegen.`);
// `blockAb` liefert den Inhalt zwischen den Klammern des Blocks.
const innen = blockAb(css, ab, "Ersatz-Block");
const start = css.indexOf("{", ab) + 1;
const zeilen = [...ersatzSoll(css)].map(([name, wert]) => `    ${name}: ${wert};`);
const neu = `\n  :root {\n    color-scheme: light;\n${zeilen.join("\n")}\n  }\n`;

writeFileSync(DATEI, css.slice(0, start) + neu + css.slice(start + innen.length));
console.log(`Ersatz geschrieben: ${zeilen.length} Zuweisungen.`);
