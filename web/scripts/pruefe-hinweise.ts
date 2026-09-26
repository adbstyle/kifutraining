// Prüft die fachlichen Hinweise an den KI-Assistenten (Story #195,
// web/lib/hinweise.ts) und dass die Oberfläche denselben Wortlaut zeichnet.
// Ohne DB und ohne Netz; läuft im PR-Check nach `check:kern`.
//
// Der Wert dieser Prüfung liegt an drei Stellen:
//
// - **Wortgleichheit (PC 2).** Die Texte standen früher als JSX-Literale in den
//   Komponenten. Jede lib-Konstante wird hier gegen das eingefrorene Literal
//   geprüft, wie React es gerendert hat (Leerraum zusammengefasst, der
//   Halbgeviertstrich in «10–12 min», das ASCII-Minus in «(-5 min)»).
// - **Eine Quelle.** Die Komponenten dürfen die Literale nicht mehr enthalten —
//   sonst könnte eine Seite geändert werden, ohne dass die andere mitgeht.
// - **Die Rechnung.** Je Variante wie der Editor, Hinweise ausserhalb des
//   Hauptteils nur einmal, Veröffentlichung nur beim eigenen persönlichen
//   Training, Zeitrichtwerte nur im Juniorenfussball.
//
//   npm run check:hinweise
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BANDBREITEN, GESAMTDAUER_JUNIOREN, gesamtAbgleich, zeitAbgleich } from "../lib/junioren";
import { ANZAHL_HINWEIS_TEXT, LEER_HINWEIS, STUFE_ABWEICHEND_TEXT, ohneDauerText } from "../lib/training";
import { ZUM_VEROEFFENTLICHEN_FEHLT } from "../lib/training-bedingungen";
import { HinweiseAuskunft, alsAuskunft, hinweiseFuer, type Hinweis } from "../lib/hinweise";
import type { TrainingDetail, TrainingExerciseItem } from "../lib/queries/trainings-fuer";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");

let gelaufen = 0;
function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

const ICH = "00000000-0000-0000-0000-00000000000a";
const FREMD = "00000000-0000-0000-0000-00000000000b";

function fassung(id: string, teil: string, extra: Partial<TrainingExerciseItem> = {}): TrainingExerciseItem {
  return {
    id,
    trainingsteil: teil as TrainingExerciseItem["trainingsteil"],
    hauptteilkategorie: null,
    varianteId: null,
    position: 0,
    durationMin: null,
    notiz: null,
    name: `Übung ${id}`,
    kategorien: [],
    erscheinungsform: [],
    feldtyp: null,
    spielfeldLaengeM: null,
    spielfeldBreiteM: null,
    uebungstyp: null,
    anzahlKinder: null,
    material: [],
    materialListe: [],
    materialBasis: null,
    fahrplan: null,
    aufbau: null,
    bildUrl: null,
    bildQuelle: null,
    diagramm: null,
    gruppen: [],
    uebungsvarianten: null,
    ...extra,
  };
}

function training(extra: Partial<TrainingDetail>): TrainingDetail {
  return {
    id: "t1",
    name: "Probe",
    ownerId: ICH,
    visibility: "private",
    altersstufe: "kinderfussball",
    stufen: ["F"],
    ziel: null,
    team: null,
    terminDatum: null,
    urheber: "Ich",
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z",
    exercises: [],
    gruppen: [],
    varianten: [{ id: "v1", name: "Variante 1" }],
    ...extra,
  };
}

/** Hinweise samt Schema-Probe: Das Ergebnis des Werkzeugs muss durch das
 *  Schema gehen, ohne dass ein Feld wegfällt (z.object streift Unbekanntes
 *  still ab — ein Vergleich nach dem Parsen deckt es auf). */
function hinweise(t: TrainingDetail, userId = ICH): Hinweis[] {
  const h = hinweiseFuer(t, userId);
  const aussen = { hinweise: h.map(alsAuskunft) };
  assert.deepEqual(HinweiseAuskunft.parse(aussen), aussen, "Schema streift Felder ab");
  return h;
}

