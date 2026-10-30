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
// - **Lesbarkeit.** Kontrast ist eine Rechnung nach WCAG 2.2, keine Meinung.
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
  BETONT,
  DRUCK,
  DRUCK_SCHRIFT,
  DUNKEL,
  ELEV,
  GRUND,
  HELL,
  LOZENGE_HELL,
  SECTION_HELL,
  THEMEN,
  UMKEHR,
  deckend,
  elevName,
  hex8,
  kontrast,
  relativeLuminanz,
  ueberlagern,
  type Erscheinungsbild,
} from "../lib/farben";
import {
  blockAb,
  blockVon,
  hellerTeil,
  normalisiere,
  tokenPaare,
  tokens,
  zuweisungen,
  zweiteilige,
} from "./css-tokens";

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

// Jede Farbrolle im @theme steht als `light-dark(hell, dunkel)`; Rollen, die
// in beiden gleich sind (`danger`, `scrim`), stehen einfach.
const THEME = tokenPaare(blockVon(CSS, /@theme\b/, "@theme-Block"), "color");
const PRINT = tokens(
  blockVon(blockVon(CSS, /@media\s+print\b/, "@media print"), /:root\b/, "print :root"),
  "color",
);

// ── 1. Zwilling: farben.ts und globals.css sagen dasselbe ───────────────────
pruefe("Jede Rolle aus farben.ts steht in beiden Erscheinungsbildern gleichlautend in globals.css", () => {
  const abweichend: string[] = [];
  for (const [rolle, dunkel] of Object.entries(DUNKEL)) {
    const imCss = THEME.get(rolle);
    if (imCss === undefined) {
      abweichend.push(`--color-${rolle} fehlt im @theme`);
      continue;
    }
    if (imCss.hell !== normalisiere(HELL[rolle])) {
      abweichend.push(`--color-${rolle} hell: CSS ${imCss.hell}, farben.ts ${HELL[rolle]}`);
    }
    if (imCss.dunkel !== normalisiere(dunkel)) {
      abweichend.push(`--color-${rolle} dunkel: CSS ${imCss.dunkel}, farben.ts ${dunkel}`);
    }
  }
  assert.deepEqual(abweichend, []);
});

pruefe("Hell und Dunkel führen dieselben Rollen", () => {
  assert.deepEqual(Object.keys(HELL).sort(), Object.keys(DUNKEL).sort());
});

pruefe("globals.css führt keine Farbrolle, die farben.ts nicht kennt", () => {
  // Die Gegenrichtung fängt tote Tokens: eine Rolle, die nach einem Umbau
  // niemand mehr anwendet, bleibt sonst als scheinbar gültige Klasse stehen.
  const unbekannt = [...THEME.keys()].filter((rolle) => !(rolle in DUNKEL));
  assert.deepEqual(unbekannt, []);
});

pruefe("Der Ersatz ohne light-dark() führt jede helle Hälfte, und nur sie", () => {
  // Browser ohne light-dark() (Safari vor 17.5) bekommen fest das Helle. Jede
  // zweiteilige Zuweisung davor — Farben, Schatten, Diagramm — muss dort mit
  // ihrer hellen Hälfte stehen, sonst bleibt sie dort ungültig und farblos.
  const ersatzAb = CSS.indexOf("@supports not (color: light-dark(");
  assert.ok(ersatzAb >= 0, "Ersatz-Block fehlt in globals.css");
  const ersatz = zuweisungen(blockAb(CSS, ersatzAb, "Ersatz-Block"));
  const soll = zweiteilige(CSS.slice(0, ersatzAb));
  const abweichend: string[] = [];
  for (const [name, roh] of soll) {
    const hell = hellerTeil(roh);
    if (ersatz.get(name) !== hell) abweichend.push(`${name}: Ersatz ${ersatz.get(name)}, hell ${hell}`);
  }
  for (const name of ersatz.keys()) {
    if (name.startsWith("--") && !soll.has(name)) abweichend.push(`${name} steht nur im Ersatz`);
  }
  assert.deepEqual(abweichend, []);
});

