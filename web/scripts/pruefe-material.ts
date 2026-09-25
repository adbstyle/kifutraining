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
import { farbSlugs, parseDiagramm, type DiagrammData, type DiagrammElement } from "../lib/diagramm";
import yaml from "js-yaml";
import { gesamtMaterial, type MaterialFassung } from "../lib/material-gesamt";
import {
  FARBE_LABEL,
  MATERIAL_ARTEN,
  MATERIAL_KATALOG,
  SPIELER_STANDARDFARBE,
  aenderungenText,
  gleicheListe,
  materialAenderungen,
  materialVorschlag,
  parseMaterialBasis,
  parseMaterialListe,
  postenText,
} from "../lib/material";

const WEB = resolve(fileURLToPath(import.meta.url), "../..");

/** Die Material-Liste einer Übungs-YAML, roh. */
function liesListe(text: string): unknown[] {
  const doc = yaml.load(text) as { material_liste?: unknown[] };
  return doc.material_liste ?? [];
}

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

pruefe("Spieler: Standardfarbe wie im Symbol-Register", () => {
  const standard = registerEintrag("spieler").match(/defaultFarbe:\s*"([a-z]+)"/)?.[1];
  assert.equal(SPIELER_STANDARDFARBE, standard);
});

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

// ── Zwilling 3: das JSON-Schema der Übungs-Datenbank ──────────────────────
const SCHEMA = JSON.parse(readFileSync(join(WEB, "../schema/uebung.schema.json"), "utf8"));

pruefe("uebung.schema.json kennt dieselben Arten und Farben", () => {
  const items = SCHEMA.properties.material_liste.items.properties;
  assert.deepEqual(items.art.enum, [...MATERIAL_ARTEN]);
  assert.deepEqual(items.farbe.enum, [...farbSlugs]);
});

// ── Die Manual-Übungen (Story #270) ────────────────────────────────────────
const UEBUNGEN = join(WEB, "../data/uebungen");
const DIAGRAMME = join(WEB, "../data/diagramme");

pruefe("jede Manual-Übung mit Diagramm trägt eine gültige Material-Liste", () => {
  for (const datei of readdirSync(DIAGRAMME).filter((f) => f.endsWith(".json"))) {
    const slug = datei.replace(/\.json$/, "");
    const yaml = readFileSync(join(UEBUNGEN, `${slug}.yaml`), "utf8");
    const roh = liesListe(yaml);
    assert.ok(roh.length > 0, `${slug}: keine material_liste`);
    assert.equal(parseMaterialListe(roh).length, roh.length, `${slug}: ungültiger oder doppelter Posten`);
  }
});

// Abweichungen vom Vorschlag sind erlaubt — der Betreiber entscheidet —, aber
// sichtbar: der Lauf nennt sie, damit keine unbemerkt entsteht.
for (const datei of readdirSync(DIAGRAMME).filter((f) => f.endsWith(".json")).sort()) {
  const slug = datei.replace(/\.json$/, "");
  const liste = parseMaterialListe(liesListe(readFileSync(join(UEBUNGEN, `${slug}.yaml`), "utf8")));
  const vorschlag = materialVorschlag(parseDiagramm(JSON.parse(readFileSync(join(DIAGRAMME, datei), "utf8"))));
  if (!gleicheListe(liste, vorschlag)) console.log(`ℹ ${slug}: Material weicht bewusst vom Diagramm ab`);
}

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

pruefe("Leibchen: ab zwei Spielerfarben je Feldspieler eines in seiner Farbe", () => {
  const v = materialVorschlag(
    diagramm(sym("spieler", "rot"), sym("spieler"), sym("spieler", "blau"), sym("spieler", "blau"), sym("spieler", "blau")),
  );
  assert.deepEqual(v, [
    { art: "leibchen", farbe: "rot", menge: 2 },
    { art: "leibchen", farbe: "blau", menge: 3 },
  ]);
});

pruefe("Leibchen: eine einzige Spielerfarbe ist keine Einteilung", () => {
  assert.deepEqual(materialVorschlag(diagramm(sym("spieler"), sym("spieler", "rot"), sym("spieler"))), []);
});