const nur = (h: Hinweis[], art: Hinweis["art"]) => h.filter((x) => x.art === art);
const EINL = (n: number, extra: Partial<TrainingExerciseItem> = {}) =>
  Array.from({ length: n }, (_, i) => fassung(`e${i + 1}`, "einleitung", { durationMin: 10, ...extra }));
const FREI = (id: string, extra: Partial<TrainingExerciseItem> = {}) =>
  fassung(id, "hauptteil", { hauptteilkategorie: "fussball-spielen", durationMin: 15, ...extra });

// ── Eingefrorene Literale: der Wortlaut, wie die Oberfläche ihn zeigte ──────

pruefe("Textkonstanten entsprechen den früheren JSX-Literalen", () => {
  // TeilKarte.tsx vor #195, Leerraum wie gerendert zusammengefasst.
  assert.equal(
    ANZAHL_HINWEIS_TEXT,
    "Ungewöhnlich viele Übungen für diesen Trainingsteil — erlaubt, achte nur auf die Gesamtdauer.",
  );
  assert.equal(ohneDauerText(1), "1 Übung ohne erfasste Dauer (zählt nicht zur Summe).");
  assert.equal(ohneDauerText(3), "3 Übungen ohne erfasste Dauer (zählt nicht zur Summe).");
  // TrainingExerciseRow.tsx (title) und SichtbarkeitDialoge.tsx.
  assert.equal(STUFE_ABWEICHEND_TEXT, "Deckt keine der Trainings-Stufen ab");
  assert.equal(ZUM_VEROEFFENTLICHEN_FEHLT, "Zum Veröffentlichen fehlt noch:");
});

/** Die frühere Ausgabe von `ZeitAbgleich`/`GesamtAbgleich` — Zeichen für
 *  Zeichen nachgebaut, wie React sie als textContent zeigte. */
function zeitAbgleichAlt(slug: string, sum: number): string | null {
  const band = BANDBREITEN[slug];
  if (!band) return null;
  const richtwert = `${band.min}–${band.max} min`;
  if (sum === 0) return `Richtwert ${richtwert}`;
  const delta = sum < band.min ? sum - band.min : sum > band.max ? sum - band.max : 0;
  return `Richtwert ${richtwert}` + (delta !== 0 ? ` (${delta > 0 ? `+${delta}` : delta} min)` : "");
}
function gesamtAbgleichAlt(sum: number, soll: number): string {
  const delta = sum - soll;
  return `vorgesehen ${soll} min` + (sum > 0 && delta !== 0 ? ` (${delta > 0 ? `+${delta}` : delta} min)` : "");
}

pruefe("zeitAbgleich/gesamtAbgleich: Zeichen für Zeichen wie die frühere Anzeige", () => {
  for (const slug of [...Object.keys(BANDBREITEN), "auffangen", "jun-auffangen", "jun-abschluss"])
    for (let sum = 0; sum <= 120; sum++) {
      const a = zeitAbgleich(slug, sum);
      const alt = zeitAbgleichAlt(slug, sum);
      assert.equal(a ? a.richtwertText + a.abweichungText : null, alt, `${slug} ${sum}`);
    }
  for (let sum = 0; sum <= 200; sum++) {
    const g = gesamtAbgleich(sum, GESAMTDAUER_JUNIOREN);
    assert.equal(g.vorgesehenText + g.abweichungText, gesamtAbgleichAlt(sum, GESAMTDAUER_JUNIOREN));
  }
  // Einzelne Stellen ausdrücklich: Halbgeviertstrich, ASCII-Minus, Grenzen.
  assert.equal(zeitAbgleich("jun-aufwaermen", 0)?.richtwertText, "Richtwert 10–12 min");
  assert.equal(zeitAbgleich("jun-aufwaermen", 0)?.abweichungText, "");
  assert.equal(zeitAbgleich("einstieg", 35)?.abweichungText, " (+5 min)");
  assert.equal(zeitAbgleich("einstieg", 15)?.abweichungText, " (-5 min)");
  assert.equal(zeitAbgleich("einstieg", 20)?.abweichungMin, 0);
  assert.equal(zeitAbgleich("einstieg", 30)?.abweichungMin, 0);
  assert.equal(zeitAbgleich("auffangen", 30), null);
  assert.equal(gesamtAbgleich(80, 90).abweichungText, " (-10 min)");
  assert.equal(gesamtAbgleich(0, 90).abweichungText, "");
});

