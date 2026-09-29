// Prüft die Regeln eines Feld-Diagramms (#145, #146): web/lib/diagramm-pruefung.ts,
// web/lib/diagramm-setzen.ts und den Diagramm-Katalog für den KI-Assistenten
// (web/lib/mcp/diagramm-katalog.ts). Ohne DB und ohne Netz; läuft im PR-Check
// neben `check:diagramme`, das die Manual-Vorlagen mit denselben Regeln prüft.
//
// Der Wert dieser Prüfung liegt an vier Stellen:
//
// - **Nie ablehnen, was der Editor erzeugt.** Seit dem PO-Entscheid
//   2026-09-29 (Story #145) gelten die Grenzen auch beim Speichern aus der
//   Übungsmaske. Der Editor klemmt beim
//   Ziehen eines Symbols die Mitte, nicht den Rahmen — eine Grenze am Rahmen
//   machte solche Übungen unspeicherbar.
// - **Grenze gegen Mangel.** Was die Fläche nicht führen kann, wird abgelehnt
//   und je Element benannt; inhaltliche Befunde werden gespeichert und
//   gemeldet (PO-Entscheid 2026-09-29, Story #145). Kippt ein Fall auf die
//   andere Seite, verliert der Trainer entweder eine Zeichnung oder bekommt
//   eine kaputte.
// - **Normalisieren ohne Datenverlust.** Gespeichert werden nur die Angaben
//   aus `ELEMENT_ERLAUBT`. Fehlt dort ein Feld der Element-Typen, verschwindet
//   es beim nächsten Speichern still aus jeder Zeichnung.
// - **Der Katalog sagt, was die Prüfung tut.** Er ist aus denselben Quellen
//   abgeleitet; hier wird er gegen sie und gegen das Verhalten der Prüfung
//   gehalten, und seine Beispiele müssen befundfrei sein.
//
//   npm run check:diagramm-regeln
import assert from "node:assert/strict";
import { z } from "zod";
import {
  DREHBARE_TYPEN,
  FIGUR_TYPEN,
  FLAECHE,
  FORM_TYPEN,
  MAX_ELEMENTE,
  MAX_TEXT_LAENGE,
  PFAD_TYPEN,
  POSEN_TYPEN,
  ROTATIONEN,
  SPIELER_POSEN,
  SYMBOL_TYPEN,
  farbSlugs,
  parseDiagramm,
  type DiagrammElement,
  type FormElement,
  type PfadElement,
  type SymbolElement,
  type TextElement,
} from "../lib/diagramm";
import {
  BEFUND_CODES,
  DIAGRAMM_ABGELEHNT,
  ELEMENT_ERLAUBT,
  GRENZ_CODES,
  diagrammAusFormular,
  diagrammProbleme,
  pruefeDiagramm,
  type Befund,
  type Pruefung,
} from "../lib/diagramm-pruefung";
import { diagrammSpalten } from "../lib/diagramm-setzen";
import { materialVorschlag } from "../lib/material";
import { DiagrammKatalogSchema, baueDiagrammKatalog } from "../lib/mcp/diagramm-katalog";
import { MANGEL_ERKLAERT, MangelAusgabe, alsMangel } from "../lib/mcp/diagramm-eingaben";
import { SYMBOLE } from "../components/diagramm/symbols";
import { haende } from "../components/diagramm/figur";
import { sortiertNachEbene } from "../components/diagramm/DiagrammView";

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

const mit = (...elemente: unknown[]) => pruefeDiagramm({ version: 1, elemente });
const codes = (bs: readonly Befund[]) => bs.map((b) => b.code);
/** Genau eine Grenze, und sie ist die erwartete. */
function eineGrenze(p: Pruefung, code: Befund["code"], angabe?: string): Befund {
  assert.equal(p.grenzen.length, 1, `erwartet eine Grenze, gefunden: ${p.grenzen.map((b) => b.meldung).join(" | ")}`);
  assert.equal(p.grenzen[0].code, code, p.grenzen[0].meldung);
  if (angabe !== undefined) assert.equal(p.grenzen[0].angabe, angabe, p.grenzen[0].meldung);
  assert.equal(p.daten, null);
  return p.grenzen[0];
}
function keineBefunde(p: Pruefung) {
  assert.deepEqual([...p.grenzen, ...p.maengel].map((b) => b.meldung), []);
  assert.ok(p.daten);
}

const pylone = (id: string, x: number, y: number, extra: object = {}) =>
  ({ id, art: "symbol", typ: "pylone", x, y, ...extra }) as const;

// ── Befund-Form ───────────────────────────────────────────────────────────
pruefe("GRENZ_CODES sind Befund-Codes, und art folgt dem Code", () => {
  for (const c of GRENZ_CODES) assert.ok((BEFUND_CODES as readonly string[]).includes(c), c);
  const p = mit({ id: "a", art: "symbol", typ: "torhueter", x: 10, y: 10 }, pylone("b", 800, 500, { rotation: 90 }));
  for (const b of p.grenzen) assert.equal(b.art, "grenze", b.code);
  for (const b of p.maengel) assert.equal(b.art, "mangel", b.code);
});

