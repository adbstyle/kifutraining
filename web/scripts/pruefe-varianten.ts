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
  bedingungText,
  bedingungsMeldungFuer,
  fehlendeBedingungenAus,
  varianteAusFehler,
} from "../lib/training-bedingungen";
import {
  VARIANTE_NAME_MAX,
  VARIANTE_PARAM,
  VARIANTE_VORGABENAME,
  aufloesungSatz,
  fassungenVon,
  mitVariante,
  sichtbareZuordnungen,
  varianteAus,
  varianteNameProblem,
  wegfallSatz,
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
  // Zwilling von `variante_vorgabename()` in SQL: Denselben Namen schreiben der
  // Trigger `trainings_erste_variante`, der Backfill von
  // `hauptteil_varianten` und seit #209 die Auflösung in `entferne_variante`.
  // Läuft er hier auseinander, kündigt die Rückfrage vor dem Entfernen etwas
  // anderes an, als danach in der Datenbank steht.
  assert.equal(VARIANTE_VORGABENAME, "Variante 1");
  // Und was die Datenbank schreibt, muss die Vorabprüfung akzeptieren — sonst
  // liesse sich ein bestehender Hauptteil nicht mehr speichern.
  assert.equal(varianteNameProblem(VARIANTE_VORGABENAME, []), null);
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

// ── varianteAus (#201 AK 7) ─────────────────────────────────────────────────
pruefe("Ohne Parameter gilt die erste — die vorderste der Liste", () => {
  assert.deepEqual(varianteAus(undefined, varianten), varianten[0]);
  assert.equal(varianteAus(undefined, []), undefined);
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

// ── Veröffentlichungsbedingungen je Variante (#204) ─────────────────────────
// Zwilling der SQL-Funktion `training_fehlende_bedingungen`: Die trainingsweiten
// Bedingungen erscheinen genau einmal, die Hauptteil-Bedingung einmal je
// Variante — und in derselben Reihenfolge, weil der DB-Fehler den ersten
// Eintrag nennt.
const einleitung = { trainingsteil: "einleitung", varianteId: null };
const freiesSpiel = (varianteId: string) => ({
  trainingsteil: "hauptteil",
  hauptteilkategorie: "fussball-spielen",
  varianteId,
});

pruefe("Kinderfussball, eine Variante: vollständig heisst nichts offen", () => {
  assert.deepEqual(
    fehlendeBedingungenAus(
      "kinderfussball",
      ["G"],
      [einleitung, freiesSpiel("v1")],
      [varianten[0]],
    ),
    [],
  );
});

pruefe("Bei genau einer Variante wird sie nicht genannt", () => {
  // Epic EK 7: Ein Training mit einer Variante verhält sich überall wie vor
  // diesem Epic — die Bezeichnung hat der Trainer nie vergeben und sieht sie
  // nirgends. Zwilling der `v_variantenzahl`-Schranke in SQL.
  assert.deepEqual(
    fehlendeBedingungenAus("kinderfussball", ["G"], [einleitung], [varianten[0]]),
    [{ bedingung: "freies_spiel", varianteId: null }],
  );
});

pruefe("Kinderfussball, zwei Varianten: die leere wird einzeln genannt", () => {
  // Der Kern der Story: Variante 1 ist vollständig, Variante 2 nicht — und die
  // Meldung nennt genau v2.
  assert.deepEqual(
    fehlendeBedingungenAus(
      "kinderfussball",
      ["G"],
      [einleitung, freiesSpiel("v1")],
      varianten,
    ),
    [{ bedingung: "freies_spiel", varianteId: "v2" }],
  );
});

pruefe("Jede Variante zählt für sich — beide leer, beide genannt", () => {
  assert.deepEqual(
    fehlendeBedingungenAus("kinderfussball", ["G"], [einleitung], varianten),
    [
      { bedingung: "freies_spiel", varianteId: "v1" },
      { bedingung: "freies_spiel", varianteId: "v2" },
    ],
  );
});

pruefe("Trainingsweite Bedingungen bleiben einmalig und ohne Variante", () => {
  // Alterskategorie und Einleitung gelten je Training (#204 PC 2) — sie dürfen
  // sich nicht mit der Variantenzahl vervielfachen. Reihenfolge wie in SQL:
  // erst trainingsweit, dann je Variante.
  assert.deepEqual(
    fehlendeBedingungenAus("kinderfussball", [], [], varianten),
    [
      { bedingung: "stufe", varianteId: null },
      { bedingung: "einleitung", varianteId: null },
      { bedingung: "freies_spiel", varianteId: "v1" },
      { bedingung: "freies_spiel", varianteId: "v2" },
    ],
  );
});

pruefe("Junioren: Spielformen je Variante, die übrigen Blöcke je Training", () => {
  const jun = [
    { trainingsteil: "jun-aufwaermen", varianteId: null },
    { trainingsteil: "jun-spielform-trainingsziel", varianteId: null },
    { trainingsteil: "jun-explosivitaet", varianteId: null },
    { trainingsteil: "jun-spielformen", varianteId: "v1" },
  ];
  assert.deepEqual(
    fehlendeBedingungenAus("juniorenfussball", ["D"], jun, [varianten[0]]),
    [],
  );
  assert.deepEqual(
    fehlendeBedingungenAus("juniorenfussball", ["D"], jun, varianten),
    [{ bedingung: "jun-spielformen", varianteId: "v2" }],
  );
  // Fehlt ein trainingsweiter Block, erscheint er einmal — auch bei zwei
  // Varianten.
  assert.deepEqual(
    fehlendeBedingungenAus("juniorenfussball", ["D"], [], varianten),
    [
      { bedingung: "jun-aufwaermen", varianteId: null },
      { bedingung: "jun-spielform-trainingsziel", varianteId: null },
      { bedingung: "jun-explosivitaet", varianteId: null },
      { bedingung: "jun-spielformen", varianteId: "v1" },
      { bedingung: "jun-spielformen", varianteId: "v2" },
    ],
  );
});

pruefe("Ohne Variante bleibt die Hauptteil-Bedingung geprüft", () => {
  // Ein leerer Varianten-Embed darf nicht zu «alles erfüllt» führen — sonst
  // liesse ein Datenfehler ein unvollständiges Training öffentlich werden.
  assert.deepEqual(
    fehlendeBedingungenAus("kinderfussball", ["G"], [einleitung], []),
    [{ bedingung: "freies_spiel", varianteId: null }],
  );
});

pruefe("Eine Fassung ausserhalb des Hauptteils gilt für alle Varianten", () => {
  // `varianteId: null` heisst «gilt überall» — die Einleitung darf nicht an der
  // ersten Variante hängen bleiben.
  assert.deepEqual(
    fehlendeBedingungenAus(
      "kinderfussball",
      ["G"],
      [einleitung, freiesSpiel("v1"), freiesSpiel("v2")],
      varianten,
    ),
    [],
  );
});

// ── bedingungText (#204 AK 2) ───────────────────────────────────────────────
pruefe("Der Text nennt die Variante nur, wenn eine übergeben wird", () => {
  assert.equal(
    bedingungText("freies_spiel"),
    "mindestens eine Übung im freien Spiel",
  );
  assert.equal(
    bedingungText("freies_spiel", "21 Kinder"),
    "mindestens eine Übung im freien Spiel in der Variante „21 Kinder\"",
  );
});

// ── bedingungsMeldungFuer (#204 AK 3) ───────────────────────────────────────
pruefe("Die laufende Verweigerung nennt Variante und Block", () => {
  assert.equal(
    bedingungsMeldungFuer("freies_spiel", "21 Kinder"),
    "Ein öffentliches Training braucht mindestens eine Übung im freien Spiel " +
      "in der Variante „21 Kinder\". " +
      "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
  );
});

pruefe("Ohne Variantennamen bleibt der Satz allgemein", () => {
  assert.equal(
    bedingungsMeldungFuer("einleitung"),
    "Ein öffentliches Training braucht mindestens eine Übung in der Einleitung. " +
      "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
  );
});

// ── varianteAusFehler: Zwilling des SQL-Markers ─────────────────────────────
pruefe("Die Variante wird aus der DB-Meldung gelesen", () => {
  assert.equal(
    varianteAusFehler("TRAINING_UNVOLLSTAENDIG: freies_spiel VARIANTE abc-123"),
    "abc-123",
  );
});

pruefe("Eine trainingsweite Bedingung trägt keine Variante", () => {
  assert.equal(varianteAusFehler("TRAINING_UNVOLLSTAENDIG: einleitung"), null);
  assert.equal(varianteAusFehler("TRAINING_UNVOLLSTAENDIG: stufe"), null);
});

pruefe("Ein anderer Fehler liefert keine Variante", () => {
  assert.equal(varianteAusFehler("duplicate key value violates unique constraint"), null);
});

// ── fassungenVon (#202 AK 6) ────────────────────────────────────────────────
// Das Gegenstück zu `sichtbareZuordnungen`: Dort gehört alles ausserhalb des
// Hauptteils dazu, weil es für alle Varianten gilt; hier gehört es gerade
// nicht dazu, weil es bleibt. Zählte es mit, kündigte die Rückfrage vor dem
// Entfernen den Verlust von Übungen an, die gar nicht wegfallen.
pruefe("Gezählt wird genau die eine Variante", () => {
  assert.deepEqual(
    fassungenVon(zuordnungen, "v1").map((z) => z.id),
    ["h1"],
  );
  assert.deepEqual(
    fassungenVon(zuordnungen, "v2").map((z) => z.id),
    ["h2"],
  );
});

pruefe("Was ausserhalb des Hauptteils liegt, zählt nie mit", () => {
  // `e1` trägt `varianteId: null` — es gilt für alle Varianten und fällt mit
  // keiner weg.
  assert.equal(
    fassungenVon(zuordnungen, "weg").length,
    0,
  );
});

// ── wegfallSatz (#202 AK 6) ─────────────────────────────────────────────────
const wegfall = (n: number, notizen: number, gruppen: number) =>
  Array.from({ length: n }, (_, i) => ({
    notiz: i < notizen ? "Text" : null,
    gruppen: i < gruppen ? ["g1"] : [],
  }));

const NACHSATZ = "Die Gruppen selbst und die übrigen Varianten bleiben.";

pruefe("Mehrzahl: die Zahl der Übungen und der Nachsatz", () => {
  assert.equal(
    wegfallSatz(varianten[1], wegfall(2, 0, 0)),
    `Mit „21 Kinder" fallen 2 Übungen weg. ${NACHSATZ}`,
  );
});

pruefe("Einzahl wechselt die Wendung statt die Zahl zu wiederholen", () => {
  // „1 Übung, davon 1 mit Notiz" sähe aus wie ein Zählfehler.
  assert.equal(
    wegfallSatz(varianten[1], wegfall(1, 1, 0)),
    `Mit „21 Kinder" fällt 1 Übung weg, sie trägt eine Notiz. ${NACHSATZ}`,
  );
  assert.equal(
    wegfallSatz(varianten[1], wegfall(1, 1, 1)),
    `Mit „21 Kinder" fällt 1 Übung weg, sie trägt eine Notiz und eine ` +
      `Gruppenzuweisung. ${NACHSATZ}`,
  );
});

pruefe("Notiz und Gruppenzuweisung werden einzeln gezählt", () => {
  assert.equal(
    wegfallSatz(varianten[1], wegfall(3, 2, 1)),
    `Mit „21 Kinder" fallen 3 Übungen weg, davon 2 mit Notiz und ` +
      `1 mit Gruppenzuweisung. ${NACHSATZ}`,
  );
});

pruefe("Eine leere Notiz ist keine Notiz", () => {
  // Der leere String kommt aus einem Feld, das jemand geleert hat — er ist
  // keine Arbeit, die verlorenginge.
  assert.equal(
    wegfallSatz(varianten[1], [{ notiz: "", gruppen: [] }]),
    `Mit „21 Kinder" fällt 1 Übung weg. ${NACHSATZ}`,
  );
});

pruefe("Eine leere Variante nennt nur die Null", () => {
  assert.equal(
    wegfallSatz(varianten[1], []),
    `Mit „21 Kinder" fallen 0 Übungen weg. ${NACHSATZ}`,
  );
});

// ── aufloesungSatz (#209) ───────────────────────────────────────────────────
pruefe("Die Auflösung wird angekündigt, nicht nachträglich entdeckt", () => {
  // Zwilling des Auflösungs-`update` in `entferne_variante()`: Die bleibende
  // Variante bekommt den Vorgabenamen und die Position 0 zurück, und die
  // Oberfläche zeigt danach gar keine Bezeichnung mehr (Epic EK 7).
  assert.equal(
    aufloesungSatz(varianten[0]),
    "Danach bleibt eine einzige Variante übrig — sie wird aufgelöst: " +
      "„28 Kinder\" heisst dann wieder schlicht Hauptteil, " +
      "und die Leiste zeigt nur noch „Variante hinzufügen\".",
  );
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
