// Prüft, dass die Figuren-Varianten an ihrer Stelle bleiben.
//
// `figurVariante()` leitet Frisur, Hautton und Haarfarbe deterministisch aus
// der Element-id ab — ein Hash, ein Modulo, ein Feldzugriff. Die Reihenfolge
// der Felder `SKIN` und `HAAR` ist damit stillschweigend Teil des gespeicherten
// Zustands: Wer sie umsortiert, gibt jedem bestehenden Kind ein anderes
// Gesicht, ohne dass eine einzige Zeile Daten sich ändert. Nichts im Typsystem
// hält davon ab, und im Betrieb fiele es erst auf, wenn jemand ein altes
// Diagramm wiedererkennt.
//
// Geprüft wird deshalb nicht die Farbe, sondern der **Index**: dieselbe id muss
// nach jedem Umbau auf demselben Feldplatz landen.
//
//   npm run check:figuren
import assert from "node:assert/strict";
import { FRISUREN, HAAR, SKIN, figurVariante } from "../components/diagramm/figur";

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

/** Element-ids, wie der Editor sie vergibt (nanoid) plus die sprechenden ids
 *  der Manual-Vorlagen aus `data/diagramme/`. Die Liste ist beliebig, aber
 *  fest: sie muss über Umbauten hinweg dieselbe Antwort geben. */
const PROBEN = [
  "s1",
  "s2",
  "spieler-3",
  "d4",
  "V1StGXR8_Z5jdHi6B-myT",
  "kfTk9Cq2mVnJ0Xw",
  "e2e-figur",
  "torwart",
  "trainer",
  "3f0c1a7e",
] as const;

/** Der Platz im Feld, nicht der Wert — genau das ist der Vertrag. */
function plaetze(seed: string) {
  const variante = figurVariante(seed);
  return {
    frisur: FRISUREN.indexOf(variante.frisur),
    haut: SKIN.indexOf(variante.haut),
    haar: HAAR.indexOf(variante.haar),
  };
}

/** Erwartung, gemessen am Stand VOR der Umstellung auf Farb-Rollen
 *  (Commit-Basis eee1a8e) und seither unverändert. */
const ERWARTET: Record<string, { frisur: number; haut: number; haar: number }> = {
  s1: { frisur: 9, haut: 1, haar: 3 },
  s2: { frisur: 2, haut: 4, haar: 2 },
  "spieler-3": { frisur: 3, haut: 0, haar: 0 },
  d4: { frisur: 9, haut: 3, haar: 5 },
  "V1StGXR8_Z5jdHi6B-myT": { frisur: 4, haut: 0, haar: 4 },
  kfTk9Cq2mVnJ0Xw: { frisur: 6, haut: 3, haar: 0 },
  "e2e-figur": { frisur: 9, haut: 1, haar: 0 },
  torwart: { frisur: 0, haut: 2, haar: 2 },
  trainer: { frisur: 2, haut: 0, haar: 2 },
  "3f0c1a7e": { frisur: 1, haut: 3, haar: 2 },
};

pruefe("Die Felder haben ihre Länge behalten", () => {
  assert.equal(SKIN.length, 5, "SKIN");
  assert.equal(HAAR.length, 6, "HAAR");
  assert.equal(FRISUREN.length, 10, "FRISUREN");
});

pruefe("Kein Feldplatz ist doppelt belegt", () => {
  // Zwei gleiche Werte im Feld wären keine Vielfalt, sondern ein Tippfehler.
  assert.equal(new Set(SKIN).size, SKIN.length, "SKIN");
  assert.equal(new Set(HAAR).size, HAAR.length, "HAAR");
});

pruefe(`Jede Probe-id landet auf ihrem Feldplatz (${PROBEN.length} ids)`, () => {
  const abweichend: string[] = [];
  for (const seed of PROBEN) {
    const ist = plaetze(seed);
    const soll = ERWARTET[seed];
    assert.ok(soll, `Keine Erwartung für ${seed} hinterlegt.`);
    if (ist.frisur !== soll.frisur || ist.haut !== soll.haut || ist.haar !== soll.haar) {
      abweichend.push(
        `${seed}: ist ${JSON.stringify(ist)}, war ${JSON.stringify(soll)}`,
      );
    }
  }
  assert.deepEqual(abweichend, []);
});

console.log(
  `\n${gelaufen} Prüfung${gelaufen === 1 ? "" : "en"} bestanden` +
    (gescheitert ? `, ${gescheitert} gescheitert.` : "."),
);
process.exit(gescheitert ? 1 : 0);