// ── 1. Aufbau ─────────────────────────────────────────────────────────────
pruefe("1: kein Objekt oder keine Liste «elemente» → aufbau, keine Daten", () => {
  for (const roh of [null, 42, "x", [], {}, { elemente: "x" }, { version: 1 }]) {
    const p = pruefeDiagramm(roh);
    const b = eineGrenze(p, "aufbau");
    assert.equal(b.index, undefined);
    assert.match(b.meldung, /Liste «elemente»/);
  }
  const p = mit(7, null, [1]);
  assert.deepEqual(codes(p.grenzen), ["aufbau", "aufbau", "aufbau"]);
  assert.match(p.grenzen[1].meldung, /^Element elemente\[1\]: Ein Element ist ein Objekt/);
  eineGrenze(mit({ id: "a" }), "aufbau", "art");
});

// ── 2. Unbekanntes Symbol ─────────────────────────────────────────────────
pruefe("2: Symbol «torhueter» → eine Grenze unbekannt an typ, mit Element und zulässigen Typen", () => {
  const b = eineGrenze(mit(pylone("p", 100, 100), { id: "tw-1", art: "symbol", typ: "torhueter", x: 800, y: 500 }), "unbekannt", "typ");
  assert.equal(b.index, 1);
  assert.equal(b.element, "tw-1");
  assert.deepEqual(b.zulaessig, [...SYMBOL_TYPEN]);
  assert.equal(b.meldung, "Element «tw-1» (elemente[1]): Das Symbol «torhueter» gibt es nicht.");
  eineGrenze(mit({ id: "x", art: "kreis" }), "unbekannt", "art");
});

// ── 3. Alle Verstösse auf einmal ──────────────────────────────────────────
pruefe("3: unbekannte Farben an Symbol, Pfad und Form, Drehung 30, Pose «rennen» → 5 Grenzen", () => {
  const p = mit(
    { id: "s", art: "symbol", typ: "spieler", x: 400, y: 400, farbe: "lila", rotation: 30, pose: "rennen" },
    { id: "l", art: "pfad", typ: "linie", punkte: [{ x: 10, y: 10 }, { x: 90, y: 90 }], farbe: "lila" },
    { id: "f", art: "form", form: "rechteck", x: 10, y: 10, breite: 100, hoehe: 100, farbe: "lila" },
  );
  assert.equal(p.daten, null);
  assert.deepEqual(
    p.grenzen.map((b) => `${b.index}.${b.angabe}:${b.code}`).sort(),
    ["0.farbe:unbekannt", "0.pose:unbekannt", "0.rotation:unbekannt", "1.farbe:unbekannt", "2.farbe:unbekannt"],
  );
  const drehung = p.grenzen.find((b) => b.angabe === "rotation")!;
  assert.equal(drehung.meldung, "Element «s» (elemente[0]): Die Drehung 30 gibt es nicht.");
  assert.deepEqual(drehung.zulaessig, ROTATIONEN.map(String));
  assert.deepEqual(p.grenzen.find((b) => b.angabe === "pose")!.zulaessig, [...SPIELER_POSEN]);
  assert.deepEqual(p.grenzen.find((b) => b.angabe === "farbe")!.zulaessig, [...farbSlugs]);
});

