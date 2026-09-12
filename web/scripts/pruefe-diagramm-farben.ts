// Prüft die Farbsätze des Feld-Diagramms: ihre Vollständigkeit, ihre
// Lesbarkeit und dass im Zeichencode kein roher Farbwert mehr steht.
//
// Warum ein eigener Wächter neben `pruefe-farben.ts`:
//
// - **Andere Schwelle.** Die Oberfläche zeigt Schrift, und Schrift will nach
//   WCAG 2.1 ihre 4.5:1. Auf dem Rasen steht kein Text, sondern ein
//   gezeichneter Gegenstand — dafür gilt 1.4.11 mit 3:1. Dieselbe Rechnung,
//   ein anderer Massstab; das gehört nicht in dieselbe Datei.
// - **Andere Quelle.** Die Oberfläche hat einen Zwilling in `lib/farben.ts`,
//   weil ihre Höhenleiter hergeleitet wird. Diagramm-Farben werden gesetzt,
//   nicht gerechnet: ihre Werte stehen ausschliesslich in `app/globals.css`.
//   Geprüft wird hier deshalb nicht die Übereinstimmung zweier Tabellen,
//   sondern dass jede Rolle da ist und trägt.
// - **Eine eigene Altlast.** Der Zeichencode war voller Hex-Literale. Dass
//   keines zurückkommt, ist die Bedingung dafür, dass der angekündigte
//   Light-Modus ein Block mit Werten bleibt und keine Nacharbeit in vier
//   Dateien wird.
//
//   npm run check:diagramm-farben
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { kontrast, rgbAbstand } from "../lib/farben";
import {
  DIAGRAMM_FARBROLLEN,
  DIAGRAMM_MASSROLLEN,
  type DiagrammFarbrolle,
} from "../lib/diagramm-farben";
import { blockVon, tokens } from "./css-tokens";

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

const z = (wert: number) => wert.toFixed(2);

// ── Die Sätze aus globals.css lesen ────────────────────────────────────────
const CSS = readFileSync(join(WEB, "app/globals.css"), "utf8");

/** Der Druck-Satz steht in seiner Media Query; er überschreibt nur, was sich
 *  unterscheidet, alles Übrige erbt aus `:root`. Genau so wird hier gerechnet. */
const DRUCK_BLOCK = blockVon(CSS, /@media\s+print\b/, "@media print");
const DRUCK_ROH = tokens(blockVon(DRUCK_BLOCK, /:root\b/, "print :root"), "diagramm");

/** Der Bildschirm-Satz ist der Diagramm-Block, der NICHT im Druck steht.
 *
 *  Beide passen auf dasselbe Muster (`:root` mit `--diagramm-`), und welcher
 *  zuerst käme, entschiede allein die Reihenfolge in der Datei. Darum wird der
 *  Druckblock zuerst ausgeschnitten und im Rest gesucht: Verschiebt jemand die
 *  Blöcke — etwa wenn der Light-Satz dazukommt —, prüft der Wächter weiterhin
 *  zwei verschiedene Sätze und nicht zweimal denselben. */
const OHNE_DRUCK = CSS.replace(DRUCK_BLOCK, "");
const BILDSCHIRM = tokens(
  blockVon(OHNE_DRUCK, /:root\s*\{[^}]*--diagramm-/, "Diagramm-Block in :root"),
  "diagramm",
);
const DRUCK = new Map([...BILDSCHIRM, ...DRUCK_ROH]);

const SAETZE = [
  { name: "Bildschirm", werte: BILDSCHIRM },
  { name: "Druck", werte: DRUCK },
] as const;

const ALLE_ROLLEN: string[] = [...DIAGRAMM_FARBROLLEN, ...DIAGRAMM_MASSROLLEN];

// ── 1. Vollständigkeit ─────────────────────────────────────────────────────
pruefe("Jede Rolle aus diagramm-farben.ts steht im Bildschirm-Satz", () => {
  const fehlend = ALLE_ROLLEN.filter((rolle) => !BILDSCHIRM.has(rolle));
  assert.deepEqual(fehlend, []);
});

pruefe("globals.css führt keine Diagramm-Rolle, die das Modul nicht kennt", () => {
  // Die Gegenrichtung fängt tote Tokens: eine Rolle, die nach einem Umbau
  // niemand mehr zeichnet, bliebe sonst als scheinbar gültige stehen.
  const unbekannt = [...BILDSCHIRM.keys()].filter((rolle) => !ALLE_ROLLEN.includes(rolle));
  assert.deepEqual(unbekannt, []);
});

