// Prüft das Material einer Übung (Epic #266): den Katalog gegen seine beiden
// Zwillinge und die Regeln, nach denen Vorschlag und Liste entstehen.
//
// - **Symbol-Register.** `MATERIAL_KATALOG` spiegelt `faerbbar` und
//   `defaultFarbe` aus components/diagramm/symbols.tsx als Werte, statt das
//   React-Modul zu importieren (lib/material.ts bleibt so mit tsx ladbar). Das
//   Register wird hier als Text gelesen — wie in pruefe-diagramm-farben.ts.
// - **Suche.** Die SQL-Funktion `material_suchtext` führt dieselben
//   Bezeichnungen; sie wird aus der neuesten Migration gelesen, die sie
//   definiert.
// - **Regeln.** Vorschlag, Normalform und Trust-Boundary an kleinen Beispielen.
//
//   npm run check:material
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagrammData, DiagrammElement } from "../lib/diagramm";
import {
  FARBE_LABEL,
  MATERIAL_ARTEN,
  MATERIAL_KATALOG,
  gleicheListe,
  materialVorschlag,
  parseMaterialBasis,
  parseMaterialListe,
  postenText,
} from "../lib/material";

const WEB = resolve(fileURLToPath(import.meta.url), "../..");

let gelaufen = 0;
let gescheitert = 0;
function pruefe(was: string, fn: () => void) {
  try {
    fn();
    gelaufen++;
    console.log(`✓ ${was}`);
  } catch (fehler) {
    gescheitert++;
    console.error(`✗ ${was}`);
    console.error(`  ${fehler instanceof Error ? fehler.message : String(fehler)}`);
  }
}

// ── Zwilling 1: das Symbol-Register ───────────────────────────────────────
const SYMBOLE = readFileSync(join(WEB, "components/diagramm/symbols.tsx"), "utf8");

/** Der Eintrag eines Symbols im Register: von `  typ: {` bis zum nächsten
 *  Eintrag auf derselben Einrückung. */
function registerEintrag(typ: string): string {
  const start = SYMBOLE.search(new RegExp(`\\n  ${typ}: \\{`));
  assert.ok(start >= 0, `${typ} fehlt im Symbol-Register`);
  const rest = SYMBOLE.slice(start + 1);
  const ende = rest.slice(1).search(/\n {2}[a-z]+: \{|\n\};/);
  return ende < 0 ? rest : rest.slice(0, ende + 1);
}

for (const art of MATERIAL_ARTEN) {
  pruefe(`${art}: Färbbarkeit und Standardfarbe wie im Symbol-Register`, () => {
    const eintrag = registerEintrag(art);
    const faerbbar = /faerbbar:\s*true/.test(eintrag);
    const standard = eintrag.match(/defaultFarbe:\s*"([a-z]+)"/)?.[1] ?? null;
    const info = MATERIAL_KATALOG[art];
    assert.equal(info.farbig, faerbbar, "farbig ≠ faerbbar");
    assert.equal(info.standardFarbe, faerbbar ? standard : null, "standardFarbe ≠ defaultFarbe");
  });
}

// ── Zwilling 2: die Suchfunktion der Datenbank ─────────────────────────────
const MIGRATIONEN = join(WEB, "../supabase/migrations");
const SUCHTEXT = readdirSync(MIGRATIONEN)
  .sort()
  .reverse()
  .map((f) => readFileSync(join(MIGRATIONEN, f), "utf8"))
  .find((sql) => /function material_suchtext/.test(sql));

pruefe("material_suchtext nennt jede Art in Einzahl und Mehrzahl", () => {
  assert.ok(SUCHTEXT, "keine Migration definiert material_suchtext");
  for (const art of MATERIAL_ARTEN) {
    const zeile = SUCHTEXT.match(new RegExp(`when '${art}'\\s+then '([^']*)'`))?.[1];
    assert.ok(zeile, `${art} fehlt in material_suchtext`);
    const { einzahl, mehrzahl } = MATERIAL_KATALOG[art];
    assert.ok(zeile.split(" ").includes(einzahl), `${art}: «${einzahl}» fehlt`);
    assert.ok(zeile.split(" ").includes(mehrzahl), `${art}: «${mehrzahl}» fehlt`);
  }
});

pruefe("material_suchtext nennt jede Farbe wie FARBE_LABEL", () => {
  for (const [slug, label] of Object.entries(FARBE_LABEL))
    assert.match(SUCHTEXT ?? "", new RegExp(`when '${slug}'\\s+then '${label}'`), slug);
});

