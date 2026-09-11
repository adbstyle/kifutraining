// Prüft die Regeln für Gruppen-Bezeichnungen (web/lib/gruppen.ts) — die
// Vorabprüfung im Editor und in der Server Action. Ohne DB und ohne Netz; läuft
// im PR-Check neben `typecheck`.
//
// Der Wert dieser Prüfung liegt in der Kollisionsregel: sie ist der Zwilling
// des Unique-Index `tg_name_je_training`, und läuft sie auseinander, bekommt der
// Trainer statt einer Meldung am Feld einen Datenbankfehler (oder umgekehrt eine
// Ablehnung, die die Datenbank gar nicht ausspricht).
//
//   npm run check:gruppen
import assert from "node:assert/strict";
import { MELDUNG_VERGEBEN, bezeichnungSchluessel } from "../lib/bezeichnung";
import {
  GRUPPE_NAME_MAX,
  istHauptteil,
  konfliktBefund,
  nameProblem,
  wechselZahl,
  zeitJeGruppe,
  zeitKurz,
  zeitText,
  type Verteilung,
} from "../lib/gruppen";

const bestehende = [
  { id: "a", name: "Gruppe 1" },
  { id: "b", name: "Torhüter" },
];

let gelaufen = 0;
function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

// ── bezeichnungSchluessel: der Zwilling von lower(btrim(name)) ──────────────
// Gruppen und Varianten teilen die Regel (web/lib/bezeichnung.ts); geprüft wird
// sie hier am Gruppen-Index `tg_name_je_training`.
pruefe("Schlüssel senkt die Gross-/Kleinschreibung", () => {
  assert.equal(bezeichnungSchluessel("Gruppe 1"), "gruppe 1");
  assert.equal(bezeichnungSchluessel("TORHÜTER"), "torhüter");
});

pruefe("Schlüssel entfernt umschliessende Leerzeichen", () => {
  assert.equal(bezeichnungSchluessel("  Gruppe 1  "), "gruppe 1");
  assert.equal(bezeichnungSchluessel("\tGruppe 1\n"), "gruppe 1");
});

pruefe("Schlüssel lässt Leerzeichen im Innern stehen", () => {
  assert.equal(bezeichnungSchluessel("Gruppe  1"), "gruppe  1");
  assert.notEqual(bezeichnungSchluessel("Gruppe  1"), bezeichnungSchluessel("Gruppe 1"));
});

// ── nameProblem: leer und zu lang ───────────────────────────────────────────
pruefe("Leere Bezeichnung wird abgelehnt", () => {
  assert.equal(nameProblem("", bestehende), "Bitte eine Bezeichnung eingeben.");
  assert.equal(nameProblem("   ", bestehende), "Bitte eine Bezeichnung eingeben.");
});

pruefe("Genau 40 Zeichen sind erlaubt, 41 nicht", () => {
  assert.equal(nameProblem("x".repeat(GRUPPE_NAME_MAX), bestehende), null);
  assert.equal(
    nameProblem("x".repeat(GRUPPE_NAME_MAX + 1), bestehende),
    "Höchstens 40 Zeichen.",
  );
});

pruefe("Die Länge zählt getrimmt — wie der SQL-CHECK", () => {
  assert.equal(nameProblem(`  ${"x".repeat(GRUPPE_NAME_MAX)}  `, bestehende), null);
});

// ── nameProblem: Kollision (AK 6/7) ─────────────────────────────────────────
pruefe("Eine freie Bezeichnung geht durch", () => {
  assert.equal(nameProblem("Gruppe 2", bestehende), null);
});

pruefe("Eine vergebene Bezeichnung wird abgelehnt", () => {
  assert.equal(
    nameProblem("Gruppe 1", bestehende),
    MELDUNG_VERGEBEN,
  );
});

