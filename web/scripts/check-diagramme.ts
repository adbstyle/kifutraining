// Prüft alle gezeichneten Manual-Diagramme (data/diagramme/*.json) inhaltlich.
// Ohne DB und ohne Netz — läuft im PR-Check neben `typecheck`.
//
//   npm run check:diagramme
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseDiagramm } from "../lib/diagramm";
import { diagrammProbleme } from "./diagramm-pruefung";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/diagramme");
const dateien = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

let kaputt = 0;
for (const datei of dateien) {
  const roh = JSON.parse(readFileSync(resolve(DIR, datei), "utf8"));
  const daten = parseDiagramm(roh);
  if (!daten) {
    console.error(`✗ ${datei}: kein gültiges Diagramm (version/elemente fehlen)`);
    kaputt++;
    continue;
  }
  const probleme = diagrammProbleme(daten, Array.isArray(roh.elemente) ? roh.elemente.length : undefined);
  if (probleme.length === 0) {
    console.log(`✓ ${datei} (${daten.elemente.length} Elemente)`);
  } else {
    kaputt++;
    console.error(`✗ ${datei}`);
    for (const p of probleme) console.error(`    ${p}`);
  }
}

console.log(`\n${dateien.length} Diagramme geprüft, ${kaputt} mit Problemen.`);
if (kaputt > 0) process.exit(1);