pruefe("Der Druck überschreibt nur bekannte Rollen", () => {
  const unbekannt = [...DRUCK_ROH.keys()].filter((rolle) => !ALLE_ROLLEN.includes(rolle));
  assert.deepEqual(unbekannt, []);
});

pruefe("Jedes Mass ist in beiden Sätzen eine Zahl", () => {
  for (const { name, werte } of SAETZE) {
    for (const rolle of DIAGRAMM_MASSROLLEN) {
      const wert = werte.get(rolle);
      assert.ok(wert && /^\d+(\.\d+)?$/.test(wert), `${name}: ${rolle} ist "${wert}"`);
    }
  }
});

pruefe("Eine gefüllte Zone bleibt eine Fläche, kein Nebel", () => {
  // Die Füllung ist ein Hinweis, kein Anstrich — aber unter etwa einem Zehntel
  // Deckung sieht man auf Papier nur noch den Umriss.
  for (const { name, werte } of SAETZE) {
    const deckung = Number(werte.get("form-deckung"));
    assert.ok(deckung >= 0.1 && deckung <= 0.4, `${name}: form-deckung ${deckung}`);
  }
});

// ── 2. Lesbarkeit auf der Spielfläche ──────────────────────────────────────
// Schwelle 3:1 nach WCAG 2.1 §1.4.11 (grafische Objekte) — nicht die 4.5:1 der
// Schrift: auf dem Rasen steht kein Text.

/** Der ungünstigere der beiden Flächenwerte — ein Symbol kann auf dem Grund
 *  oder auf einem Mähstreifen liegen, gelten muss der schlechtere Fall. */
function aufFlaeche(werte: Map<string, string>, rolle: string): number {
  const farbe = werte.get(rolle);
  assert.ok(farbe, `Rolle ${rolle} fehlt`);
  return Math.min(
    kontrast(farbe, werte.get("rasen")!),
    kontrast(farbe, werte.get("rasen-streifen")!),
  );
}

const PALETTE: DiagrammFarbrolle[] = [
  "rot",
  "blau",
  "gelb",
  "gruen",
  "orange",
  "weiss",
  "schwarz",
];

pruefe("Jede wählbare Farbe trägt auf der Spielfläche (3:1)", () => {
  for (const { name, werte } of SAETZE) {
    for (const rolle of PALETTE) {
      const wert = aufFlaeche(werte, rolle);
      assert.ok(wert >= 3, `${name}: ${rolle} auf der Fläche ${z(wert)}:1`);
    }
  }
});

pruefe("Die Bewegungspfeile tragen auf der Spielfläche (3:1)", () => {
  for (const { name, werte } of SAETZE) {
    const wert = aufFlaeche(werte, "bewegung");
    assert.ok(wert >= 3, `${name}: bewegung auf der Fläche ${z(wert)}:1`);
  }
});

pruefe("Tor, Hürde, Minitor-Netz und Torwart-Trikot tragen auf der Fläche (3:1)", () => {
  for (const { name, werte } of SAETZE) {
    for (const rolle of ["geraet", "minitor-netz", "torwart-trikot"] as const) {
      const wert = aufFlaeche(werte, rolle);
      assert.ok(wert >= 3, `${name}: ${rolle} auf der Fläche ${z(wert)}:1`);
    }
  }
});

pruefe("Der Ball wird von seiner Zeichnung getragen, nicht von seiner Fläche (3:1)", () => {
  // Die wichtigste Regel des Druck-Satzes: Der Ballkörper bleibt auf Papier
  // weiss und hat damit gegen das Blatt gar keinen Kontrast — erkennbar ist er
  // allein durch Kontur und Fünfecke. Fällt dieser Abstand, verschwindet er.
  for (const { name, werte } of SAETZE) {
    const wert = kontrast(werte.get("ball-zeichnung")!, werte.get("ball-koerper")!);
    assert.ok(wert >= 3, `${name}: Ball-Zeichnung auf Ball-Körper ${z(wert)}:1`);
  }
});

