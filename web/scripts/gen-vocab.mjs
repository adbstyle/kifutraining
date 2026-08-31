// Generiert web/lib/vocab.ts aus der kanonischen data/vokabular.yaml.
// Hält Dropdown-Werte der App mit den Schema-Enums konsistent (eine Quelle).
// Aufruf: npm run gen:vocab
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vocabPath = resolve(__dirname, "../../data/vokabular.yaml");
const outPath = resolve(__dirname, "../lib/vocab.ts");

const vocab = yaml.load(readFileSync(vocabPath, "utf8"));

function pascal(key) {
  return key
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

let out = `// AUTO-GENERIERT aus data/vokabular.yaml — NICHT von Hand bearbeiten.
// Neu generieren mit: npm run gen:vocab
/* eslint-disable */

`;

for (const [key, entries] of Object.entries(vocab)) {
  const name = pascal(key);
  out += `export const ${key} = ${JSON.stringify(entries, null, 2)} as const;\n`;
  out += `export type ${name}Slug = keyof typeof ${key};\n`;
  out += `export const ${key}Slugs = Object.keys(${key}) as ${name}Slug[];\n\n`;
}

// Rückwärtskompatibler Typ-Alias: der bisherige Hardcode exportierte `KategorieSlug`.
out += `export type KategorieSlug = KategorienSlug;\n`;

writeFileSync(outPath, out);
console.log(`vocab.ts generiert: ${outPath}`);