// ── 4. Je genau eine Grenze ───────────────────────────────────────────────
pruefe("4: je genau eine Grenze für Punkte, Typen, Rahmen, Zahlen und ids", () => {
  const pfad = (typ: string, punkte: unknown) => ({ id: "p", art: "pfad", typ, punkte });
  eineGrenze(mit(pfad("laufweg", [{ x: 1, y: 1 }])), "wert", "punkte");
  eineGrenze(mit(pfad("laufweg", [{ x: 1, y: 1 }, { x: "2", y: 2 }])), "wert", "punkte");
  assert.deepEqual(eineGrenze(mit(pfad("kurve", [{ x: 1, y: 1 }, { x: 2, y: 2 }])), "unbekannt", "typ").zulaessig, [...PFAD_TYPEN]);
  assert.deepEqual(
    eineGrenze(mit({ id: "k", art: "form", form: "kreis", x: 1, y: 1, breite: 10, hoehe: 10 }), "unbekannt", "form").zulaessig,
    [...FORM_TYPEN],
  );
  const zwei = [{ x: 1, y: 1 }, { x: 50, y: 50 }];
  eineGrenze(mit({ id: "v", art: "form", form: "polygon", punkte: zwei }), "wert", "punkte");
  const dreieck = eineGrenze(mit({ id: "d", art: "form", form: "dreieck", x: 1, y: 1, breite: 49, hoehe: 49, punkte: zwei }), "wert", "punkte");
  assert.match(dreieck.meldung, /genau 3/);
  eineGrenze(mit({ id: "r", art: "form", form: "rechteck", x: 1, y: 1, breite: 0, hoehe: 10 }), "wert", "breite");
  eineGrenze(mit({ id: "r", art: "form", form: "ellipse", x: 1, y: 1, breite: 10, hoehe: -3 }), "wert", "hoehe");
  eineGrenze(mit({ id: "r", art: "form", form: "rechteck", y: 1, breite: 10, hoehe: 10 }), "wert", "x");
  eineGrenze(mit(pylone("x", "100" as unknown as number, 100)), "wert", "x");
  eineGrenze(mit(pylone("x", Infinity, 100)), "wert", "x");
  eineGrenze(mit(pylone("x", 100, 100, { spiegeln: "ja" })), "wert", "spiegeln");
  eineGrenze(mit({ id: "t", art: "text", x: 1, y: 1, text: 5 }), "wert", "text");
  const lang = eineGrenze(mit({ id: "t", art: "text", x: 1, y: 1, text: "a".repeat(MAX_TEXT_LAENGE + 1) }), "wert", "text");
  assert.match(lang.meldung, new RegExp(`${MAX_TEXT_LAENGE + 1} Zeichen; erlaubt sind höchstens ${MAX_TEXT_LAENGE}`));

  for (const id of [undefined, "", "  ", 5]) {
    const b = eineGrenze(mit({ id, art: "symbol", typ: "pylone", x: 1, y: 1 }), "id", "id");
    assert.match(b.meldung, /^Element elemente\[0\]: «id» fehlt oder ist leer/);
  }
  const doppelt = eineGrenze(mit(pylone("a", 10, 10), pylone("b", 20, 20), pylone("a", 30, 30)), "id", "id");
  assert.equal(doppelt.index, 2);
  assert.equal(doppelt.meldung, "Element «a» (elemente[2]): Die id «a» steht schon bei elemente[0] — jede id gilt nur einmal.");
});

// ── 5. Ausserhalb ─────────────────────────────────────────────────────────
pruefe("5: auf der Fläche heisst Mitte, Punkt oder Rahmen — mit 0,5 Spielraum", () => {
  assert.deepEqual(mit(pylone("a", 1600.4, 999)).grenzen, []);
  const symbol = eineGrenze(mit(pylone("a", 1601, 40)), "ausserhalb");
  assert.equal(
    symbol.meldung,
    "Element «a» (elemente[0]): Die Mitte liegt bei x=1601, y=40 und damit ausserhalb der Zeichenfläche (x 0…1600, y 0…1000).",
  );
  eineGrenze(mit({ id: "t", art: "text", x: 100, y: -2, text: "Hallo" }), "ausserhalb");
  const pfad = eineGrenze(
    mit({ id: "p", art: "pfad", typ: "pass", punkte: [{ x: 1, y: 1 }, { x: 1700, y: 40 }, { x: 5, y: 5 }, { x: 9, y: 1200 }] }),
    "ausserhalb",
    "punkte",
  );
  assert.equal(
    pfad.meldung,
    "Element «p» (elemente[0]): Der 2. Punkt (x=1700, y=40) und der 4. Punkt (x=9, y=1200) liegen ausserhalb der Zeichenfläche (x 0…1600, y 0…1000).",
  );
  eineGrenze(mit({ id: "r", art: "form", form: "rechteck", x: 1500, y: 10, breite: 200, hoehe: 100 }), "ausserhalb");
  const ecken = [{ x: 10, y: 10 }, { x: 300, y: 10 }, { x: 300, y: 1001 }];
  eineGrenze(mit({ id: "v", art: "form", form: "polygon", punkte: ecken }), "ausserhalb", "punkte");
  eineGrenze(mit({ id: "d", art: "form", form: "dreieck", punkte: ecken }), "ausserhalb", "punkte");
});

// ── 6. Anzahl ─────────────────────────────────────────────────────────────
pruefe(`6: ${MAX_ELEMENTE + 1} gültige Elemente → genau eine Grenze anzahl; ${MAX_ELEMENTE} sind gültig`, () => {
  const viele = Array.from({ length: MAX_ELEMENTE + 1 }, (_, i) =>
    pylone(`p${i}`, 100 + (i % 20) * 60, 100 + Math.floor(i / 20) * 50),
  );
  keineBefunde(mit(...viele.slice(0, MAX_ELEMENTE)));
  const b = eineGrenze(mit(...viele), "anzahl");
  assert.equal(b.index, undefined);
  assert.match(b.meldung, new RegExp(`hat ${MAX_ELEMENTE + 1} Elemente; erlaubt sind höchstens ${MAX_ELEMENTE}`));
});

