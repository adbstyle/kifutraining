// Prüft die Regeln für Varianten des Hauptteils (web/lib/varianten.ts und die
// gemeinsame Namensregel in web/lib/bezeichnung.ts). Ohne DB und ohne Netz;
// läuft im PR-Check neben `typecheck` und `check:gruppen`.
//
// Der Wert dieser Prüfung liegt an zwei Stellen:
//
// - Die Namensregel ist der Zwilling des Unique-Index `tv_name_je_training`
//   und des CHECK `tv_name_laenge`. Läuft sie auseinander, bekommt der Trainer
//   statt einer Meldung am Feld einen Datenbankfehler (oder umgekehrt eine
//   Ablehnung, die die Datenbank gar nicht ausspricht).
// - `sichtbareZuordnungen` ist der Zwilling des CHECK
//   `te_variante_genau_bei_hauptteil`: Genau zwei Fälle sind zulässig, und
//   genau die beiden müssen sichtbar sein. Ein Fehler hier blendet Übungen aus,
//   die der Trainer erfasst hat.
//
//   npm run check:varianten
import assert from "node:assert/strict";
import {
  MELDUNG_VERGEBEN,
  bezeichnungProblem,
  bezeichnungSchluessel,
} from "../lib/bezeichnung";
import {
  VARIANTE_DEFAULT_NAME,
  VARIANTE_NAME_MAX,
  VARIANTE_PARAM,
  ersteVariante,
  mitVariante,
  sichtbareZuordnungen,
  varianteAus,
  varianteNameProblem,
} from "../lib/varianten";

const varianten = [
  { id: "v1", name: "28 Kinder" },
  { id: "v2", name: "21 Kinder" },
];

let gelaufen = 0;
function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

// ── bezeichnungSchluessel: der Zwilling von lower(btrim(name)) ──────────────
pruefe("Schlüssel senkt die Gross-/Kleinschreibung", () => {
  assert.equal(bezeichnungSchluessel("28 Kinder"), "28 kinder");
  assert.equal(bezeichnungSchluessel("REGEN"), "regen");
});

pruefe("Schlüssel entfernt umschliessende Leerzeichen", () => {
  assert.equal(bezeichnungSchluessel("  28 Kinder  "), "28 kinder");
  assert.equal(bezeichnungSchluessel("\t28 Kinder\n"), "28 kinder");
});

pruefe("Schlüssel lässt Leerzeichen im Innern stehen", () => {
  assert.notEqual(bezeichnungSchluessel("28  Kinder"), bezeichnungSchluessel("28 Kinder"));
});

// ── varianteNameProblem: leer, zu lang, vergeben (#201 AK 4/5) ──────────────
pruefe("Leere Bezeichnung wird abgelehnt", () => {
  assert.equal(varianteNameProblem("", varianten), "Bitte eine Bezeichnung eingeben.");
  assert.equal(varianteNameProblem("   ", varianten), "Bitte eine Bezeichnung eingeben.");
});

pruefe("Genau 40 Zeichen sind erlaubt, 41 nicht", () => {
  assert.equal(VARIANTE_NAME_MAX, 40);
  assert.equal(varianteNameProblem("x".repeat(VARIANTE_NAME_MAX), varianten), null);
  assert.equal(
    varianteNameProblem("x".repeat(VARIANTE_NAME_MAX + 1), varianten),
    "Höchstens 40 Zeichen.",
  );
});

pruefe("Die Länge zählt getrimmt — wie der SQL-CHECK", () => {
  assert.equal(varianteNameProblem(`  ${"x".repeat(VARIANTE_NAME_MAX)}  `, varianten), null);
});

pruefe("Eine freie Bezeichnung geht durch", () => {
  assert.equal(varianteNameProblem("Regen", varianten), null);
});

pruefe("Eine vergebene Bezeichnung wird abgelehnt, ohne Rücksicht auf Schreibung", () => {
  assert.equal(varianteNameProblem("28 Kinder", varianten), MELDUNG_VERGEBEN);
  assert.equal(varianteNameProblem("  28 KINDER ", varianten), MELDUNG_VERGEBEN);
});

pruefe("Beim Umbenennen zählt die eigene Bezeichnung nicht als vergeben", () => {
  assert.equal(varianteNameProblem("28 kinder", varianten, "v1"), null);
  // Die Bezeichnung der ANDEREN bleibt vergeben.
  assert.equal(varianteNameProblem("21 Kinder", varianten, "v1"), MELDUNG_VERGEBEN);
});