/** Helles Beiwerk an einer Figur oder an einem Gerät: Stutzen sitzen auf dem
 *  Bein, der Stab trägt ein farbiges Fähnchen. Sie holen ihren Kontrast vom
 *  Gegenstand, auf dem sie liegen, nicht vom Rasen — 3:1 gegen die Fläche wäre
 *  der falsche Massstab und würde sie unnötig dunkel machen. Geprüft wird nur,
 *  dass sie nicht ganz mit der Fläche verschmelzen. */
const BEIWERK: DiagrammFarbrolle[] = ["figur-stutzen", "stange-stab"];

pruefe("Helles Beiwerk verschmilzt nicht mit der Spielfläche (1.5:1)", () => {
  for (const { name, werte } of SAETZE) {
    for (const rolle of BEIWERK) {
      const wert = aufFlaeche(werte, rolle);
      assert.ok(wert >= 1.5, `${name}: ${rolle} auf der Fläche ${z(wert)}:1`);
    }
  }
});

pruefe("Zwei wählbare Farben sind nie verwechselbar", () => {
  // Zwei Mannschaften müssen auf einen Blick auseinandergehen. Schwelle 40 im
  // RGB-Würfel, mit Luft: der engste Abstand liegt heute bei 56 (Bildschirm
  // grün/schwarz, Druck gelb/orange).
  for (const { name, werte } of SAETZE) {
    for (let i = 0; i < PALETTE.length; i++) {
      for (let j = i + 1; j < PALETTE.length; j++) {
        const [a, b] = [PALETTE[i], PALETTE[j]];
        const abstand = rgbAbstand(werte.get(a)!, werte.get(b)!);
        assert.ok(abstand >= 40, `${name}: ${a} und ${b} liegen ${abstand.toFixed(0)} auseinander`);
      }
    }
  }
});

pruefe("Auf Papier begrenzt eine Kante das weisse Feld", () => {
  // Am Bildschirm trägt der Rasen sich selbst; auf Papier ginge das Feld ohne
  // Umriss nahtlos ins Blatt über.
  const kante = DRUCK.get("feldkante");
  assert.ok(kante && kante !== "transparent", `Feldkante im Druck: "${kante}"`);
});

// ── 3. Kein roher Farbwert mehr im Zeichencode ─────────────────────────────
// Die Dateien, die den Inhalt des Diagramms zeichnen. `DiagrammEditor.tsx`
// steht bewusst NICHT dabei: seine Auswahlrahmen und Anfasser sind
// Bedienoberfläche, die über dem Diagramm liegt, kein Teil der Zeichnung —
// sie folgen der Palette der Anwendung.
const ZEICHENDATEIEN = [
  "lib/diagramm.ts",
  "components/diagramm/DiagrammView.tsx",
  "components/diagramm/symbols.tsx",
  "components/diagramm/figur.tsx",
];

/** Farbschreibweisen, die im Zeichencode nichts verloren haben.
 *
 *  Die CSS-Farbnamen stehen mit in der Liste, weil genau einer sich jahrelang
 *  gehalten hat: das Minitor-Netz war schlicht `"white"` und wäre jedem
 *  Hex-Muster entgangen. Geprüft wird dabei die Stelle, an der eine Farbe
 *  gesetzt wird (`fill="white"`, `const X = "white";`) — nicht das blosse
 *  Wort: `orange` ist auch ein gespeicherter Slug unserer Palette, und der
 *  soll `defaultFarbe: "orange"` heissen dürfen. `transparent` fehlt in der
 *  Liste mit Absicht — es ist keine Farbe, sondern ihre Abwesenheit, und in
 *  jedem Satz dasselbe. */