// ── 7. Was der Editor erzeugt ─────────────────────────────────────────────
pruefe("7: nie ablehnen, was der Editor erzeugt", () => {
  const ecken = mit(
    { id: "a", art: "symbol", typ: "spieler", x: 0, y: 0 },
    { id: "b", art: "symbol", typ: "spieler", x: FLAECHE.breite, y: FLAECHE.hoehe },
  );
  assert.deepEqual(ecken.grenzen, []);
  assert.deepEqual(codes(ecken.maengel), ["ragt_hinaus", "ragt_hinaus"]);
  assert.match(ecken.maengel[0].meldung, /über den linken und oberen Rand/);

  for (const text of ["", "   "]) {
    const p = mit({ id: "t", art: "text", x: 800, y: 500, text });
    assert.deepEqual(p.grenzen, []);
    assert.deepEqual(codes(p.maengel), ["text_leer"]);
  }
  const flach = mit({ id: "v", art: "form", form: "polygon", punkte: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }] });
  keineBefunde(flach);
  assert.equal((flach.daten!.elemente[0] as FormElement).hoehe, 0);
  keineBefunde(mit({ id: "d", art: "form", form: "dreieck", x: 0, y: 0, breite: 1, hoehe: 1, punkte: [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 30, y: 60 }] }));
  keineBefunde(mit({ id: "d", art: "form", form: "dreieck", x: 10, y: 10, breite: 260, hoehe: 180 }));

  const leer = mit();
  keineBefunde(leer);
  assert.deepEqual(leer.daten!.elemente, []);

  const zone = mit({ id: "z", art: "zone", form: "rechteck", x: 10, y: 10, breite: 100, hoehe: 100 });
  keineBefunde(zone);
  assert.equal(zone.daten!.elemente[0].art, "form");
});

// ── 8. Normalisierung ─────────────────────────────────────────────────────
pruefe("8: Polygon-Hülle, unbekannte Schlüssel und Punkte am Rechteck werden verworfen und gemeldet", () => {
  const p = mit(
    { id: "v", art: "form", form: "polygon", x: 0, y: 0, breite: 5, hoehe: 5, punkte: [{ x: 100, y: 200, z: 1 }, { x: 400, y: 250 }, { x: 250, y: 500 }] },
    { id: "s", art: "symbol", typ: "pylone", x: 800, y: 500, label: "Start" },
    { id: "r", art: "form", form: "rechteck", x: 10, y: 10, breite: 100, hoehe: 100, punkte: [{ x: 1, y: 1 }] },
  );
  assert.deepEqual(p.grenzen, []);
  const [polygon, symbol, rechteck] = p.daten!.elemente as [FormElement, SymbolElement, FormElement];
  assert.deepEqual(
    { x: polygon.x, y: polygon.y, breite: polygon.breite, hoehe: polygon.hoehe },
    { x: 100, y: 200, breite: 300, hoehe: 300 },
  );
  assert.deepEqual(polygon.punkte![0], { x: 100, y: 200 });
  assert.ok(!("label" in symbol));
  assert.ok(!("punkte" in rechteck));
  assert.deepEqual(
    p.maengel.map((b) => `${b.index}.${b.angabe}:${b.code}`),
    ["1.label:wirkungslos", "2.punkte:wirkungslos"],
  );
  assert.equal(p.maengel[0].meldung, "Element «s» (elemente[1]): «label» gibt es an der Art «symbol» nicht und wird nicht gespeichert.");
  assert.deepEqual(p.maengel[0].zulaessig, [...ELEMENT_ERLAUBT.symbol]);
  assert.equal(p.daten!.version, 1);
});

// ── 9. Vollständigkeit von ELEMENT_ERLAUBT ────────────────────────────────
pruefe("9: je Art ein Element mit ALLEN Feldern → kein Befund, nichts verworfen", () => {
  // `Required<…>`: bekommt ein Element-Typ ein neues Feld, scheitert hier
  // zuerst der Typecheck und nach dem Nachtragen diese Prüfung, bis das Feld
  // auch in ELEMENT_ERLAUBT steht.
  const symbol: Required<SymbolElement> = {
    id: "s", art: "symbol", typ: "spieler", x: 400, y: 400, rotation: 0, farbe: "blau", pose: "laufen", spiegeln: true,
  };
  const pfad: Required<PfadElement> = {
    id: "p", art: "pfad", typ: "linie", punkte: [{ x: 10, y: 10 }, { x: 90, y: 90 }], farbe: "gelb", gestrichelt: true,
  };
  const form: Required<FormElement> = {
    id: "f", art: "form", form: "polygon", x: 700, y: 100, breite: 200, hoehe: 100,
    punkte: [{ x: 700, y: 100 }, { x: 900, y: 150 }, { x: 750, y: 200 }], farbe: "rot", gefuellt: true,
  };
  const text: Required<TextElement> = { id: "t", art: "text", x: 800, y: 900, text: "Start" };
  const elemente: DiagrammElement[] = [symbol, pfad, form, text];
  for (const e of elemente) assert.deepEqual([...ELEMENT_ERLAUBT[e.art]].sort(), Object.keys(e).sort(), e.art);
  const p = mit(...elemente);
  keineBefunde(p);
  assert.deepEqual(p.daten!.elemente, elemente);
  assert.deepEqual(parseDiagramm(p.daten), p.daten, "parseDiagramm lässt das normalisierte Diagramm unverändert");
});

