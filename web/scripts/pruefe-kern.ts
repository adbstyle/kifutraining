// Prüft die reinen Teile des Fachkerns (Epic #190, ab Story #192): die
// Zielblock-Regel in web/lib/altersstufe.ts, die Übersetzung von
// Datenbankfehlern (web/lib/training-bedingungen.ts, web/lib/kern/ergebnis.ts)
// und zwei statische Wächter über web/lib/kern und den Werkzeugsatz. Ohne DB
// und ohne Netz; läuft im PR-Check nach `check:ki-zugang`.
//
// Der Wert dieser Prüfung liegt an vier Stellen:
//
// - «Hauptteil ohne Kategorie» ist über die Oberfläche nicht auslösbar, über
//   den KI-Client aber der Normalfall eines Fehlversuchs (Spike #191). Die
//   Meldung muss genau diesen Mangel und die zulässigen Werte nennen
//   (#192 NFR 4) — wer die Reihenfolge der Prüfungen in `zielblock`
//   vertauscht, meldet wieder «gehört nicht zum Trainingsschema».
// - `fachlicheMeldung` trennt eine verletzte Regel (`art: "regel"`) von einem
//   unerwarteten Fehler (`art: "technisch"`); `fehlerMeldung` muss dabei
//   wortgleich bleiben, sonst ändern sich Texte der Oberfläche.
// - Der Kern darf nie `"use server"` tragen: Jede Kern-Funktion nimmt die
//   userId als Parameter — als Server Action wäre sie ein öffentlicher
//   Endpunkt, bei dem der Aufrufer sie selbst angibt. Und er hängt an keinem
//   Adapter: nichts aus `next/`, `@/lib/mcp/`, `@/lib/actions/` oder dem
//   Cookie-Client — auch nicht über eine Datei, die er importiert. Redirect,
//   Cookies und Revalidieren sind Sache der Adapter.
// - Jedes Werkzeug im Werkzeugsatz hat einen eindeutigen snake_case-Namen, und
//   kein Werkzeug liegt unregistriert herum.
//
//   npx tsx scripts/pruefe-kern.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hauptteilkategorieSlugs } from "../lib/vocab";
import { einordnungsSlugsFuer, zielblock, type Altersstufe } from "../lib/altersstufe";
import { fachlicheMeldung, fehlerMeldung } from "../lib/training-bedingungen";
import { FREMDES_TRAINING, MELDUNG_WIEDERHOLEN, NICHT_GEFUNDEN, ausDbFehler } from "../lib/kern/ergebnis";
import { KEINE_PASSENDE_UEBUNG, leerBestandText, zielLabel } from "../lib/training";

let gelaufen = 0;

function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

/** `fehlerMeldung` protokolliert Unerwartetes — hier ist es erwartet. */
function still<T>(fn: () => T): T {
  const orig = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = orig;
  }
}

const problem = (stufe: Altersstufe, einordnung: string, hkat?: string | null) => {
  const z = zielblock(stufe, einordnung, hkat);
  return z.ok ? null : z.problem;
};

// ── zielblock (#192 NFR 4, AK 9) ────────────────────────────────────────────
pruefe("Kinderfussball-Hauptteil ohne Kategorie: Pflichttext mit den drei Werten", () => {
  const erwartet = {
    feld: "hauptteilkategorie",
    text:
      "Im Kinderfussball-Hauptteil ist die Hauptteilkategorie Pflicht: " +
      "fussball-spielen-lernen, vielseitigkeit-erleben, fussball-spielen.",
  };
  assert.deepEqual(problem("kinderfussball", "hauptteil"), erwartet);
  assert.deepEqual(problem("kinderfussball", "hauptteil", null), erwartet);
  assert.deepEqual(problem("kinderfussball", "hauptteil", "gibt-es-nicht"), erwartet);
});

pruefe("Eine Hauptteilkategorie ausserhalb des Kinderfussball-Hauptteils wird abgewiesen", () => {
  const erwartet = {
    feld: "hauptteilkategorie",
    text: "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
  };
  assert.deepEqual(problem("juniorenfussball", "jun-spiel", "fussball-spielen"), erwartet);
  assert.deepEqual(problem("kinderfussball", "einleitung", "fussball-spielen"), erwartet);
});

pruefe("Ein stufenfremder Block nennt Schema und zulässige Einordnungen", () => {
  // Wortgleich mit der bisherigen Meldung der Oberfläche; die Liste reist
  // getrennt in `zulaessig`, der MCP-Adapter hängt sie als «Zulässig: …» an.
  assert.deepEqual(problem("kinderfussball", "jun-spiel"), {
    feld: "einordnung",
    text: "Dieser Block gehört nicht zum Trainingsschema Kinderfussball.",
    zulaessig: ["auffangen", "einleitung", "hauptteil", "ausklang"],
  });
  assert.equal(problem("juniorenfussball", "einleitung")?.feld, "einordnung");
});