pruefe("Der Vorgabename ist zulässig — er steht so in der Datenbank", () => {
  // Zwilling von `trainings_erste_variante()` und dem Backfill: Was der Trigger
  // schreibt, muss die Vorabprüfung akzeptieren, sonst liesse sich ein
  // bestehender Hauptteil nicht mehr speichern.
  assert.equal(VARIANTE_DEFAULT_NAME, "Variante 1");
  assert.equal(varianteNameProblem(VARIANTE_DEFAULT_NAME, []), null);
});

pruefe("Gruppen und Varianten teilen dieselbe Regel", () => {
  // Beide rufen `bezeichnungProblem`; hier steht, dass die Obergrenze wirklich
  // ein Parameter ist und nicht zufällig überall 40 steht.
  assert.equal(bezeichnungProblem("xx", [], { max: 1 }), "Höchstens 1 Zeichen.");
  assert.equal(bezeichnungProblem("x", [], { max: 1 }), null);
});

// ── sichtbareZuordnungen: der Zwilling des Biconditional-CHECK ──────────────
const zuordnungen = [
  { id: "e1", varianteId: null }, // Einleitung — gilt für alle Varianten
  { id: "h1", varianteId: "v1" },
  { id: "h2", varianteId: "v2" },
];

pruefe("Sichtbar sind die eigene Variante und alles ausserhalb des Hauptteils", () => {
  assert.deepEqual(
    sichtbareZuordnungen(zuordnungen, "v1").map((z) => z.id),
    ["e1", "h1"],
  );
  assert.deepEqual(
    sichtbareZuordnungen(zuordnungen, "v2").map((z) => z.id),
    ["e1", "h2"],
  );
});

pruefe("Ohne Variante bleibt nur, was ausserhalb des Hauptteils liegt", () => {
  // Kommt vor, solange die Seite noch keine Variante gewählt hat; eine Fassung
  // einer FREMDEN Variante darf dann nicht durchrutschen.
  assert.deepEqual(
    sichtbareZuordnungen(zuordnungen, undefined).map((z) => z.id),
    ["e1"],
  );
});

pruefe("Die Reihenfolge bleibt, wie sie hereinkam", () => {
  // Der Aufrufer hat bereits sortiert (Teil, Unterkategorie, Position); das
  // Filtern darf daran nichts ändern.
  const gefiltert = sichtbareZuordnungen(zuordnungen, "v2");
  assert.equal(gefiltert[0].id, "e1");
  assert.equal(gefiltert.length, 2);
});

// ── ersteVariante / varianteAus (#201 AK 7) ─────────────────────────────────
pruefe("Die erste Variante ist die vorderste der Liste", () => {
  assert.deepEqual(ersteVariante(varianten), varianten[0]);
  assert.equal(ersteVariante([]), undefined);
});

pruefe("Ohne Parameter gilt die erste Variante", () => {
  assert.deepEqual(varianteAus(undefined, varianten), varianten[0]);
});

pruefe("Ein gültiger Parameter wählt seine Variante", () => {
  assert.deepEqual(varianteAus("v2", varianten), varianten[1]);
});

pruefe("Ein unbekannter Parameter fällt auf die erste zurück", () => {
  // Ein Link auf eine entfernte oder fremde Variante soll den Hauptteil zeigen,
  // nicht eine leere Seite.
  assert.deepEqual(varianteAus("weg", varianten), varianten[0]);
  assert.equal(varianteAus("weg", []), undefined);
});

// ── mitVariante (#201 PC 5) ─────────────────────────────────────────────────
pruefe("Bei genau einer Variante bleibt die Adresse unverändert", () => {
  assert.equal(mitVariante("/training/t1", "v1", [varianten[0]]), "/training/t1");
});

pruefe("Ab zwei Varianten trägt die Adresse den Parameter", () => {
  assert.equal(
    mitVariante("/training/t1", "v2", varianten),
    `/training/t1?${VARIANTE_PARAM}=v2`,
  );
});

pruefe("Ein vorhandener Suchteil wird ergänzt, nicht ersetzt", () => {
  assert.equal(
    mitVariante("/training/t1/edit?bearbeitet=1", "v2", varianten),
    `/training/t1/edit?bearbeitet=1&${VARIANTE_PARAM}=v2`,
  );
});

pruefe("Ohne aktive Variante bleibt die Adresse unverändert", () => {
  assert.equal(mitVariante("/training/t1", undefined, varianten), "/training/t1");
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