// ── 10. Mängel ────────────────────────────────────────────────────────────
pruefe("10a: Leibchen neben einer Figur gehört an die Hand", () => {
  const kind = { id: "kind", art: "symbol", typ: "spieler", x: 500, y: 500 } as const;
  const [, rechts] = haende("spieler", undefined, undefined);
  const hand = { x: kind.x + rechts.x, y: kind.y + rechts.y };
  const leibchen = (x: number, y: number) => ({ id: "lb", art: "symbol", typ: "leibchen", x, y });
  keineBefunde(mit(kind, leibchen(hand.x, hand.y)));
  keineBefunde(mit(kind, leibchen(700, 500)));
  const p = mit(kind, leibchen(560, 500));
  assert.deepEqual(p.grenzen, []);
  assert.deepEqual(codes(p.maengel), ["leibchen"]);
  assert.match(p.maengel[0].meldung, /^Element «lb» \(elemente\[1\]\): Das Leibchen liegt 60 Einheiten neben einer Figur/);
  assert.ok(
    p.maengel[0].meldung.includes(`die Hand von «kind» (elemente[0]), bei x=${Math.round(hand.x)}, y=${Math.round(hand.y)}`),
    p.maengel[0].meldung,
  );
});

pruefe("10b: Tore öffnen ins Feld — Kante, Ecke, diagonal, kleine Zone", () => {
  const feld = { id: "feld", art: "form", form: "rechteck", x: 200, y: 100, breite: 1200, hoehe: 800 } as const;
  const tor = (x: number, y: number, rotation: number) => ({ id: "tor", art: "symbol", typ: "tor", x, y, rotation });
  const falsch = mit(feld, tor(800, 100, 90));
  assert.deepEqual(codes(falsch.maengel), ["tor_richtung"]);
  assert.equal(
    falsch.maengel[0].meldung,
    "Element «tor» (elemente[1]): Das Tor steht auf der Oberkante von «feld» (elemente[0]), hat aber die Drehung 90 statt 0 — es öffnet vom Feld weg. Drehe es auf 0.",
  );
  assert.ok(falsch.daten, "ein Mangel verhindert das Speichern nicht");
  keineBefunde(mit(feld, tor(800, 100, 0)));
  keineBefunde(mit(feld, tor(800, 900, 180)));
  keineBefunde(mit(feld, tor(200, 500, 270)));
  keineBefunde(mit(feld, tor(1400, 500, 90)));
  const ecke = mit(feld, tor(1400, 100, 180));
  assert.match(ecke.maengel[0].meldung, /Oberkante und der rechten Feldkante .* statt 0 oder 90/);
  keineBefunde(mit(feld, tor(1400, 100, 90)));
  keineBefunde(mit(feld, tor(800, 100, 45)));
  keineBefunde(mit({ ...feld, breite: 300, hoehe: 300 }, tor(350, 100, 180)));
});

pruefe("10c: wirkungslose Angaben werden gespeichert und gemeldet", () => {
  const faelle: [unknown, string][] = [
    [pylone("a", 800, 500, { rotation: 90 }), "rotation"],
    [{ id: "a", art: "symbol", typ: "torwart", x: 800, y: 500, pose: "laufen" }, "pose"],
    [{ id: "a", art: "symbol", typ: "tor", x: 800, y: 500, farbe: "rot" }, "farbe"],
    [pylone("a", 800, 500, { spiegeln: true }), "spiegeln"],
    [{ id: "a", art: "pfad", typ: "laufweg", punkte: [{ x: 1, y: 1 }, { x: 9, y: 9 }], farbe: "rot" }, "farbe"],
    [{ id: "a", art: "pfad", typ: "laufweg", punkte: [{ x: 1, y: 1 }, { x: 9, y: 9 }], gestrichelt: false }, "gestrichelt"],
  ];
  for (const [element, angabe] of faelle) {
    const p = mit(element);
    assert.deepEqual(p.grenzen, [], angabe);
    assert.deepEqual(p.maengel.map((b) => `${b.angabe}:${b.code}`), [`${angabe}:wirkungslos`]);
    assert.match(p.maengel[0].meldung, /Lass «\w+» weg\.$/, p.maengel[0].meldung);
    assert.ok(p.daten, angabe);
    assert.equal((p.daten.elemente[0] as Record<string, unknown>)[angabe], (element as Record<string, unknown>)[angabe]);
  }
  keineBefunde(mit(pylone("a", 800, 500, { rotation: 0, spiegeln: false })));
  // Der Renderer dreht eine Pylone sehr wohl (symbolRotation) — nur eine Figur
  // nie. Die Meldung behauptet darum nur, was stimmt.
  assert.match(mit(pylone("a", 800, 500, { rotation: 90 })).maengel[0].meldung, /Drehung ist am Symbol «pylone» nicht vorgesehen/);
  const figur = { id: "a", art: "symbol", typ: "torwart", x: 800, y: 500, rotation: 90 };
  assert.match(mit(figur).maengel[0].meldung, /Eine Figur dreht KiFu nicht .* setzt «spiegeln»\. Lass «rotation» weg\.$/);
});