pruefe("Gültige Zielblöcke liefern einen Filter", () => {
  const faelle: [Altersstufe, string, string | null][] = [
    ...einordnungsSlugsFuer("kinderfussball")
      .filter((e) => e !== "hauptteil")
      .map((e): [Altersstufe, string, null] => ["kinderfussball", e, null]),
    ...hauptteilkategorieSlugs.map((h): [Altersstufe, string, string] => ["kinderfussball", "hauptteil", h]),
    ...einordnungsSlugsFuer("juniorenfussball").map(
      (e): [Altersstufe, string, null] => ["juniorenfussball", e, null],
    ),
  ];
  for (const [stufe, einordnung, hkat] of faelle)
    assert.ok(zielblock(stufe, einordnung, hkat).ok, `${stufe}/${einordnung}/${hkat}`);
  // Die anziehende Erscheinungsform (Story #134) kommt mit.
  const z = zielblock("juniorenfussball", "jun-explosivitaet");
  assert.ok(z.ok && z.filter.erscheinungsformen?.includes("explosiv-dynamisch-agieren"));
  const h = zielblock("kinderfussball", "hauptteil", "fussball-spielen");
  assert.ok(h.ok && h.filter.hauptteilkategorie === "fussball-spielen");
});

// ── Übersetzung von Datenbankfehlern ────────────────────────────────────────
// Die Klartexte sind eingefroren: Ändert sich einer, ändert sich ein Text der
// Oberfläche — das soll eine bewusste Entscheidung sein, kein Nebeneffekt.
pruefe("fachlicheMeldung erklärt Marker, fehlerMeldung bleibt wortgleich", () => {
  const beispiele: [string, string][] = [
    ['new row for relation "trainings" violates … STUFE_FEHLT', "Bitte mindestens eine Alterskategorie wählen."],
    ["GRUPPE_NUR_HAUPTTEIL: …", "Gruppen lassen sich nur im Hauptteil verteilen."],
    ["VARIANTE_FREMDES_TRAINING: Variante x gehoert nicht zu Training y", "Diese Variante gehört zu einem anderen Training."],
    [
      "TRAINING_UNVOLLSTAENDIG: einleitung",
      "Ein öffentliches Training braucht mindestens eine Übung in der Einleitung. " +
        "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
    ],
  ];
  for (const [roh, klartext] of beispiele) {
    assert.equal(fachlicheMeldung(roh), klartext, roh);
    assert.equal(fehlerMeldung(roh), klartext, roh);
  }
  assert.equal(fachlicheMeldung("irgendein Postgres-Fehler"), null);
  assert.equal(
    still(() => fehlerMeldung("irgendein Postgres-Fehler")),
    "Das liess sich nicht speichern. Bitte versuche es noch einmal.",
  );
  assert.equal(fachlicheMeldung("new row violates row-level security policy"), null);
  assert.equal(
    still(() => fehlerMeldung("new row violates row-level security policy")),
    "Keine Berechtigung für diese Änderung.",
  );
});

pruefe("ausDbFehler ordnet ein: bedingung, regel, keine_rechte, technisch", () => {
  const b = ausDbFehler({ message: "TRAINING_UNVOLLSTAENDIG: freies_spiel VARIANTE 1234" });
  assert.equal(b.art, "bedingung");
  assert.equal(b.bedingung, "freies_spiel");
  assert.equal(b.varianteId, "1234");
  assert.equal(
    b.meldung,
    "Ein öffentliches Training braucht in jeder Variante mindestens eine Übung im freien Spiel. " +
      "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
  );
  assert.equal(ausDbFehler({ message: "STUFE_FEHLT" }).art, "regel");
  const rls = still(() => ausDbFehler({ message: "new row violates row-level security policy" }));
  assert.equal(rls.art, "keine_rechte");
  assert.equal(rls.meldung, "Keine Berechtigung für diese Änderung.");
  const t = still(() => ausDbFehler({ message: "connection reset" }));
  assert.equal(t.art, "technisch");
  assert.equal(t.meldung, "Das liess sich nicht speichern. Bitte versuche es noch einmal.");
});

pruefe("Standard-Texte des Kerns sind eingefroren", () => {
  assert.equal(NICHT_GEFUNDEN.training, "Training nicht gefunden.");
  assert.equal(NICHT_GEFUNDEN.vorlage, "Übung nicht verfügbar.");
  assert.equal(
    FREMDES_TRAINING,
    "Dieses Training gehört jemand anderem. Du kannst es ansehen und übernehmen, aber nicht ändern.",
  );
  assert.ok(MELDUNG_WIEDERHOLEN.includes("noch einmal zu versuchen"), "Wiederholen muss genannt sein (#192 NFR 5)");
});

pruefe("Leer-Texte und Ziel des Pickers sind wortgleich mit dem früheren JSX", () => {
  assert.equal(KEINE_PASSENDE_UEBUNG, "Keine passende Übung gefunden.");
  assert.equal(zielLabel("einleitung"), "Einleitung");
  assert.equal(zielLabel("jun-explosivitaet"), "Explosivität");
  assert.equal(zielLabel("hauptteil", "fussball-spielen"), "Hauptteil · Fussball spielen");
  assert.equal(
    `${leerBestandText(zielLabel("hauptteil", "fussball-spielen"), "kinderfussball")} Erfasse zuerst eine.`,
    "Für „Hauptteil · Fussball spielen\" gibt es in deinem sichtbaren Bestand noch keine " +
      "Übung der Altersstufe Kinderfussball. Erfasse zuerst eine.",
  );
});

