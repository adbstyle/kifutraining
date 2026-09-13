// Prüft die Lese-Helfer für Such-Parameter (web/lib/such-parameter.ts) und die
// Ehrlichkeit der Seiten-Signaturen. Ohne DB und ohne Netz; läuft im PR-Check
// neben `typecheck`, `check:gruppen`, `check:varianten` und `check:farben`.
//
// Der Wert dieser Prüfung liegt an zwei Stellen:
//
// - **Die Regel bei Mehrfachangabe.** Next fasst wiederholte Parameter nicht
//   zusammen: `?q=a&q=b` kommt als Array an. Was dann gilt, ist genau einmal
//   entschieden — der erste Wert, wie bei `URLSearchParams.get()`, das die
//   Route Handler unter app/auth/ nutzen. Läuft das auseinander, verhält sich
//   dieselbe Adresse in Seite und Route Handler verschieden.
// - **Die Typlüge.** `searchParams: Promise<{ q?: string }>` ist für
//   TypeScript ein völlig unauffälliger Typ — der Compiler meldet nichts,
//   obwohl Next diesen Vertrag nie einhält. Der Fehler zeigt sich erst im
//   Betrieb als HTTP 500. Genau daran hingen drei Abstürze auf Produktion.
//   Nur ein eigener Wächter fängt einen Rückfall.
//
// GRENZE, bewusst und benannt: Der Scanner liest nur Typen, die IM SELBEN
// File direkt hinter `searchParams:` stehen. Wer die Signatur in ein
// ausgelagertes Interface schöbe, liefe an ihm vorbei. Für die heutigen
// Seiten genügt das; es ist eine Konvention, kein stiller blinder Fleck.
//
//   npm run check:such-parameter
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flag, liste, pfad, text, zahl } from "../lib/such-parameter";

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

// ── 1. Die Helfer gegen Mehrfachangabe ─────────────────────────────────────
// Die Eingaben sind nicht erfunden: `?q=a&q=b`, `?stufen=E&stufen=F` und
// `?redirect=/a&redirect=/b` haben auf Produktion je einen 500er ausgelöst.

pruefe("text() nimmt den ersten Wert und trimmt", () => {
  assert.equal(text(["a", "b"]), "a");
  assert.equal(text("  a  "), "a");
  assert.equal(text(""), undefined);
  assert.equal(text("   "), undefined);
  assert.equal(text([]), undefined);
  assert.equal(text(undefined), undefined);
});