pruefe("10d: ein Symbolrahmen über dem Rand ist ein Mangel, gedreht mit gedrehten Massen", () => {
  const spieler = (x: number) => ({ id: "s", art: "symbol", typ: "spieler", x, y: 500 });
  const p = mit(spieler(10));
  assert.deepEqual(codes(p.maengel), ["ragt_hinaus"]);
  assert.equal(
    p.maengel[0].meldung,
    "Element «s» (elemente[0]): Das Symbol «spieler» ragt über den linken Rand hinaus. Für den Rahmen 75×145 muss die Mitte bei x 37.5…1562.5 und y 72.5…927.5 liegen.",
  );
  keineBefunde(mit(spieler(40)));
  const stange = (rotation: number) => ({ id: "st", art: "symbol", typ: "stange", x: 30, y: 500, rotation });
  keineBefunde(mit(stange(0)));
  assert.deepEqual(codes(mit(stange(90)).maengel), ["ragt_hinaus"]);
});

// ── 11. Grenzen und Mängel nebeneinander ──────────────────────────────────
pruefe("11: eine Grenze an einem Element verhindert die Mängel der anderen nicht", () => {
  const p = mit({ id: "a", art: "symbol", typ: "torhueter", x: 10, y: 10 }, pylone("b", 800, 500, { rotation: 90 }));
  assert.deepEqual(codes(p.grenzen), ["unbekannt"]);
  assert.deepEqual(codes(p.maengel), ["wirkungslos"]);
  assert.equal(p.maengel[0].index, 1);
  assert.equal(p.daten, null);
});

// ── 12. Speichern aus der Übungsmaske ─────────────────────────────────────
pruefe("12: diagrammAusFormular — Grenzen beim Speichern, unveränderter Altbestand bleibt speicherbar", () => {
  const formular = (wert?: unknown) => {
    const f = new FormData();
    if (wert !== undefined) f.set("diagramm", typeof wert === "string" ? wert : JSON.stringify(wert));
    return f;
  };
  const warnungen: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnungen.push(args);
  try {
    assert.equal(diagrammAusFormular(formular()), undefined);
    assert.equal(diagrammAusFormular(formular("")), undefined);
    assert.equal(diagrammAusFormular(formular("{kaputt")), "ungueltig");
    assert.equal(diagrammAusFormular(formular({ version: 1, elemente: [] })), null);

    const gueltig = { version: 1, elemente: [pylone("a", 100, 100, { label: "x" })] };
    assert.deepEqual(diagrammAusFormular(formular(gueltig)), { version: 1, elemente: [pylone("a", 100, 100)] });

    const alt = { version: 1, elemente: [pylone("a", 100, 100), { id: "b", art: "symbol", typ: "torhueter", x: 1650, y: 40 }] };
    assert.equal(diagrammAusFormular(formular(alt)), "ungueltig");
    assert.equal(warnungen.length, 1);
    assert.equal(warnungen[0][0], "[diagramm] Speichern abgelehnt:");
    assert.deepEqual(diagrammAusFormular(formular(alt), alt), alt, "unverändert → nachsichtig wie bisher");
    const geaendert = { ...alt, elemente: [...alt.elemente, pylone("c", 200, 200)] };
    assert.equal(diagrammAusFormular(formular(geaendert), alt), "ungueltig");
    assert.equal(diagrammAusFormular(formular(alt), null), "ungueltig");

    const viele = Array.from({ length: MAX_ELEMENTE + 1 }, (_, i) => pylone(`p${i}`, 100 + (i % 20) * 60, 100 + Math.floor(i / 20) * 50));
    assert.equal(diagrammAusFormular(formular({ version: 1, elemente: viele })), "ungueltig");
  } finally {
    console.warn = warn;
  }
  assert.match(DIAGRAMM_ABGELEHNT, /nicht speichern/);
});

