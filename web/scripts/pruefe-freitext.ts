// Prüft den Freitext mit einfachen Listen (Story #282): die Regeln in
// lib/freitext.ts an kleinen Beispielen und ihren Zwilling in der Datenbank.
//
// - **Regeln.** Welche Zeile Liste ist, wann eine Liste endet, dass
//   Zeilenumbrüche und Leerzeilen im Text bleiben.
// - **Suche.** Die SQL-Funktion `freitext_suchtext` nimmt dieselben
//   Listenzeichen heraus; ihr Muster wird aus der neuesten Migration gelesen,
//   die sie definiert.
//
//   npm run check:freitext
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { alsAufzaehlung, freitextBloecke, freitextZeilen } from "../lib/freitext";

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

// ── Regeln ────────────────────────────────────────────────────────────────
pruefe("leer und null ergeben keine Blöcke", () => {
  assert.deepEqual(freitextBloecke(null), []);
  assert.deepEqual(freitextBloecke(""), []);
  assert.deepEqual(freitextBloecke("\n \n"), []);
});

pruefe("Text behält Zeilenumbrüche und innere Leerzeilen (AK 4)", () => {
  assert.deepEqual(freitextBloecke("\nErste Zeile\nZweite\n\nDritte\n"), [
    { art: "text", text: "Erste Zeile\nZweite\n\nDritte" },
  ]);
});

pruefe("«- » und «* » sind Aufzählungspunkte einer Liste", () => {
  assert.deepEqual(freitextBloecke("- eins\n* zwei\n  - drei"), [
    { art: "aufzaehlung", punkte: ["eins", "zwei", "drei"] },
  ]);
});

pruefe("«1. » ist ein nummerierter Punkt, die erste Zahl setzt den Start", () => {
  assert.deepEqual(freitextBloecke("3. drei\n4. vier\n9. neun"), [
    { art: "nummeriert", punkte: ["drei", "vier", "neun"], start: 3 },
  ]);
});

pruefe("ohne Leerzeichen nach dem Zeichen bleibt es Text (AK 10)", () => {
  assert.deepEqual(freitextBloecke("-5 Grad\n*Stern*\n1.Halbzeit\n2026. Jahr"), [
    { art: "text", text: "-5 Grad\n*Stern*\n1.Halbzeit" },
    { art: "nummeriert", punkte: ["Jahr"], start: 2026 },
  ]);
});

pruefe("ein Zeichen mitten in der Zeile formatiert nichts", () => {
  assert.deepEqual(freitextBloecke("Offen starten - Spieler:innen beobachten"), [
    { art: "text", text: "Offen starten - Spieler:innen beobachten" },
  ]);
});

pruefe("Text und Listen wechseln sich ab", () => {
  assert.deepEqual(freitextBloecke("Einstieg\n- a\n- b\nDanach\n1. x"), [
    { art: "text", text: "Einstieg" },
    { art: "aufzaehlung", punkte: ["a", "b"] },
    { art: "text", text: "Danach" },
    { art: "nummeriert", punkte: ["x"], start: 1 },
  ]);
});

pruefe("eine Leerzeile beendet eine Liste", () => {
  assert.deepEqual(freitextBloecke("- a\n\n- b"), [
    { art: "aufzaehlung", punkte: ["a"] },
    { art: "aufzaehlung", punkte: ["b"] },
  ]);
});

pruefe("ein Wechsel der Listenart beginnt eine neue Liste", () => {
  assert.deepEqual(freitextBloecke("- a\n1. b\n- c"), [
    { art: "aufzaehlung", punkte: ["a"] },
    { art: "nummeriert", punkte: ["b"], start: 1 },
    { art: "aufzaehlung", punkte: ["c"] },
  ]);
});

pruefe("Windows-Zeilenenden zählen wie «\\n»", () => {
  assert.deepEqual(freitextBloecke("- a\r\n- b\r\nText"), [
    { art: "aufzaehlung", punkte: ["a", "b"] },
    { art: "text", text: "Text" },
  ]);
});

pruefe("überführter Bestand liest sich als eine Aufzählung (PC 3)", () => {
  assert.deepEqual(freitextBloecke("- Zeitdruck: Ball nach 4 Sekunden weg\n- Mit zwei Bällen"), [
    { art: "aufzaehlung", punkte: ["Zeitdruck: Ball nach 4 Sekunden weg", "Mit zwei Bällen"] },
  ]);
});

// ── Zwilling: die Suchfunktion der Datenbank ──────────────────────────────
// ── Fahrplan-Stufe «Üben» ──────────────────────────────────────────────────
pruefe("«Üben» speichert Zeilen: Rand-Leerzeilen weg, innere bleiben", () => {
  assert.deepEqual(freitextZeilen("\n\n- a  \n\nText\n\n"), ["- a", "", "Text"]);
  assert.deepEqual(freitextZeilen("  \n "), []);
  assert.deepEqual(freitextZeilen(null), []);
});

pruefe("YAML-Schritte werden Aufzählungszeilen, markierte bleiben (idempotent)", () => {
  assert.deepEqual(alsAufzaehlung(["Dribbeln", "- schon", "2. nummeriert"]), [
    "- Dribbeln",
    "- schon",
    "2. nummeriert",
  ]);
  assert.deepEqual(alsAufzaehlung(alsAufzaehlung(["x"])), ["- x"]);
});

pruefe("übernommene Schritte lesen sich als eine Aufzählung", () => {
  assert.deepEqual(freitextBloecke(alsAufzaehlung(["a", "b"]).join("\n")), [
    { art: "aufzaehlung", punkte: ["a", "b"] },
  ]);
});

const MIGRATIONEN = join(WEB, "../supabase/migrations");
const SUCHTEXT = readdirSync(MIGRATIONEN)
  .sort()
  .reverse()
  .map((f) => readFileSync(join(MIGRATIONEN, f), "utf8"))
  .find((sql) => /function freitext_suchtext/.test(sql));

const LISTENMUSTER = "^[ \\t]*([-*]|[0-9]+\\.)[ \\t]+";

pruefe("freitext_suchtext entfernt dieselben Listenzeichen", () => {
  assert.ok(SUCHTEXT, "keine Migration definiert freitext_suchtext");
  const muster = SUCHTEXT.match(/regexp_replace\(p_text, '([^']*)'/)?.[1];
  assert.equal(muster, LISTENMUSTER);
});

// Die Bestandsmigration der Fahrplan-Stufe «Üben» erkennt Listenzeilen selbst
// (Zwilling von `alsAufzaehlung`) — mit demselben Muster wie die Suche.
const FAHRPLAN = readdirSync(MIGRATIONEN)
  .filter((f) => f.endsWith("_fahrplan_freitext.sql"))
  .map((f) => readFileSync(join(MIGRATIONEN, f), "utf8"))[0];

pruefe("Bestandsmigration «Üben» erkennt dieselben Listenzeichen", () => {
  assert.ok(FAHRPLAN, "Migration fahrplan_freitext fehlt");
  const muster = FAHRPLAN.match(/zeile ~ '([^']*)'/)?.[1];
  assert.equal(muster, LISTENMUSTER);
});

console.log(`\n${gelaufen} Prüfungen bestanden${gescheitert ? `, ${gescheitert} gescheitert` : ""}.`);
if (gescheitert) process.exit(1);