// ── Eine Quelle: keine Literale mehr in den Komponenten ─────────────────────

/** Quelltext ohne Kommentare — ein Kommentar darf den Wortlaut zitieren. */
function ohneKommentare(pfad: string): string {
  return readFileSync(join(web, pfad), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

pruefe("Die Komponenten zeichnen aus lib und tragen die Literale nicht mehr", () => {
  const verboten: [string, RegExp[], string[]][] = [
    [
      "components/training/ZeitAbgleich.tsx",
      [/\bRichtwert\s/, /\bvorgesehen\s/, /–/, /min\)/, /BANDBREITEN/],
      ["zeitAbgleich(", "gesamtAbgleich("],
    ],
    [
      "components/training/editor/TeilKarte.tsx",
      [/Ungewöhnlich/, /ohne\s+erfasste/, /zählt nicht zur Summe/],
      ["ANZAHL_HINWEIS_TEXT", "ohneDauerText("],
    ],
    [
      "components/training/editor/TrainingExerciseRow.tsx",
      [/Deckt keine/],
      ["STUFE_ABWEICHEND_TEXT"],
    ],
    [
      "components/training/ExercisePickerDialog.tsx",
      [/Deckt keine/],
      ["STUFE_ABWEICHEND_TEXT"],
    ],
    [
      "components/training/SichtbarkeitDialoge.tsx",
      [/Zum Veröffentlichen fehlt/],
      ["ZUM_VEROEFFENTLICHEN_FEHLT"],
    ],
  ];
  for (const [pfad, muster, noetig] of verboten) {
    const text = ohneKommentare(pfad);
    for (const m of muster) assert.ok(!m.test(text), `${pfad} enthält noch ${m}`);
    for (const n of noetig) assert.ok(text.includes(n), `${pfad} nutzt ${n} nicht`);
  }
});

// ── 1. Leeres Kinderfussball-Training ───────────────────────────────────────

pruefe("Leeres Kinderfussball-Training: zwei sperrende Bedingungen, das leere freie Spiel", () => {
  assert.deepEqual(hinweise(training({})), [
    {
      art: "veroeffentlichung",
      stelle: { teil: "einleitung" },
      text: "Zum Veröffentlichen fehlt noch: mindestens eine Übung in der Einleitung",
      sperrt: true,
    },
    {
      art: "veroeffentlichung",
      stelle: { teil: "hauptteil", hauptteilkategorie: "fussball-spielen" },
      text: "Zum Veröffentlichen fehlt noch: mindestens eine Übung im freien Spiel",
      sperrt: true,
    },
    {
      art: "block_leer",
      stelle: { teil: "hauptteil", hauptteilkategorie: "fussball-spielen" },
      text: "Das freie Spiel ist noch leer — im Kinderfussball gehört es in jedes Training.",
      sperrt: false,
    },
  ]);
  // Ohne Alterskategorie kommt die dritte Bedingung dazu — ohne Stelle.
  const ohneStufe = nur(hinweise(training({ stufen: [] })), "veroeffentlichung");
  assert.deepEqual(ohneStufe[0], {
    art: "veroeffentlichung",
    stelle: {},
    text: "Zum Veröffentlichen fehlt noch: mindestens eine Alterskategorie",
    sperrt: true,
  });
  assert.equal(LEER_HINWEIS["fussball-spielen"], nur(hinweise(training({})), "block_leer")[0].text);
});

pruefe("Vollständiges Kinderfussball-Training: nichts zu melden", () => {
  assert.deepEqual(hinweise(training({ exercises: [...EINL(1), FREI("h1")] })), []);
});

// ── 2. Ungewöhnlich viele Übungen ───────────────────────────────────────────

pruefe("Vier Übungen in der Einleitung: teil_voll mit dem Text der Teil-Karte", () => {
  const h = nur(hinweise(training({ exercises: [...EINL(4), FREI("h1")] })), "teil_voll");
  assert.deepEqual(h, [
    { art: "teil_voll", stelle: { teil: "einleitung" }, text: ANZAHL_HINWEIS_TEXT, sperrt: false },
  ]);
  // Drei sind noch gewöhnlich.
  assert.deepEqual(nur(hinweise(training({ exercises: [...EINL(3), FREI("h1")] })), "teil_voll"), []);
});

// ── 3. Zwei Varianten, eine ohne freies Spiel ───────────────────────────────

pruefe("Zwei Varianten, eine ohne freies Spiel: genau ein Eintrag mit der Variante", () => {
  const h = hinweise(
    training({
      varianten: [
        { id: "v1", name: "Variante 1" },
        { id: "v2", name: "Rondo" },
      ],
      exercises: [...EINL(1), FREI("h1", { varianteId: "v1" })],
    }),
  );
  assert.deepEqual(nur(h, "veroeffentlichung"), [
    {
      art: "veroeffentlichung",
      stelle: { teil: "hauptteil", hauptteilkategorie: "fussball-spielen", varianteId: "v2" },
      text: "Zum Veröffentlichen fehlt noch: mindestens eine Übung im freien Spiel in der Variante „Rondo\"",
      sperrt: true,
    },
  ]);
  // Das leere freie Spiel nur in der Variante, in der es leer ist.
  assert.deepEqual(
    nur(h, "block_leer").map((x) => x.stelle.varianteId),
    ["v2"],
  );
});

// ── 4. Zeitrichtwerte im Juniorenfussball ───────────────────────────────────

const jun = (id: string, block: string, min: number | null, extra: Partial<TrainingExerciseItem> = {}) =>
  fassung(id, block, { durationMin: min, ...extra });

pruefe("Junioren: Einstieg 35 min, Explosivität zu lang, Spielformen zu kurz, Gesamt 80", () => {
  const h = hinweise(
    training({
      altersstufe: "juniorenfussball",
      stufen: ["D"],
      exercises: [
        jun("a", "jun-aufwaermen", 12),
        jun("b", "jun-spielform-trainingsziel", 8),
        jun("c", "jun-explosivitaet", 15),
        jun("d", "jun-spielformen", 20),
        jun("e", "jun-spiel", 15),
        jun("f", "jun-abschluss", 10),
      ],
    }),
  );
  // Einstieg 35 + Hauptteil 35 + Abschluss 10 = 80.
  assert.deepEqual(nur(h, "zeitrichtwert"), [
    {
      art: "zeitrichtwert",
      stelle: { teil: "einstieg" },
      text: "Richtwert 20–30 min (+5 min)",
      sperrt: false,
      richtwert: { minMin: 20, maxMin: 30, summeMin: 35, abweichungMin: 5 },
    },
    {
      art: "zeitrichtwert",
      stelle: { teil: "einstieg", block: "jun-explosivitaet" },
      text: "Richtwert 8–10 min (+5 min)",
      sperrt: false,
      richtwert: { minMin: 8, maxMin: 10, summeMin: 15, abweichungMin: 5 },
    },
    {
      art: "zeitrichtwert",
      stelle: { teil: "hauptteil" },
      text: "Richtwert 45–65 min (-10 min)",
      sperrt: false,
      richtwert: { minMin: 45, maxMin: 65, summeMin: 35, abweichungMin: -10 },
    },
    {
      art: "zeitrichtwert",
      stelle: { teil: "hauptteil", block: "jun-spielformen" },
      text: "Richtwert 30–45 min (-10 min)",
      sperrt: false,
      richtwert: { minMin: 30, maxMin: 45, summeMin: 20, abweichungMin: -10 },
    },
    {
      art: "zeitrichtwert",
      stelle: { gesamt: true },
      text: "vorgesehen 90 min (-10 min)",
      sperrt: false,
      richtwert: { minMin: 90, maxMin: 90, summeMin: 80, abweichungMin: -10 },
    },
  ]);
  // Im Juniorenfussball gibt es keinen «ungewöhnlich viele»-Hinweis (AK 9).
  assert.deepEqual(nur(h, "teil_voll"), []);
});

pruefe("Junioren: auf der Grenze kein Hinweis; einblockiger Teil nur am Teil", () => {
  const h = hinweise(
    training({
      altersstufe: "juniorenfussball",
      stufen: ["D"],
      exercises: [
        jun("a", "jun-aufwaermen", 12),
        jun("b", "jun-spielform-trainingsziel", 8),
        jun("c", "jun-explosivitaet", 10), // Einstieg genau 30
        jun("d", "jun-spielformen", 30),
        jun("e", "jun-spiel", 15), // Hauptteil genau 45
        jun("f", "jun-abschluss", 15), // Abschluss 15 > 10
      ],
    }),
  );
  // 30 + 45 + 15 = 90: auch die Gesamtdauer passt.
  assert.deepEqual(
    nur(h, "zeitrichtwert").map((x) => [x.stelle, x.text]),
    [[{ teil: "abschluss" }, "Richtwert 5–10 min (+5 min)"]],
  );
});

pruefe("Junioren: Bedingungen und leere Blöcke an Teil und Block", () => {
  const h = hinweise(training({ altersstufe: "juniorenfussball", stufen: ["D"] }));
  assert.deepEqual(
    nur(h, "veroeffentlichung").map((x) => [x.stelle, x.text]),
    [
      [{ teil: "einstieg", block: "jun-aufwaermen" }, "Zum Veröffentlichen fehlt noch: mindestens eine Übung im Aufwärmen"],
      [
        { teil: "einstieg", block: "jun-spielform-trainingsziel" },
        "Zum Veröffentlichen fehlt noch: mindestens eine Übung in der Spielform zum Trainingsziel",
      ],
      [{ teil: "einstieg", block: "jun-explosivitaet" }, "Zum Veröffentlichen fehlt noch: mindestens eine Übung in der Explosivität"],
      [
        { teil: "hauptteil", block: "jun-spielformen" },
        "Zum Veröffentlichen fehlt noch: mindestens eine Übung in den Spielformen und unterstützenden Übungen",
      ],
    ],
  );
  assert.deepEqual(
    nur(h, "block_leer").map((x) => x.stelle.block),
    ["jun-spielform-trainingsziel", "jun-explosivitaet", "jun-spiel", "jun-abschluss"],
  );
  // Ohne erfasste Dauer kein Zeitrichtwert, auch nicht gesamt.
  assert.deepEqual(nur(h, "zeitrichtwert"), []);
});

pruefe("Kinderfussball kennt keine Zeitrichtwerte (AK 9)", () => {
  const h = hinweise(training({ exercises: [...EINL(1, { durationMin: 90 }), FREI("h1", { durationMin: 90 })] }));
  assert.deepEqual(nur(h, "zeitrichtwert"), []);
});

// ── 5. Gruppenverteilung ────────────────────────────────────────────────────

pruefe("Doppelte Gruppe im 1. Wechsel: gruppe_doppelt mit Gruppe, Wechsel und Übungen", () => {
  const G = [
    { id: "g1", name: "Blau" },
    { id: "g2", name: "Gelb" },
  ];
  const lernen = (id: string, min: number, gruppen: string[]) =>
    fassung(id, "hauptteil", {
      hauptteilkategorie: "fussball-spielen-lernen",
      durationMin: min,
      gruppen: gruppen.map((g) => G.find((x) => x.id === g)!),
    });
  const h = hinweise(
    training({
      gruppen: G,
      exercises: [...EINL(1), lernen("a", 10, ["g1"]), lernen("b", 15, ["g1"]), FREI("h1")],
    }),
  );
  assert.deepEqual(nur(h, "gruppe_doppelt"), [
    {
      art: "gruppe_doppelt",
      stelle: { teil: "hauptteil", gruppeId: "g1", wechsel: [1], fassungIds: ["a", "b"] },
      text: "Blau steht im 1. Wechsel an zwei Übungen.",
      sperrt: false,
    },
  ]);
  assert.deepEqual(nur(h, "dauer_ungleich"), [
    {
      art: "dauer_ungleich",
      stelle: { teil: "hauptteil", wechsel: [1], fassungIds: ["a", "b"] },
      text: "Im 1. Wechsel sind die Übungen ungleich lang (10 und 15 min).",
      sperrt: false,
    },
  ]);
});

// ── 6. Wem die Veröffentlichung gilt ────────────────────────────────────────

pruefe("Team-Training und fremdes Training: keine Veröffentlichungsbedingungen", () => {
  const team = hinweise(training({ team: { id: "tm", name: "Team" } }));
  assert.deepEqual(nur(team, "veroeffentlichung"), []);
  assert.equal(nur(team, "block_leer").length, 1, "die übrigen Hinweise bleiben");
  const fremd = hinweise(training({ ownerId: FREMD, visibility: "public" }));
  assert.deepEqual(nur(fremd, "veroeffentlichung"), []);
  assert.equal(nur(fremd, "block_leer").length, 1);
});

// ── 7. Zwei Varianten: nichts doppelt ausserhalb des Hauptteils ─────────────

pruefe("Zwei Varianten: Hinweise ausserhalb des Hauptteils erscheinen einmal", () => {
  const h = hinweise(
    training({
      stufen: ["F"],
      varianten: [
        { id: "v1", name: "Variante 1" },
        { id: "v2", name: "Rondo" },
      ],
      exercises: [
        ...EINL(4, { durationMin: null }),
        fassung("x", "ausklang", { kategorien: ["E"] }),
        FREI("h1", { varianteId: "v1", durationMin: null }),
        FREI("h2", { varianteId: "v2" }),
      ],
    }),
  );
  assert.deepEqual(nur(h, "teil_voll").map((x) => x.stelle), [{ teil: "einleitung" }]);
  assert.deepEqual(
    nur(h, "dauer_fehlt").map((x) => [x.stelle, x.text]),
    [
      [{ teil: "einleitung", fassungIds: ["e1", "e2", "e3", "e4"] }, ohneDauerText(4)],
      [{ teil: "hauptteil", varianteId: "v1", fassungIds: ["h1"] }, ohneDauerText(1)],
      [{ teil: "ausklang", fassungIds: ["x"] }, ohneDauerText(1)],
    ],
  );
  // Die Übung ausserhalb der Stufen einmal, ohne Variante.
  assert.deepEqual(nur(h, "stufe_abweichend"), [
    {
      art: "stufe_abweichend",
      stelle: { teil: "ausklang", fassungIds: ["x"] },
      text: STUFE_ABWEICHEND_TEXT,
      sperrt: false,
    },
  ]);
});

// ── Übrige Arten ────────────────────────────────────────────────────────────

pruefe("Dauer fehlt: das Auffangen zählt nicht, die Stelle nennt die Übungen", () => {
  const h = hinweise(
    training({
      exercises: [
        fassung("auf", "auffangen"),
        ...EINL(2, { durationMin: null }),
        FREI("h1"),
      ],
    }),
  );
  assert.deepEqual(nur(h, "dauer_fehlt"), [
    {
      art: "dauer_fehlt",
      stelle: { teil: "einleitung", fassungIds: ["e1", "e2"] },
      text: "2 Übungen ohne erfasste Dauer (zählt nicht zur Summe).",
      sperrt: false,
    },
  ]);
});

pruefe("Stufe abweichend: nur Übungen mit Kategorien, die keine Trainings-Stufe abdecken", () => {
  const h = hinweise(
    training({
      stufen: ["F"],
      exercises: [
        ...EINL(1, { kategorien: ["F", "E"] }),
        FREI("h1", { kategorien: ["E"] }),
        fassung("leer", "ausklang", { durationMin: 5 }),
      ],
    }),
  );
  assert.deepEqual(nur(h, "stufe_abweichend"), [
    {
      art: "stufe_abweichend",
      stelle: { teil: "hauptteil", hauptteilkategorie: "fussball-spielen", fassungIds: ["h1"] },
      text: STUFE_ABWEICHEND_TEXT,
      sperrt: false,
    },
  ]);
});

pruefe("Nur Veröffentlichungsbedingungen sperren", () => {
  const h = hinweise(training({ stufen: ["F"], exercises: [...EINL(5, { durationMin: null, kategorien: ["E"] })] }));
  for (const x of h) assert.equal(x.sperrt, x.art === "veroeffentlichung", x.art);
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