// ── 13. Spalten beim Setzen ───────────────────────────────────────────────
pruefe("13: diagrammSpalten — angezeigtes Bild und Materialliste", () => {
  const daten = mit(pylone("a", 100, 100, { farbe: "rot" }), { id: "k", art: "symbol", typ: "spieler", x: 500, y: 500 }).daten!;
  const altesDiagramm = { version: 1, elemente: [pylone("x", 50, 50)] };
  const bild = (bild_quelle: string | null, bild_url: string | null, diagramm: unknown) =>
    diagrammSpalten({ bild_quelle, bild_url, diagramm }, daten).bild_quelle;
  assert.equal(bild(null, null, null), "diagramm");
  assert.equal(bild(null, "https://x/foto.webp", null), "foto");
  assert.equal(bild("foto", "https://x/foto.webp", altesDiagramm), "foto");
  assert.equal(bild("diagramm", "https://x/foto.webp", altesDiagramm), "diagramm");
  assert.equal(bild(null, "https://x/foto.webp", altesDiagramm), "diagramm");
  assert.equal(bild("foto", null, null), "diagramm");

  const s = diagrammSpalten({ bild_quelle: null, bild_url: null, diagramm: null }, daten);
  assert.deepEqual(s.material_liste, materialVorschlag(daten));
  assert.deepEqual(s.material_basis, materialVorschlag(daten));
  assert.equal(s.diagramm, daten);
  assert.ok(!("material" in s), "die freie Ergänzung fasst das Setzen nie an");
});

// ── 14. Wrapper für Seed und check:diagramme ──────────────────────────────
pruefe("14: diagrammProbleme — leer, verworfene Elemente, Befunde als Zeilen", () => {
  assert.deepEqual(diagrammProbleme({ version: 1, elemente: [] }), ["keine Elemente"]);
  const daten = { version: 1, elemente: [pylone("a", 100, 100)] as DiagrammElement[] };
  assert.deepEqual(diagrammProbleme(daten, 1), []);
  assert.match(diagrammProbleme(daten, 2)[0], /^1 Element\(e\) von parseDiagramm verworfen/);
  assert.deepEqual(diagrammProbleme({ version: 1, elemente: [pylone("a", 100, 100, { rotation: 90 })] }).length, 1);
});

// ── Katalog ───────────────────────────────────────────────────────────────
const katalog = baueDiagrammKatalog();

pruefe("Katalog: erfüllt sein Schema und lässt sich als JSON-Schema darstellen", () => {
  DiagrammKatalogSchema.parse(katalog);
  z.toJSONSchema(DiagrammKatalogSchema);
});

pruefe("Katalog: Fläche, Grenzen, Farben, Drehungen und Felder wie in lib/diagramm.ts und der Prüfung", () => {
  assert.deepEqual(katalog.flaeche, { breite: FLAECHE.breite, hoehe: FLAECHE.hoehe });
  assert.deepEqual(katalog.grenzen, { max_elemente: MAX_ELEMENTE, max_text_laenge: MAX_TEXT_LAENGE });
  assert.deepEqual(katalog.farben.map((f) => f.slug), [...farbSlugs]);
  for (const f of katalog.farben) assert.ok(f.label, f.slug);
  assert.deepEqual(katalog.rotationen, [...ROTATIONEN]);
  assert.deepEqual(
    Object.fromEntries(katalog.arten.map((a) => [a.art, a.felder])),
    Object.fromEntries(Object.entries(ELEMENT_ERLAUBT).map(([art, felder]) => [art, [...felder]])),
  );
  assert.deepEqual(katalog.pfade.map((p) => p.typ), [...PFAD_TYPEN]);
  assert.deepEqual(katalog.formen.map((f) => f.form), [...FORM_TYPEN]);
  const ebenen = sortiertNachEbene(katalog.ebenen.slice().reverse().map((art) => ({ art }) as DiagrammElement)).map((e) => e.art);
  assert.deepEqual(katalog.ebenen, ebenen, "Zeichenreihenfolge wie DiagrammView.sortiertNachEbene");
});

pruefe("Katalog: jedes Symbol wie im Symbol-Register", () => {
  assert.deepEqual(katalog.symbole.map((s) => s.typ), [...SYMBOL_TYPEN]);
  for (const s of katalog.symbole) {
    const typ = s.typ as (typeof SYMBOL_TYPEN)[number];
    const def = SYMBOLE[typ];
    assert.equal(s.label, def.label, typ);
    assert.deepEqual(s.masse, { breite: def.breite, hoehe: def.hoehe }, typ);
    assert.equal(s.drehbar, DREHBARE_TYPEN.has(typ), typ);
    assert.equal(s.farbe.waehlbar, def.faerbbar, typ);
    assert.equal(s.farbe.standard, def.faerbbar ? (def.defaultFarbe ?? null) : null, typ);
    assert.equal(s.blickrichtung, FIGUR_TYPEN.has(typ), typ);
    assert.deepEqual(s.posen, POSEN_TYPEN.has(typ) ? [...SPIELER_POSEN] : [], typ);
  }
});