pruefe("Die Kollision achtet nicht auf Gross-/Kleinschreibung", () => {
  assert.equal(
    nameProblem("gruppe 1", bestehende),
    MELDUNG_VERGEBEN,
  );
  assert.equal(
    nameProblem("  TORHÜTER ", bestehende),
    MELDUNG_VERGEBEN,
  );
});

// ── nameProblem: die eigene Bezeichnung (AK 8) ──────────────────────────────
pruefe("Die eigene Bezeichnung kollidiert beim Umbenennen nicht mit sich", () => {
  assert.equal(nameProblem("Gruppe 1", bestehende, "a"), null);
  assert.equal(nameProblem("gruppe 1", bestehende, "a"), null);
  assert.equal(nameProblem("Gruppe 1 neu", bestehende, "a"), null);
});

pruefe("Die Bezeichnung einer FREMDEN Zeile kollidiert weiterhin", () => {
  assert.equal(
    nameProblem("Torhüter", bestehende, "a"),
    MELDUNG_VERGEBEN,
  );
});

pruefe("Ohne bestehende Gruppen ist jede Bezeichnung frei", () => {
  assert.equal(nameProblem("Gruppe 1", []), null);
});

// ── istHauptteil: der Zwilling von einordnung_traegt_gruppen(text) ──────────
pruefe("Gruppen gelten im Hauptteil beider Altersstufen", () => {
  assert.equal(istHauptteil("hauptteil"), true);
  assert.equal(istHauptteil("jun-spielformen"), true);
  assert.equal(istHauptteil("jun-spiel"), true);
});

pruefe("Ausserhalb des Hauptteils gelten keine Gruppen", () => {
  for (const teil of [
    "auffangen",
    "einleitung",
    "ausklang",
    "jun-auffangen",
    "jun-aufwaermen",
    "jun-spielform-trainingsziel",
    "jun-explosivitaet",
    "jun-abschluss",
  ])
    assert.equal(istHauptteil(teil), false, teil);
});

// ── wechselZahl ─────────────────────────────────────────────────────────────
/** Kurzschreibweise für eine Kinderfussball-Verteilung. */
function kifu(
  zeilen: [name: string, dauer: number | null, gruppen: string[]][],
): Verteilung {
  return zeilen.map(([name, dauer, gruppen], i) => ({
    id: `te${i + 1}`,
    name,
    einordnung: "hauptteil",
    dauer,
    gruppen,
  }));
}

const G = [
  { id: "g1", name: "Gruppe 1" },
  { id: "g2", name: "Gruppe 2" },
  { id: "th", name: "Torhüter" },
];

pruefe("Die Wechselzahl ist die längste Folge", () => {
  assert.equal(wechselZahl([]), 0);
  assert.equal(wechselZahl(kifu([["A", 10, []]])), 0);
  assert.equal(
    wechselZahl(kifu([["A", 10, ["g1", "g2"]], ["B", 10, ["g2"]]])),
    2,
  );
});

// ── konfliktBefund: nichts zu melden ────────────────────────────────────────
pruefe("Eine leere Verteilung meldet nichts", () => {
  const b = konfliktBefund([], G);
  assert.deepEqual(b.konflikte, []);
  assert.equal(b.chipWarnung.size, 0);
  assert.equal(b.gruppenWarnung.size, 0);
});

pruefe("Eine saubere Verteilung meldet nichts", () => {
  // Jede Gruppe genau einmal je Wechsel, alle Übungen gleich lang.
  const b = konfliktBefund(
    kifu([
      ["A", 10, ["g1", "g2", "th"]],
      ["B", 10, ["g2", "th", "g1"]],
      ["C", 10, ["th", "g1", "g2"]],
    ]),
    G,
  );
  assert.deepEqual(b.konflikte, []);
});

pruefe("Eine Übung ohne Gruppen ist kein Mangel", () => {
  const b = konfliktBefund(kifu([["A", 10, []], ["B", 15, []]]), G);
  assert.deepEqual(b.konflikte, []);
});

