// Prüft die Farbpalette des Designsystems: die Rechnung (web/lib/farben.ts)
// und ihre Deckungsgleichheit mit dem, was der Browser wirklich bekommt
// (web/app/globals.css). Ohne DB und ohne Netz; läuft im PR-Check neben
// `typecheck`, `check:gruppen` und `check:varianten`.
//
// Der Wert dieser Prüfung liegt an vier Stellen:
//
// - **Zwilling.** `lib/farben.ts` und der `@theme`-Block sind zwei Quellen
//   derselben Palette. Driften sie, rechnet die Prüfung mit Farben, die gar
//   nicht auf dem Schirm stehen — und meldet Kontraste, die es nicht gibt.
// - **Herleitung.** Die Höhenleiter ist definitionsgemäss weisses Overlay über
//   dem Grund. Im CSS steht davon nur das Ergebnis; hier wird es nachgerechnet,
//   damit ein vertippter Hex-Wert nicht als Designentscheid durchgeht.
// - **Lesbarkeit.** Kontrast ist eine Rechnung nach WCAG 2.1, keine Meinung.
//   Jede Paarung, die die Anwendung tatsächlich zeigt, wird hier geprüft.
// - **Altlasten.** Tailwind v4 meldet unbekannte Utilities NICHT — `text-chalk`
//   erzeugt einfach keine Regel, und der Text erbt still die Elternfarbe. Eine
//   vergessene Klasse aus der alten Palette fällt deshalb weder beim Build noch
//   im Typecheck auf, sondern erst im Betrieb. Darum der Wächter am Schluss.
//
//   npm run check:farben
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BILDSCHIRM,
  DRUCK,
  DRUCK_SCHRIFT,
  ELEV,
  ERROR,
  GRUND,
  KAT,
  ON_ERROR,
  ON_PRIMARY,
  PRIMARY,
  SCHRIFT,
  elev,
  elevName,
  hex8,
  kontrast,
  relativeLuminanz,
  rgbAbstand,
  ueberlagern,
} from "../lib/farben";
import { blockVon, normalisiere, tokens } from "./css-tokens";

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

/** Zwei Nachkommastellen — Kontraste wollen verglichen, nicht bewundert werden. */
const z = (wert: number) => wert.toFixed(2);

// ── globals.css lesen ───────────────────────────────────────────────────────
// Gelesen wird der Text, nicht ein Build-Ergebnis: Die Prüfung soll auch dann
// greifen, wenn niemand `next build` laufen lässt.
const CSS = readFileSync(join(WEB, "app/globals.css"), "utf8");

const THEME = tokens(blockVon(CSS, /@theme\b/, "@theme-Block"), "color");
const PRINT = tokens(
  blockVon(blockVon(CSS, /@media\s+print\b/, "@media print"), /:root\b/, "print :root"),
  "color",
);

// ── 1. Zwilling: farben.ts und globals.css sagen dasselbe ───────────────────
pruefe("Jede Rolle aus farben.ts steht gleichlautend in globals.css", () => {
  const abweichend: string[] = [];
  for (const [rolle, wert] of Object.entries(BILDSCHIRM)) {
    const imCss = THEME.get(rolle);
    if (imCss === undefined) abweichend.push(`--color-${rolle} fehlt im @theme`);
    else if (imCss !== normalisiere(wert)) {
      abweichend.push(`--color-${rolle}: CSS ${imCss}, farben.ts ${wert}`);
    }
  }
  assert.deepEqual(abweichend, []);
});

pruefe("globals.css führt keine Farbrolle, die farben.ts nicht kennt", () => {
  // Die Gegenrichtung fängt tote Tokens: eine Rolle, die nach einem Umbau
  // niemand mehr anwendet, bleibt sonst als scheinbar gültige Klasse stehen.
  const unbekannt = [...THEME.keys()].filter((rolle) => !(rolle in BILDSCHIRM));
  assert.deepEqual(unbekannt, []);
});

// ── 2. Overlay-Rechnung: die Höhenleiter ist hergeleitet, nicht geraten ─────
pruefe("Jede Höhenstufe ist Weiss über dem Grund in ihrer Deckung", () => {
  for (const stufe of ELEV) {
    assert.equal(
      stufe.hex,
      ueberlagern("#ffffff", stufe.overlay / 100, GRUND),
      `${elevName(stufe.dp)} (${stufe.overlay} %)`,
    );
  }
});

pruefe("Die unterste Stufe IST der Grund", () => {
  assert.equal(ELEV[0].overlay, 0);
  assert.equal(ELEV[0].hex, GRUND);
});