pruefe("Katalog: was er wählbar nennt, meldet die Prüfung nicht als wirkungslos — und umgekehrt", () => {
  const wirkungslos = (element: object, angabe: string) =>
    mit(element).maengel.some((b) => b.code === "wirkungslos" && b.angabe === angabe);
  for (const s of katalog.symbole) {
    const e = { id: "e", art: "symbol", typ: s.typ, x: 800, y: 500 };
    assert.equal(wirkungslos({ ...e, farbe: "blau" }, "farbe"), !s.farbe.waehlbar, `${s.typ}: farbe`);
    assert.equal(wirkungslos({ ...e, rotation: 90 }, "rotation"), !s.drehbar, `${s.typ}: rotation`);
    assert.equal(wirkungslos({ ...e, pose: "laufen" }, "pose"), s.posen.length === 0, `${s.typ}: pose`);
    assert.equal(wirkungslos({ ...e, spiegeln: true }, "spiegeln"), !s.blickrichtung, `${s.typ}: spiegeln`);
  }
  for (const p of katalog.pfade) {
    const e = { id: "e", art: "pfad", typ: p.typ, punkte: [{ x: 1, y: 1 }, { x: 9, y: 9 }] };
    assert.equal(wirkungslos({ ...e, farbe: "blau" }, "farbe"), !p.farbe.waehlbar, `${p.typ}: farbe`);
    assert.equal(wirkungslos({ ...e, gestrichelt: true }, "gestrichelt"), !p.gestrichelt_waehlbar, `${p.typ}: gestrichelt`);
    const zuWenig = mit({ ...e, punkte: e.punkte.slice(0, p.min_punkte - 1) });
    assert.deepEqual(codes(zuWenig.grenzen), ["wert"], `${p.typ}: min_punkte`);
  }
});

pruefe("Katalog: die Beispiele sind befundfrei und zeigen Symbol, Pfad, Rechteck, Polygon und Text", () => {
  keineBefunde(pruefeDiagramm({ elemente: katalog.beispiele }));
  const gezeigt = new Set(katalog.beispiele.map((e) => (e.art === "form" ? e.form : e.art)));
  for (const was of ["symbol", "pfad", "rechteck", "polygon", "text"]) assert.ok(gezeigt.has(was), was);
});

pruefe("Katalog: die Hände je Figur und Pose tragen ein Leibchen ohne Mangel, gespiegelt mit umgekehrtem dx (#146)", () => {
  const je = katalog.haende.je_figur;
  assert.deepEqual(
    je.map((h) => `${h.typ}/${h.pose}`),
    [...FIGUR_TYPEN].flatMap((t) => (POSEN_TYPEN.has(t) ? SPIELER_POSEN.map((p) => `${t}/${p}`) : [`${t}/null`])),
  );
  assert.deepEqual(haende("spieler", undefined), haende("spieler", "stehen"), "ohne «pose» gilt «stehen»");
  for (const h of je) {
    for (const spiegeln of [false, true]) {
      const figur = { id: "f", art: "symbol", typ: h.typ, x: 800, y: 500, ...(h.pose && { pose: h.pose }), spiegeln };
      for (const [i, p] of h.punkte.entries()) {
        const dx = spiegeln ? -p.dx : p.dx;
        const an = mit(figur, { id: "lb", art: "symbol", typ: "leibchen", x: 800 + dx, y: 500 + p.dy });
        assert.deepEqual(codes(an.maengel), [], `${h.typ}/${h.pose}/${spiegeln} Hand ${i}`);
      }
      const daneben = mit(figur, { id: "lb", art: "symbol", typ: "leibchen", x: 800, y: 500 + 60 });
      assert.deepEqual(codes(daneben.maengel), ["leibchen"], `${h.typ}/${h.pose}/${spiegeln} daneben`);
    }
  }
});

pruefe("Mängel für den Assistenten: jeder Code erklärt, Befund als Ausgabe mit Element und Stelle (#146)", () => {
  assert.deepEqual(Object.keys(MANGEL_ERKLAERT).sort(), [...BEFUND_CODES].sort());
  for (const [c, text] of Object.entries(MANGEL_ERKLAERT)) assert.ok(text.trim(), c);
  const [b] = mit(pylone("a", 800, 500), pylone("p", 800, 500, { rotation: 90 })).maengel;
  const m = alsMangel(b);
  assert.deepEqual(m, { code: "wirkungslos", element_id: "p", stelle: "elemente[1]", angabe: "rotation", meldung: b.meldung });
  MangelAusgabe.parse(m);
  const ganz = alsMangel(mit(...Array.from({ length: MAX_ELEMENTE + 1 }, (_, i) => pylone(`p${i}`, 100, 100))).grenzen[0]);
  assert.deepEqual(Object.keys(ganz).sort(), ["code", "meldung"], "ein Befund zum Ganzen hat keine Stelle");
  z.toJSONSchema(MangelAusgabe);
});

console.log(`\n${gelaufen} Prüfungen bestanden${gescheitert ? `, ${gescheitert} gescheitert` : ""}.`);
if (gescheitert) process.exit(1);