// ── konfliktBefund: doppelt (AK 13) ─────────────────────────────────────────
pruefe("Dieselbe Gruppe im selben Wechsel an zwei Übungen wird gemeldet", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 10, ["g1", "g2"]],
      ["B", 10, ["g1", "th"]],
    ]),
    G,
  );
  assert.deepEqual(
    b.konflikte.map((k) => k.text),
    ["Gruppe 1 steht im 1. Wechsel an zwei Übungen."],
  );
  assert.equal(b.konflikte[0].art, "doppelt");
  // Beide Chips tragen die Warnung, die Gruppenzeile den Kurztext.
  assert.equal(b.chipWarnung.has("te1|g1"), true);
  assert.equal(b.chipWarnung.has("te2|g1"), true);
  assert.equal(b.chipWarnung.has("te1|g2"), false);
  assert.equal(b.gruppenWarnung.get("g1"), "Steht im 1. Wechsel an zwei Übungen.");
});

pruefe("Dieselbe Gruppe in VERSCHIEDENEN Wechseln ist kein Konflikt (AK 4)", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 10, ["g1", "g2"]],
      ["B", 10, ["g2", "g1"]],
    ]),
    G,
  );
  assert.deepEqual(b.konflikte, []);
});

pruefe("Drei Übungen im selben Wechsel werden als drei benannt", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 10, ["g1"]],
      ["B", 10, ["g1"]],
      ["C", 10, ["g1"]],
    ]),
    G,
  );
  assert.equal(b.konflikte[0].text, "Gruppe 1 steht im 1. Wechsel an drei Übungen.");
});

// ── konfliktBefund: ungleich (AK 14) ────────────────────────────────────────
pruefe("Ungleich lange Übungen im selben Wechsel werden gemeldet", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 15, ["g1"]],
      ["B", 10, ["g2"]],
    ]),
    G,
  );
  assert.deepEqual(
    b.konflikte.map((k) => k.text),
    ["Im 1. Wechsel sind die Übungen ungleich lang (10 und 15 min)."],
  );
  assert.deepEqual([...b.dauerWarnung].sort(), ["te1", "te2"]);
});

pruefe("Eine Übung ohne erfasste Dauer zählt beim Vergleich nicht", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 15, ["g1"]],
      ["B", null, ["g2"]],
    ]),
    G,
  );
  assert.deepEqual(b.konflikte, []);
  assert.equal(b.dauerWarnung.size, 0);
});

pruefe("Ein Wechsel ohne zweite Übung ist nie ungleich", () => {
  const b = konfliktBefund(kifu([["A", 15, ["g1", "g2"]]]), G);
  assert.deepEqual(b.konflikte, []);
});

// ── konfliktBefund: Verdichtung ─────────────────────────────────────────────
pruefe("Aufeinanderfolgende Wechsel mit gleicher Dauermenge werden verdichtet", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 15, ["g1", "g2"]],
      ["B", 10, ["g2", "g1"]],
    ]),
    G,
  );
  assert.deepEqual(
    b.konflikte.map((k) => k.text),
    ["Im 1. und 2. Wechsel sind die Übungen ungleich lang (10 und 15 min)."],
  );
});

pruefe("Drei Wechsel werden aufgezählt, mehr abgekürzt", () => {
  const drei = konfliktBefund(
    kifu([
      ["A", 15, ["g1", "g2", "th"]],
      ["B", 10, ["g2", "th", "g1"]],
    ]),
    G,
  );
  assert.equal(
    drei.konflikte[0].text,
    "Im 1., 2. und 3. Wechsel sind die Übungen ungleich lang (10 und 15 min).",
  );

  const vier = konfliktBefund(
    kifu([
      ["A", 15, ["g1", "g2", "th", "g1"]],
      ["B", 10, ["g2", "th", "g1", "g2"]],
    ]),
    G,
  );
  assert.equal(
    vier.konflikte[0].text,
    "Im 1., 2., 3. Wechsel und weiteren sind die Übungen ungleich lang (10 und 15 min).",
  );
});

