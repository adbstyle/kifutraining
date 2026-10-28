// Generiert web/lib/feedback/wissen.ts aus docs/feedback-triage.md — dem
// Produktwissen, auf das der Feedback-Dialog antwortet (Epic #541). Die Datei
// liegt ausserhalb von web/ und damit ausserhalb dessen, was Vercel baut;
// darum reist ihr Inhalt als generiertes Modul mit. Der PR-Check generiert neu
// und bricht ab, wenn das eingecheckte Modul nicht mehr passt.
// Aufruf: npm run gen:feedback-wissen
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const quelle = resolve(__dirname, "../../docs/feedback-triage.md");
const ziel = resolve(__dirname, "../lib/feedback/wissen.ts");

const text = readFileSync(quelle, "utf8");
writeFileSync(
  ziel,
  `// AUTO-GENERIERT aus docs/feedback-triage.md — NICHT von Hand bearbeiten.
// Neu generieren mit: npm run gen:feedback-wissen
/* eslint-disable */

export const PRODUKTWISSEN = ${JSON.stringify(text)};
`,
);
console.log(`wissen.ts generiert: ${ziel}`);