// ── Statische Wächter ───────────────────────────────────────────────────────
const web = resolve(fileURLToPath(import.meta.url), "../..");
const kern = join(web, "lib/kern");

/** Kern-Dateien ohne Datenbankzugriff: Sie bleiben ohne `server-only`, damit
 *  Prüfskripte wie dieses sie mit tsx laden können (`server-only` wirft
 *  ausserhalb der react-server-Bedingung). */
const REIN = new Set(["ergebnis.ts"]);

/** Was der Kern nicht importieren darf — direkt nicht und über eine
 *  importierte `@/lib/*`-Datei auch nicht. */
const VERBOTEN = [/^next\//, /^@\/lib\/mcp\//, /^@\/lib\/actions\//, /^@\/lib\/supabase\/server$/];
/** Was eine vom Kern importierte Datei nicht mitziehen darf: den Cookie-Client. */
const VERBOTEN_TRANSITIV = [/^next\/headers$/, /^@\/lib\/supabase\/server$/];

const importeVon = (text: string) =>
  [...text.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+["']([^"']+)["']/gm)]
    .filter((m) => !/^\s*import\s+type\b/.test(m[0]))
    .map((m) => m[1]);

function libDatei(spez: string): string | null {
  const basis = join(web, spez.replace(/^@\//, ""));
  for (const kandidat of [`${basis}.ts`, `${basis}.tsx`, join(basis, "index.ts")])
    if (existsSync(kandidat)) return kandidat;
  return null;
}

pruefe("lib/kern: kein \"use server\", keine Adapter-Importe (auch eine Ebene tief), server-only nur mit DB", () => {
  const dateien = readdirSync(kern, { recursive: true, encoding: "utf8" }).filter((d) =>
    d.endsWith(".ts"),
  );
  assert.ok(dateien.length >= 4, "lib/kern ist leer?");
  for (const d of dateien) {
    const text = readFileSync(join(kern, d), "utf8");
    assert.ok(!/^\s*["']use server["']/m.test(text), `${d}: "use server" im Kern`);
    const serverOnly = /^import\s+["']server-only["'];/m.test(text);
    if (REIN.has(d)) assert.ok(!serverOnly, `${d} ist rein und darf server-only nicht tragen`);
    else assert.ok(serverOnly, `${d} greift auf die DB zu und braucht import "server-only"`);

    for (const spez of importeVon(text)) {
      for (const v of VERBOTEN) assert.ok(!v.test(spez), `${d} importiert ${spez}`);
      if (!spez.startsWith("@/lib/") || spez.startsWith("@/lib/kern/")) continue;
      const datei = libDatei(spez);
      assert.ok(datei, `${d}: ${spez} nicht gefunden`);
      for (const tief of importeVon(readFileSync(datei, "utf8")))
        for (const v of VERBOTEN_TRANSITIV)
          assert.ok(!v.test(tief), `${d} → ${spez} importiert ${tief}`);
    }
  }
});

// Der Katalog-Wächter liest Quelltext statt die Werte zu importieren: Der
// Werkzeugsatz (lib/mcp/server.ts) und jedes Werkzeug tragen `server-only`,
// und das wirft unter tsx. Die Werte über die react-server-Bedingung zu laden,
// zöge den ganzen Next-Server-Graphen nach — für eine Namensprüfung zu viel.
pruefe("Werkzeugsatz: eindeutige snake_case-Namen, nichts unregistriert", () => {
  const ordner = join(web, "lib/mcp/werkzeuge");
  const nameVon = new Map<string, string>(); // Bezeichner → Werkzeugname
  for (const d of readdirSync(ordner).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(join(ordner, d), "utf8");
    for (const m of text.matchAll(
      /export const (\w+) = werkzeug\(\{\s*name:\s*"([^"]+)"/g,
    )) {
      nameVon.set(m[1], m[2]);
    }
  }
  const server = readFileSync(join(web, "lib/mcp/server.ts"), "utf8");
  const block = /export const WERKZEUGE = \[([\s\S]*?)\] as const/.exec(server)?.[1];
  assert.ok(block, "WERKZEUGE nicht gefunden");
  const registriert = block.split(",").map((s) => s.trim()).filter(Boolean);

  for (const id of registriert) assert.ok(nameVon.has(id), `${id} ist kein werkzeug({...})`);
  for (const id of nameVon.keys())
    assert.ok(registriert.includes(id), `${id} ist definiert, aber nicht in WERKZEUGE`);
  const namen = registriert.map((id) => nameVon.get(id)!);
  assert.equal(new Set(namen).size, namen.length, `doppelte Namen: ${namen.join(", ")}`);
  for (const n of namen) assert.match(n, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `${n} ist nicht snake_case`);
  for (const n of ["training_anlegen", "training_uebungen_fuer_block", "training_uebung_zuordnen"])
    assert.ok(namen.includes(n), `${n} fehlt im Werkzeugsatz (#192)`);
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