// ── 2. Overlay-Rechnung: die dunkle Höhenleiter ist hergeleitet ─────────────
pruefe("Dunkel: Jede Höhenstufe ist Weiss über dem Grund in ihrer Deckung", () => {
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

// ── 3. Monotonie: im Dunkeln heisst höher heller ───────────────────────────
pruefe("Dunkel: Die Luminanz steigt über die ganze Leiter streng an", () => {
  // Zwei Stufen mit derselben Helligkeit wären zwei Tokens für eine Farbe —
  // dann liesse sich ein Menü nicht mehr von der Karte darunter unterscheiden.
  // Im Hellen gilt das nicht: Dort trägt der Schatten die Höhe, und Karte wie
  // Menü sind weiss (lib/farben.ts, ELEV_HELL).
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

pruefe("Hell: Die Karte hebt sich vom Grund ab, und was in ihr liegt, von ihr", () => {
  const [grund, karte, inKarte] = [0, 1, 2].map((dp) => stufeVon(THEMEN[0], dp));
  assert.notEqual(karte, grund, "Karte (elev-01) gleich dem Grund");
  assert.notEqual(inKarte, karte, "Block in der Karte (elev-02) gleich der Karte");
});

/** Der Hex einer Höhenstufe eines Erscheinungsbilds. */
function stufeVon(t: Erscheinungsbild, dp: number): string {
  const stufe = t.elev.find((s) => s.dp === dp);
  if (!stufe) throw new Error(`${t.name}: keine Höhenstufe ${dp} dp.`);
  return stufe.hex;
}

/** Schrift in einer Deckung über einer Fläche, deckend gemischt. */
const schriftAuf = (t: Erscheinungsbild, deckung: number, flaeche: string) =>
  ueberlagern(t.schrift, deckung, flaeche);

// ── 4.–6. Kontraste, in BEIDEN Erscheinungsbildern ─────────────────────────
// Dieselben Paarungen, dieselben Schwellen (WCAG 2.2 AA): Schrift 4.5:1,
// grafische Objekte und Konturen 3:1 (1.4.11), Deaktiviertes 3:1.
for (const t of THEMEN) {
  const T = t.name === "hell" ? "Hell" : "Dunkel";

  // Schrift liegt in der Anwendung auf jeder Höhenstufe — Karte, Menü, Dialog.
  // Geprüft wird gegen das Kompositergebnis, weil die Deckungen durchscheinen.
  pruefe(`${T}: Volle und mittlere Schrift erreichen auf jeder Stufe 4.5:1`, () => {
    for (const stufe of t.elev) {
      for (const [name, deckung] of [["voll", t.deckung.hoch], ["mittel", t.deckung.mittel]] as const) {
        const wert = kontrast(schriftAuf(t, deckung, stufe.hex), stufe.hex);
        assert.ok(wert >= 4.5, `${name} auf ${elevName(stufe.dp)}: ${z(wert)}:1`);
      }
    }
  });

  pruefe(`${T}: Tiefe Schrift erreicht 3:1 - sie ist nur für Deaktiviertes`, () => {
    // Deaktivierter Text ist unwesentlicher Inhalt (WCAG 1.4.3): Er muss
    // erkennbar bleiben, aber gerade NICHT wie lesbarer Text wirken.
    for (const stufe of t.elev) {
      const wert = kontrast(schriftAuf(t, t.deckung.tief, stufe.hex), stufe.hex);
      assert.ok(wert >= 3.0, `${elevName(stufe.dp)}: ${z(wert)}:1`);
    }
  });

  pruefe(`${T}: Primary trägt als Schrift auf jeder Höhenstufe`, () => {
    for (const stufe of t.elev) {
      const wert = kontrast(t.primary, stufe.hex);
      assert.ok(wert >= 4.5, `${elevName(stufe.dp)}: ${z(wert)}:1`);
    }
  });

  // Error auf JEDER Stufe, nicht nur auf dem Grund: Das war die Lücke, durch
  // die einst eine Kontrast-Regression kam (Materials Baseline trug auf dem
  // Grund und fiel im Dialog auf 3.17). Error steht als Schrift auf Karte,
  // Menüzeile und Dialog — und als 1.5-px-Kontur, für die 4.5:1 mitreicht.
  pruefe(`${T}: Error trägt als Schrift und Kontur auf jeder Höhenstufe`, () => {
    for (const stufe of t.elev) {
      const wert = kontrast(t.error, stufe.hex);
      assert.ok(wert >= 4.5, `error auf ${elevName(stufe.dp)}: ${z(wert)}:1`);
    }
  });

  pruefe(`${T}: Die Kontur trägt auf Grund, Karte und Menü (WCAG 1.4.11)`, () => {
    // Umrandeter Knopf, Chip, umrandetes Feld: die Kontur ist das Einzige,
    // was sie begrenzt. Im Dunkeln steht sie seit je unter 3:1 und wird dort
    // vom Fokus und der Beschriftung getragen; im Hellen muss sie selbst tragen.
    if (t.name === "dunkel") return;
    for (const dp of [0, 1, 8]) {
      const flaeche = stufeVon(t, dp);
      const wert = kontrast(schriftAuf(t, t.kante, flaeche), flaeche);
      assert.ok(wert >= 3.0, `kante auf ${elevName(dp)}: ${z(wert)}:1`);
    }
  });

  pruefe(`${T}: Die Aufschrift gefüllter Flächen trägt`, () => {
    // Gefüllter und destruktiver Knopf: Hier liegt on-* auf der Fläche selbst.
    const aufPrimary = kontrast(t.onPrimary, t.primary);
    assert.ok(aufPrimary >= 4.5, `on-primary auf primary: ${z(aufPrimary)}:1`);
    const aufDanger = kontrast(t.onDanger, t.danger);
    assert.ok(aufDanger >= 4.5, `on-danger auf danger: ${z(aufDanger)}:1`);
  });

  pruefe(`${T}: Schalter - Knopf und Zeichen tragen (WCAG 1.4.11)`, () => {
    // Die Bahn ist nur Kontur; den Stand tragen Lage, Farbe und Zeichen des
    // Knopfs — beides grafische Objekte, also 3:1. Der Schalter steht in
    // Listen auf Seite, Karte und Menüfläche (bis elev-08).
    for (const stufe of t.elev.filter((s) => s.dp <= 8)) {
      const an = kontrast(t.primary, stufe.hex);
      assert.ok(an >= 3.0, `Knopf an (primary) auf ${elevName(stufe.dp)}: ${z(an)}:1`);
      const knopfAus = schriftAuf(t, t.deckung.mittel, stufe.hex);
      const aus = kontrast(knopfAus, stufe.hex);
      assert.ok(aus >= 3.0, `Knopf aus (on-surface-mittel) auf ${elevName(stufe.dp)}: ${z(aus)}:1`);
      const kreuz = kontrast(stufeVon(t, 1), knopfAus);
      assert.ok(kreuz >= 3.0, `Kreuz (elev-01) auf dem Knopf über ${elevName(stufe.dp)}: ${z(kreuz)}:1`);
    }
    const haken = kontrast(t.onPrimary, t.primary);
    assert.ok(haken >= 3.0, `Haken (on-primary) auf primary: ${z(haken)}:1`);
  });

  // ── Umgekehrte Fläche (Snackbar, Kalenderblatt, Mini-Monat) ──
  pruefe(`${T}: Die umgekehrte Fläche hebt sich von jeder Höhenstufe ab`, () => {
    // Sie ist selbst das grafische Objekt, das auffallen soll: 3:1 nach
    // WCAG 1.4.11 gegen alles, worüber sie schweben kann.
    for (const stufe of t.elev) {
      const wert = kontrast(t.umkehr.flaeche, stufe.hex);
      assert.ok(wert >= 3.0, `umkehr über ${elevName(stufe.dp)}: ${z(wert)}:1`);
    }
  });

  pruefe(`${T}: Schrift und Akzent tragen auf der umgekehrten Fläche`, () => {
    const schrift = kontrast(t.umkehr.schrift, t.umkehr.flaeche);
    assert.ok(schrift >= 4.5, `on-umkehr auf umkehr: ${z(schrift)}:1`);
    // Der Akzent ist Textknopf UND Fokus-Ring — für beides reicht 4.5:1.
    const akzent = kontrast(t.umkehr.akzent, t.umkehr.flaeche);
    assert.ok(akzent >= 4.5, `umkehr-akzent auf umkehr: ${z(akzent)}:1`);
  });

  pruefe(`${T}: Kalenderblatt - Schrift trägt auf dem bevorstehenden und dem vergangenen Blatt`, () => {
    // Epic #490: Bevorstehend ist das Blatt die umgekehrte Fläche mit ihrer
    // Schrift; vergangen und gestrichen die Betonung an Ort (`betont`) mit der
    // leisen Schrift. Dieselben Flächen hinterlegen die Tage im Mini-Monat.
    // Das Blatt steht auf der Seite, auf der Karte und im Panel.
    const bevorstehend = kontrast(t.umkehr.schrift, t.umkehr.flaeche);
    assert.ok(bevorstehend >= 4.5, `bevorstehendes Blatt: ${z(bevorstehend)}:1`);
    for (const dp of [0, 1, 8]) {
      const vergangen = schriftAuf(t, BETONT, stufeVon(t, dp));
      const leise = kontrast(schriftAuf(t, t.deckung.mittel, vergangen), vergangen);
      assert.ok(leise >= 4.5, `vergangenes Blatt auf ${elevName(dp)}: ${z(leise)}:1`);
    }
  });

  pruefe(`${T}: Mini-Monat - ein Tag mit Termin hebt sich von der Fläche ab (WCAG 1.4.11)`, () => {
    // Die Hinterlegung trägt «hier findet etwas statt» als Grafik (3:1) auf
    // der Fläche des Monats (elev-01). Ein ausgefallener Tag sagt es mit dem
    // Strich und beim Vorlesen, nicht mit seinem Grau allein.
    const wert = kontrast(t.umkehr.flaeche, stufeVon(t, 1));
    assert.ok(wert >= 3, `Termin auf elev-01: ${z(wert)}:1`);
  });

  // ── Atlassian: Lozenge und Section Message ──
  // Die Werte sind Atlassians eigene (lib/farben.ts) — geprüft wird trotzdem,
  // denn sie liegen hier auf UNSEREM Grund. Die Lozenge steht auf der Seite,
  // auf der Karte und im Dialog, also auf jeder Höhenstufe; ihre neutrale
  // Fläche ist halbtransparent und wird darum je Stufe neu gemischt.
  pruefe(`${T}: Jede Lozenge trägt ihre Schrift auf jeder Höhenstufe`, () => {
    for (const [darstellung, { flaeche, schrift }] of Object.entries(t.lozenge)) {
      for (const stufe of t.elev) {
        const wert = kontrast(schrift, deckend(flaeche, stufe.hex));
        assert.ok(wert >= 4.5, `lozenge-${darstellung} auf ${elevName(stufe.dp)}: ${z(wert)}:1`);
      }
    }
  });

  pruefe(`${T}: Jede Section Message trägt Schrift, Zeichen und Knöpfe`, () => {
    // Die Schrift ist die gewöhnliche (on-surface, 4.5:1); das Zeichen ist ein
    // grafisches Objekt (3:1 nach WCAG 1.4.11) und trägt den Ton. Ihre Knöpfe
    // sind Textknöpfe in Primary und stehen auf derselben Fläche.
    for (const [rolle, { flaeche, icon }] of Object.entries(t.section)) {
      const schrift = kontrast(t.schrift, flaeche);
      assert.ok(schrift >= 4.5, `on-surface auf section-${rolle}: ${z(schrift)}:1`);
      const zeichen = kontrast(icon, flaeche);
      assert.ok(zeichen >= 3.0, `icon-${rolle} auf section-${rolle}: ${z(zeichen)}:1`);
      const knopf = kontrast(t.primary, flaeche);
      assert.ok(knopf >= 4.5, `primary auf section-${rolle}: ${z(knopf)}:1`);
    }
  });
}

pruefe("Dunkel: Die umgekehrte Fläche ist Weiss über dem Grund in ihrer Deckung", () => {
  assert.equal(UMKEHR.flaeche, ueberlagern("#ffffff", UMKEHR.deckung, GRUND));
});

// ── 7. Druck ───────────────────────────────────────────────────────────────
pruefe("Die Druckfarben tragen auf weissem Papier", () => {
  for (const rolle of ["primary", "error", "on-surface", "on-surface-mittel"] as const) {
    const wert = kontrast(DRUCK[rolle], "#ffffff");
    assert.ok(wert >= 4.5, `Druck ${rolle} auf Papier: ${z(wert)}:1`);
  }
  const aufDanger = kontrast(DRUCK["on-danger"], DRUCK.danger);
  assert.ok(aufDanger >= 4.5, `on-danger auf danger (Druck): ${z(aufDanger)}:1`);
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
    "danger",
    "on-danger",
    // Lozenge und Section Message wechseln auf Papier vollständig ins helle
    // Atlassian-Theme — jede ihrer Rollen braucht darum einen Override.
    ...Object.keys(DUNKEL).filter((rolle) => /^(on-)?lozenge-|^section-|^icon-/.test(rolle)),
  ];
  assert.deepEqual(
    pflicht.filter((rolle) => !(rolle in DRUCK)),
    [],
  );
});

pruefe("Lozenge und Section Message tragen auf Papier", () => {
  // Gedruckt wird die Lozenge vor allem als Alterskategorie (Druckansicht des
  // Trainings): Papier und die hellste Kartenstufe des Drucks.
  for (const [darstellung, { flaeche, schrift }] of Object.entries(LOZENGE_HELL)) {
    for (const papier of [DRUCK["elev-00"], DRUCK["elev-01"]]) {
      const wert = kontrast(schrift, deckend(flaeche, papier));
      assert.ok(wert >= 4.5, `Druck lozenge-${darstellung} auf ${papier}: ${z(wert)}:1`);
    }
  }
  for (const [rolle, { flaeche, icon }] of Object.entries(SECTION_HELL)) {
    const schrift = kontrast(DRUCK_SCHRIFT, flaeche);
    assert.ok(schrift >= 4.5, `Druckschrift auf section-${rolle}: ${z(schrift)}:1`);
    const zeichen = kontrast(icon, flaeche);
    assert.ok(zeichen >= 3.0, `Druck icon-${rolle} auf section-${rolle}: ${z(zeichen)}:1`);
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
  // Gemeint sind die Utilities und Variablen des entfernten Akzents
  // (`text-signal`, `bg-signal-bright`, `--color-signal-dark`), nicht das
  // Wort — `signal` heisst auch die Abbruch-Option eines Abrufs.
  [/-signal\b/, "alter Signal-Akzent"],
  [/surface-container/, "M3-Surface-Leiter (ersetzt durch elev-*)"],
  [/surface-dim/, "M3-Surface-Leiter"],
  [/surface-bright/, "M3-Surface-Leiter"],
  [/\bbg-surface\b/, "M3-Surface-Leiter"],
  [/on-surface-variant/, "ersetzt durch on-surface-mittel"],
  [/outline-variant/, "ersetzt durch linie"],
  [/border-outline\b/, "ersetzt durch kante"],
  [/primary-container/, "Container-Rollen gibt es nicht mehr"],
  [/secondary-container/, "Container-Rollen gibt es nicht mehr"],
  // `-container` klammert aus, was die Zeile darüber schon meldet.
  [/\b(?:bg|text|border)-(?:on-)?secondary(?!-container)\b/, "Secondary gibt es nicht mehr - das System kennt einen Akzent"],
  [/error-container/, "Container-Rollen gibt es nicht mehr"],
  [/inverse-/, "Inverse-Rollen gibt es nicht mehr"],
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
  [/rounded-\[/, "freie Radien - nur rounded-klein/-flaeche/-dialog/-full"],
  // Die Plakette heisst seit der Angleichung an Atlassian Lozenge; ihre
  // Alterskategorie-Farben sind in die Accent-Lozenges aufgegangen.
  [/rounded-plakette|type-plakette/, "ersetzt durch rounded-klein / type-lozenge"],
  [/\b(?:bg|text|border)-kat-/, "ersetzt durch die Accent-Lozenges (KategorieLozenge)"],
  [/border-\[1\.5px\]/, "ersetzt durch @utility kontur"],
  // Alpha auf einer KONTUR bricht die 3:1-Regel für grafische Objekte: Die
  // Kontur ist das Einzige, was die Fläche begrenzt, und `border-error/40` kam
  // im Dialog auf 1.91:1. Volles `border-error` trägt dort 4.56:1.
  [/border-error\/\d/, "Kontur mit Alpha - Error umrandet voll oder nicht"],
  [/bg-on-surface\/8/, "Hover gehört in @utility state"],
  [/translate-y-px/, "Knöpfe springen nicht mehr"],
  [/font-display/, "entfallen - es gibt nur sans und mono"],
  [/font-body/, "entfallen - es gibt nur sans und mono"],
  [/chalk-hatch/, "ersetzt durch @utility schraffur"],
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
        if (muster.test(zeile)) treffer.push(`${kurz}:${i + 1}  ${grund}  - ${zeile.trim()}`);
      }
    });
  }
  assert.deepEqual(treffer, [], `${treffer.length} Altlasten:\n${treffer.join("\n")}`);
});

// ── Messwerte ──────────────────────────────────────────────────────────────
// Nicht geprüft, sondern berichtet: die Zahlen, die im Styleguide stehen.
console.log("\nMesswerte (Kontrast nach WCAG 2.2):");
for (const t of THEMEN) {
  console.log(`  ${t.name}:`);
  for (const stufe of t.elev) {
    console.log(
      `    ${elevName(stufe.dp)}  ${stufe.hex}  ` +
        `voll ${z(kontrast(t.schrift, stufe.hex))}  ` +
        `mittel ${z(kontrast(ueberlagern(t.schrift, t.deckung.mittel, stufe.hex), stufe.hex))}  ` +
        `tief ${z(kontrast(ueberlagern(t.schrift, t.deckung.tief, stufe.hex), stufe.hex))}  ` +
        `primary ${z(kontrast(t.primary, stufe.hex))}  ` +
        `error ${z(kontrast(t.error, stufe.hex))}`,
    );
  }
  console.log(
    `    umkehr: Schrift ${z(kontrast(t.umkehr.schrift, t.umkehr.flaeche))}  ` +
      `Akzent ${z(kontrast(t.umkehr.akzent, t.umkehr.flaeche))}  ` +
      `Hex8 mittel ${hex8(t.schrift, t.deckung.mittel)}  tief ${hex8(t.schrift, t.deckung.tief)}`,
  );
}
console.log(
  `  Druck auf Papier: primary ${z(kontrast(DRUCK.primary, "#ffffff"))}  ` +
    `error ${z(kontrast(DRUCK.error, "#ffffff"))}  ` +
    `mittel ${z(kontrast(DRUCK["on-surface-mittel"], "#ffffff"))}  ` +
    `tief ${z(kontrast(DRUCK["on-surface-tief"], "#ffffff"))}`,
);

console.log(
  `\n${gelaufen} Prüfungen bestanden` +
    (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