pruefe("Leibchen: Torwart und Trainer zählen nicht, auch nicht für die Farbzahl", () => {
  assert.deepEqual(materialVorschlag(diagramm(sym("spieler"), sym("trainer", "blau"), sym("torwart"))), []);
  assert.deepEqual(materialVorschlag(diagramm(sym("spieler"), sym("spieler", "blau"), sym("trainer"), sym("torwart"))), [
    { art: "leibchen", farbe: "rot", menge: 1 },
    { art: "leibchen", farbe: "blau", menge: 1 },
  ]);
});

pruefe("Leibchen: gezeichnete zählen zusätzlich zu denen der Spieler", () => {
  const v = materialVorschlag(
    diagramm(sym("spieler", "rot"), sym("spieler", "weiss"), sym("leibchen", "rot"), sym("leibchen", "gelb")),
  );
  assert.deepEqual(v, [
    { art: "leibchen", farbe: "rot", menge: 2 },
    { art: "leibchen", farbe: "gelb", menge: 1 },
    { art: "leibchen", farbe: "weiss", menge: 1 },
  ]);
});

pruefe("Leibchen: gezeichnete zählen auch ohne farbig eingeteilte Spieler", () => {
  assert.deepEqual(materialVorschlag(diagramm(sym("spieler"), sym("leibchen", "blau"))), [
    { art: "leibchen", farbe: "blau", menge: 1 },
  ]);
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

pruefe("Änderungen: nie übernommen oder unverändert heisst kein Hinweis", () => {
  const v = parseMaterialListe([{ art: "tor", menge: 2 }]);
  assert.deepEqual(materialAenderungen(null, v), []);
  assert.deepEqual(materialAenderungen(v, v), []);
});

pruefe("Änderungen: mehr, weniger, neu und weggefallen, in Listenreihenfolge", () => {
  const basis = parseMaterialListe([{ art: "tor", menge: 2 }, { art: "pylone", farbe: "rot", menge: 4 }]);
  const jetzt = parseMaterialListe([{ art: "pylone", farbe: "rot", menge: 5 }, { art: "fussball", menge: 3 }]);
  const a = materialAenderungen(basis, jetzt);
  assert.deepEqual(a, [
    { art: "tor", farbe: null, vorher: 2, nachher: 0 },
    { art: "pylone", farbe: "rot", vorher: 4, nachher: 5 },
    { art: "fussball", farbe: null, vorher: 0, nachher: 3 },
  ]);
  assert.equal(aenderungenText(a), "Tore: 2 → 0 · Pylonen, rot: 4 → 5 · Fussbälle: 0 → 3");
});

pruefe("Änderungen: eine verschobene Figur ändert den Vorschlag nicht", () => {
  const vorher = materialVorschlag(diagramm(sym("pylone"), sym("spieler", "rot"), sym("spieler", "blau")));
  const verschoben = diagramm(sym("pylone"), sym("spieler", "rot"), sym("spieler", "blau"));
  (verschoben.elemente[1] as { x: number }).x = 900;
  assert.deepEqual(materialAenderungen(vorher, materialVorschlag(verschoben)), []);
});

pruefe("Text: Einzahl, Mehrzahl und Farbe", () => {
  assert.equal(postenText({ art: "tor", farbe: null, menge: 1 }), "1 Tor");
  assert.equal(postenText({ art: "pylone", farbe: "gruen", menge: 4 }), "4 Pylonen, grün");
  assert.equal(postenText({ art: "fussball", farbe: null, menge: 12 }), "12 Fussbälle");
});

// ── Gesamtliste eines Trainings (Story #271) ───────────────────────────────
function fassung(
  id: string,
  trainingsteil: string,
  liste: [string, string | null, number][],
  extra: Partial<MaterialFassung> = {},
): MaterialFassung {
  return {
    id,
    name: `Übung ${id}`,
    trainingsteil,
    varianteId: istH(trainingsteil) ? "v1" : null,
    materialListe: parseMaterialListe(liste.map(([art, farbe, menge]) => ({ art, farbe, menge }))),
    material: [],
    gruppen: [],
    ...extra,
  };
}
const istH = (t: string) => ["hauptteil", "jun-spielformen", "jun-spiel"].includes(t);
const g = (...ids: string[]) => ids.map((id) => ({ id }));
const V1 = [{ id: "v1" }];

pruefe("Gesamt: nacheinander laufende Teile zählen mit ihrem grössten Bedarf", () => {
  const r = gesamtMaterial(
    [
      fassung("a", "einleitung", [["pylone", "rot", 4], ["fussball", null, 6]]),
      fassung("b", "ausklang", [["pylone", "rot", 8]]),
    ],
    V1,
  );
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "pylone", farbe: "rot", menge: 8 }, { art: "fussball", menge: 6 }]));
});