pruefe("Verschiedene Dauermengen bleiben getrennte Zeilen", () => {
  // Die dritte Übung hat nur einen Wechsel — im 2. Wechsel fällt ihre Dauer
  // deshalb aus der Menge heraus, und die beiden Zeilen dürfen nicht
  // zusammenfallen.
  const b = konfliktBefund(
    kifu([
      ["A", 15, ["g1", "g2"]],
      ["B", 10, ["g2", "g1"]],
      ["C", 20, ["th"]],
    ]),
    G,
  );
  assert.deepEqual(
    b.konflikte.map((k) => k.text),
    [
      "Im 1. Wechsel sind die Übungen ungleich lang (10, 15 und 20 min).",
      "Im 2. Wechsel sind die Übungen ungleich lang (10 und 15 min).",
    ],
  );
});

// ── konfliktBefund: Junioren über beide Hauptteil-Blöcke (AK 5) ─────────────
pruefe("Der Wechsel gilt über beide Junioren-Blöcke hinweg", () => {
  const v: Verteilung = [
    { id: "te1", name: "Passspiel", einordnung: "jun-spielformen", dauer: 15, gruppen: ["g1"] },
    { id: "te2", name: "Torabschluss", einordnung: "jun-spielformen", dauer: 15, gruppen: ["th"] },
    { id: "te3", name: "Spiel", einordnung: "jun-spiel", dauer: 10, gruppen: ["g1"] },
  ];
  const b = konfliktBefund(v, G);
  assert.deepEqual(
    b.konflikte.map((k) => k.text),
    [
      "Gruppe 1 steht im 1. Wechsel an zwei Übungen.",
      "Im 1. Wechsel sind die Übungen ungleich lang (10 und 15 min).",
    ],
  );
  // Der Konflikt fällt NUR auf, weil beide Blöcke zusammen gerechnet werden.
  assert.equal(b.chipWarnung.has("te3|g1"), true);
});

pruefe("Doppelt steht vor ungleich, damit die Liste stabil bleibt", () => {
  const b = konfliktBefund(
    kifu([
      ["A", 15, ["g1"]],
      ["B", 10, ["g1"]],
    ]),
    G,
  );
  assert.deepEqual(
    b.konflikte.map((k) => k.art),
    ["doppelt", "ungleich"],
  );
});


// ── zeitJeGruppe / zeitText: die Zeitsumme einer Gruppe (Story #151) ────────
pruefe("Die Summe zählt alle Übungen einer Gruppe zusammen", () => {
  const z = zeitJeGruppe(
    kifu([
      ["A", 15, ["g1", "g2"]],
      ["B", 25, ["g2", "g1"]],
    ]),
  );
  assert.deepEqual(z.get("g1"), { minuten: 40, mitDauer: 2 });
  assert.equal(zeitText(z.get("g1")), "Zugewiesen 40 min");
});

pruefe("Eine Übung ohne Dauer zählt nicht mit", () => {
  const z = zeitJeGruppe(
    kifu([
      ["A", 15, ["g1"]],
      ["B", null, ["g1"]],
    ]),
  );
  assert.deepEqual(z.get("g1"), { minuten: 15, mitDauer: 1 });
  assert.equal(zeitText(z.get("g1")), "Zugewiesen 15 min");
});

pruefe("Trägt keine der Übungen eine Dauer, steht dort ein Gedankenstrich", () => {
  const z = zeitJeGruppe(kifu([["A", null, ["g1"]]]));
  assert.deepEqual(z.get("g1"), { minuten: 0, mitDauer: 0 });
  assert.equal(zeitKurz(z.get("g1")), "—");
  assert.equal(zeitText(z.get("g1")), "Zugewiesen —");
});

pruefe("Eine Gruppe ohne Übung fehlt in der Map und liest sich als «—»", () => {
  const z = zeitJeGruppe(kifu([["A", 15, ["g1"]]]));
  assert.equal(z.has("g2"), false);
  assert.equal(zeitText(z.get("g2")), "Zugewiesen —");
  // Auch ganz ohne Verteilung — ein Training, das eben erst Gruppen bekam.
  assert.equal(zeitText(zeitJeGruppe([]).get("g1")), "Zugewiesen —");
});