const FARBNAMEN = [
  "white",
  "black",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "grey",
  "gray",
  "silver",
];
const NAMEN = FARBNAMEN.join("|");
const ROHE_FARBE: [RegExp, string][] = [
  [/#[0-9a-f]{3,8}\b/i, "Hex-Literal"],
  [/\brgba?\s*\(/i, "rgb()/rgba()-Literal"],
  // Drei Schreibweisen, weil eine Farbe auf drei Arten gesetzt wird: als
  // JSX-Attribut, als Eigenschaft eines Stil-Objekts (dort auch mitten in
  // einem Ternary, ohne Semikolon am Ende) und als benannte Konstante.
  [new RegExp(`(?:fill|stroke|color)\\s*=\\s*["'\`](?:${NAMEN})["'\`]`, "i"), "CSS-Farbname"],
  [new RegExp(`(?:fill|stroke|color)\\s*:\\s*[^,;\n]*["'\`](?:${NAMEN})["'\`]`, "i"), "CSS-Farbname"],
  [new RegExp(`=\\s*["'\`](?:${NAMEN})["'\`]\\s*;`, "i"), "CSS-Farbname"],
];

/** Die Zeilen einer Datei ohne ihre Kommentare.
 *
 *  Ein Kommentar darf den alten Wert nennen — er erklärt ja gerade, was sich
 *  geändert hat und warum. Verboten ist der Wert im Code. Die Blockform
 *  braucht dafür einen Zustand über die Zeilen hinweg: Dieses Projekt
 *  begründet in mehrzeiligen `/** … *\/`-Blöcken, und eine zeilenweise
 *  Ersetzung hielte deren Fortsetzungszeilen für Code. */
function ohneKommentare(quelle: string): string[] {
  let imBlock = false;
  return quelle.split("\n").map((zeile) => {
    let code = "";
    for (let i = 0; i < zeile.length; i++) {
      if (imBlock) {
        if (zeile.startsWith("*/", i)) {
          imBlock = false;
          i++;
        }
        continue;
      }
      if (zeile.startsWith("//", i)) break;
      if (zeile.startsWith("/*", i)) {
        imBlock = true;
        i++;
        continue;
      }
      code += zeile[i];
    }
    return code;
  });
}

pruefe(`Kein roher Farbwert im Zeichencode (${ZEICHENDATEIEN.length} Dateien)`, () => {
  const treffer: string[] = [];
  for (const kurz of ZEICHENDATEIEN) {
    const zeilen = ohneKommentare(readFileSync(join(WEB, kurz), "utf8"));
    zeilen.forEach((code, i) => {
      for (const [muster, grund] of ROHE_FARBE) {
        if (muster.test(code)) treffer.push(`${kurz}:${i + 1}  ${grund}  — ${code.trim()}`);
      }
    });
  }
  assert.deepEqual(treffer, [], `${treffer.length} rohe Farbwerte:\n${treffer.join("\n")}`);
});

pruefe("Jede Rolle wird auch gezeichnet", () => {
  // Ein Token, das niemand aufruft, ist totes Gewicht — und bei einem dritten
  // Farbsatz dreimal totes Gewicht. `dv("…")` ist die einzige Stelle, die eine
  // Rolle verwendet, also lässt sich das abzählen.
  const quelle = [...ZEICHENDATEIEN, "lib/diagramm-farben.ts"]
    .map((kurz) => readFileSync(join(WEB, kurz), "utf8"))
    .join("\n");
  const benutzt = new Set(
    [...quelle.matchAll(/dv\(\s*"([a-z0-9-]+)"\s*\)/g)].map((treffer) => treffer[1]),
  );
  const ungenutzt = ALLE_ROLLEN.filter((rolle) => !benutzt.has(rolle));
  assert.deepEqual(ungenutzt, []);
});

// ── Messwerte ──────────────────────────────────────────────────────────────
// Nicht geprüft, sondern berichtet — die Zahlen, mit denen entschieden wurde.
console.log("\nMesswerte (Kontrast nach WCAG 2.1, schlechterer Wert von Grund und Streifen):");
for (const { name, werte } of SAETZE) {
  console.log(`  ${name} — Rasen ${werte.get("rasen")} / ${werte.get("rasen-streifen")}`);
  const zeile = (rolle: string) =>
    `    ${rolle.padEnd(16)} ${(werte.get(rolle) ?? "?").padEnd(22)} ${z(aufFlaeche(werte, rolle))}`;
  for (const rolle of [...PALETTE, "bewegung", "geraet", "torwart-trikot", ...BEIWERK]) {
    console.log(zeile(rolle));
  }
  console.log(
    `    ${"ball".padEnd(16)} ${(werte.get("ball-koerper") ?? "?").padEnd(22)} ` +
      `Zeichnung auf Körper ${z(kontrast(werte.get("ball-zeichnung")!, werte.get("ball-koerper")!))}`,
  );
}

console.log(
  `\n${gelaufen} Prüfung${gelaufen === 1 ? "" : "en"} bestanden` +
    (gescheitert ? `, ${gescheitert} gescheitert.` : "."),
);
process.exit(gescheitert ? 1 : 0);