pruefe("Gesamt: parallele Gruppen zählen zusammen, eine Station nur einmal", () => {
  // Drei Stationen, drei Gruppen im Kreislauf: in jedem Wechsel sind alle
  // drei Stationen belegt.
  const r = gesamtMaterial(
    [
      fassung("s1", "hauptteil", [["minitor", null, 2]], { gruppen: g("A", "B", "C") }),
      fassung("s2", "hauptteil", [["minitor", null, 2], ["fussball", null, 4]], { gruppen: g("B", "C", "A") }),
      fassung("s3", "hauptteil", [["fussball", null, 3]], { gruppen: g("C", "A", "B") }),
      fassung("e", "einleitung", [["fussball", null, 12]]),
    ],
    V1,
  );
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "minitor", menge: 4 }, { art: "fussball", menge: 12 }]));
});

pruefe("Gesamt: kürzere Durchläufe fallen aus späteren Wechseln heraus", () => {
  const r = gesamtMaterial(
    [
      fassung("x", "hauptteil", [["pylone", "blau", 6]], { gruppen: g("A", "B") }),
      fassung("y", "hauptteil", [["pylone", "blau", 4]], { gruppen: g("B") }),
    ],
    V1,
  );
  // Wechsel 1: x + y = 10; Wechsel 2: nur x = 6.
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "pylone", farbe: "blau", menge: 10 }]));
});

pruefe("Gesamt: ein Hauptteil ohne Gruppen läuft nacheinander ab", () => {
  const r = gesamtMaterial(
    [
      fassung("h1", "hauptteil", [["tor", null, 2]]),
      fassung("h2", "hauptteil", [["tor", null, 1], ["reifen", null, 5]]),
    ],
    V1,
  );
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "tor", menge: 2 }, { art: "reifen", menge: 5 }]));
});

pruefe("Gesamt: Varianten sind Alternativen und zählen mit ihrem grössten Bedarf", () => {
  const r = gesamtMaterial(
    [
      fassung("v1a", "hauptteil", [["minitor", null, 4]], { varianteId: "v1" }),
      fassung("v2a", "hauptteil", [["minitor", null, 2], ["handball", null, 3]], { varianteId: "v2" }),
    ],
    [{ id: "v1" }, { id: "v2" }],
  );
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "minitor", menge: 4 }, { art: "handball", menge: 3 }]));
});

pruefe("Gesamt: Junioren-Hauptteil — ein Wechsel gilt über beide Blöcke", () => {
  const r = gesamtMaterial(
    [
      fassung("j1", "jun-spielformen", [["tor", null, 2]], { gruppen: g("A") }),
      fassung("j2", "jun-spiel", [["tor", null, 2]], { gruppen: g("B") }),
    ],
    V1,
  );
  assert.deepEqual(r.liste, parseMaterialListe([{ art: "tor", menge: 4 }]));
});

pruefe("Gesamt: freie Ergänzungen je Übung, unverrechnet, über alle Varianten", () => {
  const r = gesamtMaterial(
    [
      fassung("a", "einleitung", [], { material: ["Pfeife"] }),
      fassung("b", "hauptteil", [], { varianteId: "v2", material: ["Stoppuhr", "Pfeife"] }),
      fassung("c", "ausklang", []),
    ],
    [{ id: "v1" }, { id: "v2" }],
  );
  assert.deepEqual(r.liste, []);
  assert.deepEqual(r.ergaenzungen, [
    { fassungId: "a", uebung: "Übung a", texte: ["Pfeife"] },
    { fassungId: "b", uebung: "Übung b", texte: ["Stoppuhr", "Pfeife"] },
  ]);
});

console.log(`\n${gelaufen} Prüfungen bestanden${gescheitert ? `, ${gescheitert} gescheitert` : ""}.`);
if (gescheitert) process.exit(1);