// ── 3. Monotonie: höher heisst heller ──────────────────────────────────────
pruefe("Die Luminanz steigt über die ganze Leiter streng an", () => {
  // Zwei Stufen mit derselben Helligkeit wären zwei Tokens für eine Farbe —
  // dann liesse sich ein Menü nicht mehr von der Karte darunter unterscheiden.
  for (let i = 1; i < ELEV.length; i++) {
    const vorher = relativeLuminanz(ELEV[i - 1].hex);
    const jetzt = relativeLuminanz(ELEV[i].hex);
    assert.ok(
      jetzt > vorher,
      `${elevName(ELEV[i].dp)} (${z(jetzt * 100)}) ist nicht heller als ` +
        `${elevName(ELEV[i - 1].dp)} (${z(vorher * 100)})`,
    );
  }
});

// ── 4. Kontrast der Schrift ────────────────────────────────────────────────
// Schrift liegt in der Anwendung auf jeder Höhenstufe — Karte, Menü, Dialog.
// Geprüft wird gegen das Kompositergebnis, weil `#ffffffbd` durchscheint.
pruefe("Volle Schrift erreicht auf jeder Stufe 4.5:1", () => {
  for (const stufe of ELEV) {
    const wert = kontrast("#ffffff", stufe.hex);
    assert.ok(wert >= 4.5, `${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

pruefe("Mittlere Schrift (74 %) erreicht auf jeder Stufe 4.5:1", () => {
  for (const stufe of ELEV) {
    const wert = kontrast(ueberlagern("#ffffff", SCHRIFT.mittel, stufe.hex), stufe.hex);
    assert.ok(wert >= 4.5, `${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

pruefe("Tiefe Schrift (38 %) erreicht 3:1 — sie ist nur für Deaktiviertes", () => {
  // Deaktivierter Text ist unwesentlicher Inhalt (WCAG 1.4.3): Er muss
  // erkennbar bleiben, aber gerade NICHT wie lesbarer Text wirken.
  for (const stufe of ELEV) {
    const wert = kontrast(ueberlagern("#ffffff", SCHRIFT.tief, stufe.hex), stufe.hex);
    assert.ok(wert >= 3.0, `${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

// ── 5. Kontrast der Akzente ────────────────────────────────────────────────
pruefe("Primary trägt als Schrift auf elev-00 bis elev-12", () => {
  for (const stufe of ELEV.filter((s) => s.dp <= 12)) {
    const wert = kontrast(PRIMARY, stufe.hex);
    assert.ok(wert >= 4.5, `${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

pruefe("Primary auf den obersten Stufen bleibt über 4.2:1", () => {
  // Bewusste Abweichung: Text-Knöpfe im Dialog (elev-24) landen bei 4.3:1.
  // Materials eigene Baseline tut dasselbe — Primary hell genug für 4.5:1 auf
  // 24 dp zu machen, hiesse, es auf dem Seitengrund (elev-00) grell zu machen,
  // wo es zehnmal häufiger steht. Der Styleguide nennt die Abweichung.
  for (const stufe of ELEV.filter((s) => s.dp > 12)) {
    const wert = kontrast(PRIMARY, stufe.hex);
    assert.ok(wert >= 4.2, `${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

// Error auf JEDER Stufe, nicht nur auf dem Grund: Das war die Lücke, durch
// die die Kontrast-Regression kam. Materials Baseline #cf6679 trug auf elev-00
// (5.09) und fiel im Menü auf 3.62, im Dialog auf 3.17 — die Prüfung sah nur
// den Grund und schwieg. Error steht in dieser Anwendung aber fast nie als
// Fläche, sondern als Schrift auf Karte, Menüzeile und Dialog.
pruefe("Error trägt als Schrift auf JEDER Höhenstufe", () => {
  for (const stufe of ELEV) {
    const wert = kontrast(ERROR, stufe.hex);
    assert.ok(wert >= 4.5, `error auf ${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

pruefe("Error trägt als Kontur auf jeder Höhenstufe", () => {
  // Die 1.5-px-Kontur (Feld im Fehler, Meldung, destruktiver Knopf) ist ein
  // grafisches Objekt: 3:1 nach WCAG 1.4.11, nicht 4.5:1. Geprüft wird die
  // VOLLE Rolle — eine Kontur mit Alpha fällt darunter (siehe Wächter unten)
  // und ist darum in Klassenstrings verboten, nicht hier wegdefiniert.
  for (const stufe of ELEV) {
    const wert = kontrast(ERROR, stufe.hex);
    assert.ok(wert >= 3.0, `error-Kontur auf ${elevName(stufe.dp)}: ${z(wert)}:1`);
  }
});

pruefe("Die Aufschrift gefüllter Flächen trägt", () => {
  // Filled-Knopf und Fehlerfläche: Hier liegt on-* auf der Akzentfarbe selbst.
  const aufPrimary = kontrast(ON_PRIMARY, PRIMARY);
  assert.ok(aufPrimary >= 4.5, `on-primary auf primary: ${z(aufPrimary)}:1`);
  const aufError = kontrast(ON_ERROR, ERROR);
  assert.ok(aufError >= 4.5, `on-error auf error: ${z(aufError)}:1`);
});

// ── 6. Alterskategorien ────────────────────────────────────────────────────
pruefe("Jede Alterskategorie trägt auf Grund und Karte", () => {
  // Sie erscheinen als Kontur UND Schrift (Plakette, StufenField) — also gilt
  // die Schrift-Schwelle, nicht die 3:1 für grafische Objekte. Karte ist
  // elev-01, der Grund elev-00; auf beiden steht dieselbe Plakette.
  for (const [schluessel, hex] of Object.entries(KAT)) {
    for (const dp of [0, 1] as const) {
      const flaeche = elev(dp);
      const wert = kontrast(hex, flaeche);
      assert.ok(wert >= 4.5, `kat-${schluessel} auf ${elevName(dp)}: ${z(wert)}:1`);
    }
  }
});

pruefe("Keine Alterskategorie ist mit Primary verwechselbar", () => {
  // Eine Kategorie-Plakette in Primary-Nähe liest sich wie ein aktiver Zustand.
  // Der Abstand im RGB-Würfel ist ein grobes Mass, aber es trennt genau das:
  // kat-e (#ff8a65) ist neu und musste weg vom Lila der alten Fassung (5.4).
  // Schwelle 50: kat-b (#a5b4fc, 51) ist der engste Nachbar und bleibt —
  // jeder Blauton, der weiter von Primary wegrückt, fällt auf kat-g zu; der
  // Buchstabe trägt die Unterscheidung mit (Kommentar zu den kat-Tokens).
  for (const [schluessel, hex] of Object.entries(KAT)) {
    const abstand = rgbAbstand(hex, PRIMARY);
    assert.ok(abstand >= 50, `kat-${schluessel} zu primary: ${z(abstand)}`);
  }
});

pruefe("Error und die Alterskategorien bleiben unterscheidbar", () => {
  // Beide erscheinen als Kontur, und sie können am selben Ort stehen: die
  // Kategorie-Plakette und ein Fehlerrahmen auf derselben Karte. kat-c
  // (#f48fb1) ist der engste Nachbar — mit dem helleren Error rückt er von 79
  // auf 32 RGB-Einheiten heran. Das ist gewollt und trägt, weil nicht die
  // Farbe die beiden trennt, sondern die FORM: eine 22-px-Plakette mit einem
  // Buchstaben darin gegen einen Feldrahmen mit einem Satz darunter. Sie haben
  // nie dieselbe Rolle am selben Ort. Die Schwelle hält den Abstand bloss
  // fest: Wer Error oder kat-c weiter aneinander schiebt, muss hier vorbei.
  for (const [schluessel, hex] of Object.entries(KAT)) {
    const abstand = rgbAbstand(hex, ERROR);
    assert.ok(abstand >= 30, `kat-${schluessel} zu error: ${z(abstand)}`);
  }
});

// ── 7. Druck ───────────────────────────────────────────────────────────────
pruefe("Die Druckfarben tragen auf weissem Papier", () => {
  for (const rolle of ["primary", "error", "on-surface", "on-surface-mittel"] as const) {
    const wert = kontrast(DRUCK[rolle], "#ffffff");
    assert.ok(wert >= 4.5, `Druck ${rolle} auf Papier: ${z(wert)}:1`);
  }
});

pruefe("Der @media-print-Block ist der Zwilling von DRUCK", () => {
  const abweichend: string[] = [];
  for (const [rolle, wert] of Object.entries(DRUCK)) {
    const imCss = PRINT.get(rolle);
    if (imCss === undefined) abweichend.push(`--color-${rolle} fehlt im print :root`);
    else if (imCss !== normalisiere(wert)) {
      abweichend.push(`--color-${rolle}: CSS ${imCss}, farben.ts ${wert}`);
    }
  }
  for (const rolle of PRINT.keys()) {
    if (!(rolle in DRUCK)) abweichend.push(`--color-${rolle} steht nur im print :root`);
  }
  assert.deepEqual(abweichend, []);
});

pruefe("Jede Rolle, die im Druck sichtbar wird, hat einen Override", () => {
  // Flächen, Schrift, Striche und beide Akzente werden gedruckt; was keinen
  // Override hat, käme als Bildschirmfarbe aufs Papier — ein dunkler Balken.
  const pflicht = [
    ...ELEV.map((s) => elevName(s.dp)),
    "on-surface",
    "on-surface-mittel",
    "on-surface-tief",
    "linie",
    "kante",
    "primary",
    "on-primary",
    "error",
    "on-error",
    "kat-a",
    "kat-f",
  ];
  assert.deepEqual(
    pflicht.filter((rolle) => !(rolle in DRUCK)),
    [],
  );
});

pruefe("Die beiden gedruckten Kategorie-Flächen tragen ihre Schrift", () => {
  // Im Druck kippen kat-a und kat-f von Kontur auf Fläche (Vertrag §4), damit
  // sie im Schwarzweiss-Ausdruck nicht verschwinden. Dann liegt die
  // Druckschrift darauf.
  for (const rolle of ["kat-a", "kat-f"] as const) {
    const wert = kontrast(DRUCK_SCHRIFT, DRUCK[rolle]);
    assert.ok(wert >= 4.5, `Druckschrift auf ${rolle}: ${z(wert)}:1`);
  }
});

// ── 8. Altlasten-Wächter ───────────────────────────────────────────────────
// Tailwind v4 meldet unbekannte Utilities NICHT: `text-chalk` erzeugt schlicht
// keine Regel, und der Text erbt still die Farbe des Elternelements. Weder
// Build noch Typecheck schlagen an — nur dieser Wächter.
const VERBOTEN: [RegExp, string][] = [
  // Gemeint sind die Utilities der entfernten Rasen-Palette (`bg-rasen-500`),
  // nicht das Wort: seit das Diagramm eigene Rollen hat, heisst eine davon
  // `--diagramm-rasen-streifen` und ist genau richtig so.
  [/\b(?:bg|text|border|fill|stroke|ring|from|via|to)-rasen-/, "alte Rasen-Palette"],
  [/chalk/, "alte Kreide-Palette"],
  [/(?<![\wä-ü])signal(?![\wä-ü])|-signal\b/, "alter Signal-Akzent"],
  [/surface-container/, "M3-Surface-Leiter (ersetzt durch elev-*)"],
  [/surface-dim/, "M3-Surface-Leiter"],
  [/surface-bright/, "M3-Surface-Leiter"],
  [/\bbg-surface\b/, "M3-Surface-Leiter"],
  [/on-surface-variant/, "ersetzt durch on-surface-mittel"],
  [/outline-variant/, "ersetzt durch linie"],
  [/border-outline\b/, "ersetzt durch kante"],
  [/primary-container/, "Container-Rollen gibt es nicht mehr"],
  [/secondary-container/, "Container-Rollen gibt es nicht mehr"],
  [/error-container/, "Container-Rollen gibt es nicht mehr"],
  [/inverse-/, "Inverse-Rollen gibt es nicht mehr"],
  [/\bwarning\b/, "Warning ist entfallen — der Befund trägt Error-Farbe"],
  [/shadow-e[1-5]/, "ersetzt durch shadow-dp-*"],
  [/--button-/, "Component-Token"],
  [/--chip-/, "Component-Token"],
  [/--field-/, "Component-Token"],
  [/--menu-/, "Component-Token"],
  [/--dialog-/, "Component-Token"],
  [/--snackbar-/, "Component-Token"],
  [/--nav-/, "Component-Token"],
  [/--breadcrumb-/, "Component-Token"],
  // Jede eckige Klammer am Radius, nicht nur die in px: `rounded-[6px]` und
  // `rounded-[--x]` sind beide am System vorbei.
  [/rounded-\[/, "freie Radien — nur rounded-plakette/-flaeche/-dialog/-full"],
  [/border-\[1\.5px\]/, "ersetzt durch @utility kontur"],
  // Alpha auf einer KONTUR bricht die 3:1-Regel für grafische Objekte: Die
  // Kontur ist das Einzige, was die Fläche begrenzt, und `border-error/40` kam
  // im Dialog auf 1.91:1. Volles `border-error` trägt dort 4.56:1.
  [/border-error\/\d/, "Kontur mit Alpha — Error umrandet voll oder nicht"],
  [/bg-on-surface\/8/, "Hover gehört in @utility state"],
  [/translate-y-px/, "Knöpfe springen nicht mehr"],
  [/font-display/, "entfallen — es gibt nur sans und mono"],
  [/font-body/, "entfallen — es gibt nur sans und mono"],
  [/chalk-hatch/, "ersetzt durch @utility schraffur"],
];

/** Secondary trägt die Rolle der Baseline, wird aber nirgends angewendet — nur
 *  der Styleguide zeigt sie, damit sichtbar bleibt, dass es sie gibt. */
const NUR_STYLEGUIDE: [RegExp, string] = [
  // `-container` klammert aus, was ohnehin schon als Container-Rolle gemeldet
  // wird — sonst trüge dieselbe Zeile zwei Begründungen.
  /\b(bg|text|border)-secondary(?!-container)\b/,
  "Secondary wird nirgends angewendet — ausser im Styleguide als Beleg",
];

/** Alle Quelldateien unter `wurzel`, die der Altlasten-Wächter durchsieht. */
function quelldateien(wurzel: string): string[] {
  const gefunden: string[] = [];
  const lauf = (ordner: string) => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) continue;
      const pfad = join(ordner, eintrag.name);
      if (eintrag.isDirectory()) lauf(pfad);
      else if (/\.(tsx?|css)$/.test(eintrag.name)) gefunden.push(pfad);
    }
  };
  lauf(wurzel);
  return gefunden;
}

const DATEIEN = ["app", "components", "lib"].flatMap((ordner) =>
  quelldateien(join(WEB, ordner)),
);

pruefe(`Keine Altlast der alten Palette (${DATEIEN.length} Dateien)`, () => {
  const treffer: string[] = [];
  for (const pfad of DATEIEN) {
    const kurz = relative(WEB, pfad);
    const zeilen = readFileSync(pfad, "utf8").split("\n");
    zeilen.forEach((zeile, i) => {
      for (const [muster, grund] of VERBOTEN) {
        if (muster.test(zeile)) treffer.push(`${kurz}:${i + 1}  ${grund}  — ${zeile.trim()}`);
      }
      if (!kurz.startsWith("app/styleguide/") && NUR_STYLEGUIDE[0].test(zeile)) {
        treffer.push(`${kurz}:${i + 1}  ${NUR_STYLEGUIDE[1]}  — ${zeile.trim()}`);
      }
    });
  }
  assert.deepEqual(treffer, [], `${treffer.length} Altlasten:\n${treffer.join("\n")}`);
});

// ── Messwerte ──────────────────────────────────────────────────────────────
// Nicht geprüft, sondern berichtet: die Zahlen, die im Styleguide stehen.
console.log("\nMesswerte (Kontrast nach WCAG 2.1):");
for (const stufe of ELEV) {
  const name = elevName(stufe.dp);
  console.log(
    `  ${name}  ${stufe.hex}  ` +
      `weiss ${z(kontrast("#ffffff", stufe.hex))}  ` +
      `mittel ${z(kontrast(ueberlagern("#ffffff", SCHRIFT.mittel, stufe.hex), stufe.hex))}  ` +
      `tief ${z(kontrast(ueberlagern("#ffffff", SCHRIFT.tief, stufe.hex), stufe.hex))}  ` +
      `primary ${z(kontrast(PRIMARY, stufe.hex))}  ` +
      `error ${z(kontrast(ERROR, stufe.hex))}`,
  );
}
console.log(
  "  Alterskategorien (elev-00 / elev-01 / RGB-Abstand zu primary / zu error):",
);
for (const [schluessel, hex] of Object.entries(KAT)) {
  console.log(
    `    kat-${schluessel}  ${hex}  ` +
      `${z(kontrast(hex, elev(0)))}  ${z(kontrast(hex, elev(1)))}  ` +
      `Abstand ${z(rgbAbstand(hex, PRIMARY))}  ${z(rgbAbstand(hex, ERROR))}`,
  );
}
console.log(
  `  Druck auf Papier: primary ${z(kontrast(DRUCK.primary, "#ffffff"))}  ` +
    `error ${z(kontrast(DRUCK.error, "#ffffff"))}  ` +
    `mittel ${z(kontrast(DRUCK["on-surface-mittel"], "#ffffff"))}  ` +
    `tief ${z(kontrast(DRUCK["on-surface-tief"], "#ffffff"))}`,
);
console.log(
  `  Druckschrift auf Fläche: kat-a ${z(kontrast(DRUCK_SCHRIFT, DRUCK["kat-a"]))}  ` +
    `kat-f ${z(kontrast(DRUCK_SCHRIFT, DRUCK["kat-f"]))}`,
);
console.log(`  Hex8-Proben: mittel ${hex8("#ffffff", SCHRIFT.mittel)}  tief ${hex8("#ffffff", SCHRIFT.tief)}`);

console.log(
  `\n${gelaufen} Prüfungen bestanden` +
    (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