pruefe("liste() behandelt Wiederholung und Kommaliste gleich", () => {
  assert.deepEqual(liste(["E", "F"]), ["E", "F"]);
  assert.deepEqual(liste("E,F"), ["E", "F"]);
  assert.deepEqual(liste(["a,b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(liste("a,,b"), ["a", "b"]);
  assert.deepEqual(liste(""), []);
  assert.deepEqual(liste(undefined), []);
});

pruefe("zahl() nimmt den ersten Wert und lässt nur positive Ganzzahlen zu", () => {
  assert.equal(zahl(["21", "28"]), 21);
  assert.equal(zahl("21"), 21);
  assert.equal(zahl("0"), undefined);
  assert.equal(zahl("-3"), undefined);
  assert.equal(zahl("abc"), undefined);
  assert.equal(zahl(undefined), undefined);
});

pruefe("flag() ist wahr bei genau '1' — auch bei Mehrfachangabe", () => {
  assert.equal(flag("1"), true);
  assert.equal(flag(["1", "0"]), true);
  assert.equal(flag(["0", "1"]), false);
  assert.equal(flag("0"), false);
  assert.equal(flag(""), false);
  assert.equal(flag(undefined), false);
});

pruefe("pfad() lässt nur ein Ziel innerhalb der Anwendung zu", () => {
  assert.equal(pfad("/trainings"), "/trainings");
  assert.equal(pfad(["/a", "/b"]), "/a");
  assert.equal(pfad("https://evil.example"), "/");
  // Schema-relativ: beginnt mit "/", führt aber auf einen fremden Host —
  // genau die Lücke, die ein blosses startsWith("/") offen liess.
  assert.equal(pfad("//evil.example"), "/");
  assert.equal(pfad("/\\evil.example"), "/");
  assert.equal(pfad(["//evil.example", "/ok"]), "/");
  assert.equal(pfad(undefined), "/");
  assert.equal(pfad(undefined, "/konto"), "/konto");

  // Steuerzeichen: Der Browser wirft Tabulator, Wagenrücklauf und
  // Zeilenvorschub aus der URL, bevor er sie zerlegt — aus `/⇥/evil.example`
  // wird beim Lesen `//evil.example`. Eine Prüfung auf der ROHEN Zeichenkette
  // sähe hier ein harmloses `/…` und liesse den Ausbruch durch.
  assert.equal(pfad("/\t/evil.example"), "/");
  assert.equal(pfad("/\n/evil.example"), "/");
  assert.equal(pfad("/\r/evil.example"), "/");
  assert.equal(pfad("/\t\r\n/evil.example"), "/");
  assert.equal(pfad("/\\\t/evil.example"), "/");
  // Ein gültiger Pfad übersteht das Bereinigen unbeschadet.
  assert.equal(pfad("/trai\tnings"), "/trainings");
});

// ── 2. Wächter: keine Seite deklariert ein Feld zu eng ──────────────────────

/** Der Typ hinter `searchParams:` — klammertief bis zur schliessenden `>` von
 *  `Promise<…>`. Nicht per Regex `[^>]*`, weil ein Feldtyp selbst spitze
 *  Klammern tragen darf. `null`, wenn die Datei keine Such-Parameter nimmt. */
function parameterTyp(quelle: string): string | null {
  const marke = quelle.indexOf("searchParams:");
  if (marke === -1) return null;
  const rest = quelle.slice(marke + "searchParams:".length);
  const kopf = /^\s*Promise\s*</.exec(rest);
  if (!kopf) return null;
  let i = kopf[0].length;
  const von = i;
  let tiefe = 1;
  for (; i < rest.length && tiefe > 0; i++) {
    if (rest[i] === "<") tiefe++;
    else if (rest[i] === ">") tiefe--;
  }
  return tiefe === 0 ? rest.slice(von, i - 1).trim() : null;
}

/** Zerlegt `{ a?: X; b?: Y }` in seine Felder — klammertief, damit ein
 *  Feldtyp wie `Record<string, string>` nicht am Trennzeichen zerreisst. */
function felder(objektTyp: string): { name: string; typ: string }[] {
  const inhalt = objektTyp.trim().replace(/^\{/, "").replace(/\}$/, "");
  const teile: string[] = [];
  let tiefe = 0;
  let aktuell = "";
  for (const z of inhalt) {
    if ("{[(<".includes(z)) tiefe++;
    if ("}])>".includes(z)) tiefe--;
    if ((z === ";" || z === ",") && tiefe === 0) {
      teile.push(aktuell);
      aktuell = "";
    } else aktuell += z;
  }
  teile.push(aktuell);

  return teile
    .map((t) => t.trim())
    .filter(Boolean)
    .map((teil) => {
      // Index-Signatur `[key: string]: T` — der trennende Doppelpunkt ist der
      // NACH der schliessenden eckigen Klammer, nicht der darin.
      if (teil.startsWith("[")) {
        const zu = teil.indexOf("]");
        return { name: teil.slice(0, zu + 1), typ: teil.slice(zu + 2).trim() };
      }
      const dp = teil.indexOf(":");
      // Das Fragezeichen gehört zur Optionalität, nicht zum Namen — ohne es
      // liest sich die Meldung wie der Parameter in der Adresse.
      return {
        name: teil.slice(0, dp).trim().replace(/\?$/, ""),
        typ: teil.slice(dp + 1).trim(),
      };
    });
}

/** Ehrlich ist ein Feldtyp, der `RohWert` ist oder `string[]` selbst nennt.
 *  Ein Feld aus `searchParams` KANN `string[]` nicht ausschliessen — Next
 *  fasst wiederholte Parameter nie zusammen. */
function istEhrlich(typ: string): boolean {
  return typ === "RohWert" || /string\s*\[\s*\]/.test(typ);
}

/** Als ganze Signatur zulässig: der Sammeltyp für Seiten, die einen Parameter
 *  unter importiertem Namen lesen. */
const GANZE_SIGNATUR = ["RohParameter"];

function seiten(wurzel: string): string[] {
  const gefunden: string[] = [];
  const lauf = (ordner: string) => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      if (eintrag.name.startsWith(".") || eintrag.name === "node_modules") continue;
      const pfadHier = join(ordner, eintrag.name);
      if (eintrag.isDirectory()) lauf(pfadHier);
      else if (/^(page|layout)\.tsx$/.test(eintrag.name)) gefunden.push(pfadHier);
    }
  };
  lauf(wurzel);
  return gefunden;
}

const SEITEN = seiten(join(WEB, "app"));

pruefe(`Jede Seite deklariert searchParams ehrlich (${SEITEN.length} Seiten)`, () => {
  const treffer: string[] = [];
  for (const datei of SEITEN) {
    const kurz = relative(WEB, datei);
    const typ = parameterTyp(readFileSync(datei, "utf8"));
    if (typ === null || GANZE_SIGNATUR.includes(typ)) continue;
    if (!typ.startsWith("{")) {
      treffer.push(`${kurz}: unbekannte Form „${typ}" — Objektliteral oder RohParameter erwartet`);
      continue;
    }
    for (const { name, typ: feldTyp } of felder(typ)) {
      if (!istEhrlich(feldTyp)) {
        treffer.push(
          `${kurz}: Feld „${name}" ist „${feldTyp}" — RohWert aus lib/such-parameter.ts nehmen`,
        );
      }
    }
  }
  assert.deepEqual(treffer, [], `${treffer.length} zu enge Deklaration(en):\n${treffer.join("\n")}`);
});

// Gegenprobe: Der Scanner muss eine Lüge auch wirklich sehen. Ohne diese
// Selbstprüfung wäre ein kaputter Parser ein stiller Wächter, der alles
// durchwinkt — schlimmer als gar keiner.
pruefe("Der Scanner erkennt eine zu enge Deklaration", () => {
  const lüge = `searchParams: Promise<{ q?: string; kat?: RohWert }>;`;
  const gefunden = felder(parameterTyp(lüge)!).filter((f) => !istEhrlich(f.typ));
  assert.deepEqual(
    gefunden.map((f) => f.name),
    ["q"],
  );
  const ehrlich = `searchParams: Promise<{ q?: RohWert; n?: string | string[] | undefined }>;`;
  assert.deepEqual(felder(parameterTyp(ehrlich)!).filter((f) => !istEhrlich(f.typ)), []);
  assert.equal(parameterTyp(`params: Promise<{ slug: string }>;`), null);
});

console.log(
  `\n${gelaufen} Prüfungen bestanden` + (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