// ── Regeln ─────────────────────────────────────────────────────────────────
let n = 0;
function sym(typ: string, farbe?: string): DiagrammElement {
  return { id: `e${n++}`, art: "symbol", typ, x: 100, y: 100, ...(farbe ? { farbe } : {}) } as DiagrammElement;
}
const diagramm = (...elemente: DiagrammElement[]): DiagrammData => ({ version: 1, elemente });

pruefe("Vorschlag zählt jedes Material-Symbol nach Art und Farbe", () => {
  const v = materialVorschlag(
    diagramm(sym("pylone"), sym("pylone"), sym("pylone", "blau"), sym("minitor"), sym("minitor"), sym("fussball")),
  );
  assert.deepEqual(v, [
    { art: "minitor", farbe: null, menge: 2 },
    { art: "pylone", farbe: "blau", menge: 1 },
    { art: "pylone", farbe: "orange", menge: 2 },
    { art: "fussball", farbe: null, menge: 1 },
  ]);
});

pruefe("Vorschlag: ohne Farbe gilt die Standardfarbe des Diagramms", () => {
  const v = materialVorschlag(diagramm(sym("teller"), sym("teller", "gelb")));
  assert.deepEqual(v, [{ art: "teller", farbe: "gelb", menge: 2 }]);
});

pruefe("Vorschlag: Figuren, Pfade, Formen und Texte sind kein Material", () => {
  const v = materialVorschlag({
    version: 1,
    elemente: [
      sym("torwart"),
      sym("trainer"),
      { id: "p", art: "pfad", typ: "pass", punkte: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: "f", art: "form", form: "rechteck", x: 0, y: 0, breite: 10, hoehe: 10 },
      { id: "t", art: "text", x: 0, y: 0, text: "Tor" },
    ],
  });
  assert.deepEqual(v, []);
});

pruefe("Vorschlag: Einzelteile bleiben einzeln (vier Pylonen sind kein Tor)", () => {
  const v = materialVorschlag(diagramm(sym("pylone"), sym("pylone"), sym("pylone"), sym("pylone")));
  assert.deepEqual(v, [{ art: "pylone", farbe: "orange", menge: 4 }]);
});

pruefe("Liste: unbrauchbare Posten fallen weg, nie das Ganze", () => {
  const l = parseMaterialListe([
    { art: "pylone", farbe: "rot", menge: 3 },
    { art: "stoppuhr", menge: 1 },
    { art: "tor", menge: 0 },
    { art: "tor", menge: 1.5 },
    { art: "fussball", menge: "2" },
    null,
    { art: "tor", farbe: "rot", menge: 2 },
  ]);
  assert.deepEqual(l, [
    { art: "tor", farbe: null, menge: 2 },
    { art: "pylone", farbe: "rot", menge: 3 },
  ]);
});

pruefe("Liste: gleiche Art und Farbe werden zusammengezählt, Mengen gekappt", () => {
  const l = parseMaterialListe([
    { art: "reifen", menge: 2 },
    { art: "reifen", farbe: "blau", menge: 3 },
    { art: "handball", menge: 5000 },
  ]);
  assert.deepEqual(l, [
    { art: "reifen", farbe: "blau", menge: 5 },
    { art: "handball", farbe: null, menge: 999 },
  ]);
});

pruefe("Liste: kein Array ergibt die leere Liste, die Basis kennt null", () => {
  assert.deepEqual(parseMaterialListe({ art: "tor" }), []);
  assert.equal(parseMaterialBasis(null), null);
  assert.deepEqual(parseMaterialBasis([]), []);
});

pruefe("Vergleich: gleiche Normalform ist gleich, jede Mengenänderung nicht", () => {
  const a = parseMaterialListe([{ art: "tor", menge: 2 }, { art: "pylone", menge: 4 }]);
  const b = parseMaterialListe([{ art: "pylone", menge: 4 }, { art: "tor", menge: 2 }]);
  assert.ok(gleicheListe(a, b));
  assert.ok(!gleicheListe(a, parseMaterialListe([{ art: "tor", menge: 2 }, { art: "pylone", menge: 5 }])));
});

pruefe("Text: Einzahl, Mehrzahl und Farbe", () => {
  assert.equal(postenText({ art: "tor", farbe: null, menge: 1 }), "1 Tor");
  assert.equal(postenText({ art: "pylone", farbe: "gruen", menge: 4 }), "4 Pylonen, grün");
  assert.equal(postenText({ art: "fussball", farbe: null, menge: 12 }), "12 Fussbälle");
});

console.log(`\n${gelaufen} Prüfungen bestanden${gescheitert ? `, ${gescheitert} gescheitert` : ""}.`);
if (gescheitert) process.exit(1);