pruefe("Eine Übung ohne Zuweisung zählt bei keiner Gruppe", () => {
  // «Alle gemeinsam» ist keine Aussage über eine einzelne Gruppe (AK 7).
  const z = zeitJeGruppe(
    kifu([
      ["A", 15, ["g1"]],
      ["Alle gemeinsam", 20, []],
    ]),
  );
  assert.deepEqual(z.get("g1"), { minuten: 15, mitDauer: 1 });
  assert.equal(z.size, 1);
});

pruefe("Dieselbe Gruppe zweimal an einer Übung zählt die Dauer einmal", () => {
  // Zwilling der Set-Zeile in `zeitJeGruppe`: Stünde eine Gruppe an derselben
  // Übung doppelt, wäre das ein Datenfehler — die Gruppe läuft die Übung
  // trotzdem nur einmal, und die 15 min dürfen nicht zu 30 werden.
  const z = zeitJeGruppe(kifu([["A", 15, ["g1", "g1"]]]));
  assert.deepEqual(z.get("g1"), { minuten: 15, mitDauer: 1 });
  assert.equal(zeitText(z.get("g1")), "Zugewiesen 15 min");
});

pruefe("Die Summe geht über beide Junioren-Blöcke hinweg", () => {
  // Dieselbe Reichweite wie der Wechsel (AK 5): Die Blöcke gliedern die
  // Übungen, nicht die Zeit.
  const v: Verteilung = [
    { id: "te1", name: "Passspiel", einordnung: "jun-spielformen", dauer: 20, gruppen: ["g1"] },
    { id: "te2", name: "Torabschluss", einordnung: "jun-spielformen", dauer: 15, gruppen: ["g2"] },
    { id: "te3", name: "Spiel", einordnung: "jun-spiel", dauer: 10, gruppen: ["g1"] },
  ];
  const z = zeitJeGruppe(v);
  assert.equal(zeitText(z.get("g1")), "Zugewiesen 30 min");
  assert.equal(zeitText(z.get("g2")), "Zugewiesen 15 min");
});

pruefe("Eine erfasste Null bleibt «0 min» — sie ist eine Angabe", () => {
  const z = zeitJeGruppe(kifu([["A", 0, ["g1"]]]));
  assert.equal(zeitText(z.get("g1")), "Zugewiesen 0 min");
});

// ── zeitText mit Zusatz: die Summe gilt nur in dieser Variante (#201 AK 9) ──
pruefe("Der Zusatz hängt an einer wirklichen Summe", () => {
  const z = zeitJeGruppe(kifu([["A", 15, ["g1"]]]));
  assert.equal(zeitText(z.get("g1"), "in dieser Variante"), "Zugewiesen 15 min in dieser Variante");
  // Auch die erfasste Null ist eine Summe — sie darf den Zusatz tragen.
  const null0 = zeitJeGruppe(kifu([["A", 0, ["g1"]]]));
  assert.equal(zeitText(null0.get("g1"), "in dieser Variante"), "Zugewiesen 0 min in dieser Variante");
});

pruefe("Ohne Summe bleibt «Zugewiesen —» ohne Zusatz", () => {
  // «Zugewiesen — in dieser Variante» schränkte eine Aussage ein, die es nicht
  // gibt: Es ist keine Zeit erfasst, weder hier noch anderswo.
  const ohneDauer = zeitJeGruppe(kifu([["A", null, ["g1"]]]));
  assert.equal(zeitText(ohneDauer.get("g1"), "in dieser Variante"), "Zugewiesen —");
  // Und ebenso für eine Gruppe, die in dieser Variante gar nicht vorkommt.
  assert.equal(zeitText(undefined, "in dieser Variante"), "Zugewiesen —");
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
