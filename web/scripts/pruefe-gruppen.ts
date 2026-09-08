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
import { GRUPPE_NAME_MAX, gruppenSchluessel, nameProblem } from "../lib/gruppen";

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

// ── gruppenSchluessel: der Zwilling von lower(btrim(name)) ──────────────────
pruefe("Schlüssel senkt die Gross-/Kleinschreibung", () => {
  assert.equal(gruppenSchluessel("Gruppe 1"), "gruppe 1");
  assert.equal(gruppenSchluessel("TORHÜTER"), "torhüter");
});

pruefe("Schlüssel entfernt umschliessende Leerzeichen", () => {
  assert.equal(gruppenSchluessel("  Gruppe 1  "), "gruppe 1");
  assert.equal(gruppenSchluessel("\tGruppe 1\n"), "gruppe 1");
});

pruefe("Schlüssel lässt Leerzeichen im Innern stehen", () => {
  assert.equal(gruppenSchluessel("Gruppe  1"), "gruppe  1");
  assert.notEqual(gruppenSchluessel("Gruppe  1"), gruppenSchluessel("Gruppe 1"));
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
    "Diese Bezeichnung gibt es in diesem Training schon.",
  );
});

pruefe("Die Kollision achtet nicht auf Gross-/Kleinschreibung", () => {
  assert.equal(
    nameProblem("gruppe 1", bestehende),
    "Diese Bezeichnung gibt es in diesem Training schon.",
  );
  assert.equal(
    nameProblem("  TORHÜTER ", bestehende),
    "Diese Bezeichnung gibt es in diesem Training schon.",
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
    "Diese Bezeichnung gibt es in diesem Training schon.",
  );
});

pruefe("Ohne bestehende Gruppen ist jede Bezeichnung frei", () => {
  assert.equal(nameProblem("Gruppe 1", []), null);
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
