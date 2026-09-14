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
// GRENZE, bewusst und benannt: Geprüft wird nur, was IM SELBEN File direkt
// hinter `searchParams:` steht — dort allerdings jede Fundstelle, nicht bloss
// die erste (eine Datei trägt schnell zwei, sobald ein `generateMetadata`
// dazukommt). Wer die Signatur in ein ausgelagertes Interface schöbe, liefe
// am Wächter vorbei; das ist eine Konvention, kein stiller blinder Fleck.
// Wo der Abgleich nicht trägt, sagt er das (siehe Abschnitt 2) — er schweigt
// nie an einer Stelle, die er nicht beurteilen kann.
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
//
// Bewusst ein Textabgleich und KEIN Parser. Die erste Fassung zerlegte den Typ
// klammertief von Hand — 200 Zeilen, die drei eigene Fehler trugen, einer davon
// meldete einwandfreien Code und hätte die CI blockiert. Ein Wächter, der
// selbst gewartet werden muss, kostet mehr, als er einbringt.
//
// Diese Fassung deckt jede Deklaration ab, die in `app/` real vorkommt. Ein
// Feldtyp mit eigenen spitzen Klammern (`Record<string, string>`) bricht den
// Abgleich ab — dann meldet der Wächter „nicht prüfbar" und schweigt nicht
// etwa. Er täuscht also nie Sicherheit vor, die er nicht hat.

/** Kommentare raus, bevor abgeglichen wird: Ein Doc-Kommentar darf einen
 *  Doppelpunkt tragen, und auskommentierter Code ist kein Code. Zeilenenden
 *  bleiben erhalten, damit keine zwei Zeilen zusammenfallen. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** `searchParams: Promise<…>` — jede Fundstelle der Datei, nicht nur die
 *  erste: Ein `generateMetadata` über der Seitenkomponente deckte sonst eine
 *  unehrliche Signatur darunter zu. */
const DEKLARATION = /searchParams\s*:\s*Promise\s*<([^>]*)>/g;
/** Eine Index-Signatur `[key: string]: T` — ihr Doppelpunkt steht NACH der
 *  schliessenden eckigen Klammer, darum ein eigener Abgleich. */
const INDEX_SIGNATUR = /\[[^\]]*\]\s*:\s*([^;,}]+)/g;
/** Ein gewöhnliches Feld `name?: T`. */
const FELD = /([A-Za-z_$][\w$]*)\s*\??\s*:\s*([^;,}]+)/g;

/** Ehrlich ist ein Feldtyp, der BEIDE Gestalten zulässt: den einzelnen Wert
 *  und die Liste. Ein Feld aus `searchParams` kann keine ausschliessen —
 *  `?kat=a` liefert einen String, `?kat=a&kat=b` ein Array, und Next
 *  entscheidet das nach der Adresse, nicht nach dem Typ. Beide Richtungen sind
 *  derselbe Fehler: `{ kat?: string }` bricht an `.trim()`, `{ kat?: string[] }`
 *  an `.map()`. */
function istEhrlich(typ: string): boolean {
  if (typ.trim() === "RohWert") return true;
  const listenfrei = typ.replace(/string\s*\[\s*\]/g, "");
  return /string\s*\[\s*\]/.test(typ) && /\bstring\b/.test(listenfrei);
}

/** Was an einer Quelle zu beanstanden ist, als fertige Meldungen. EINE
 *  Funktion für den Ernstfall und die Gegenprobe: Prüfte die Gegenprobe einen
 *  Nachbau, bewiese sie bloss, dass der Nachbau funktioniert — und genau der
 *  Pfad, der in der CI läuft, bliebe ungetestet. */
function beanstandungen(quelle: string, wo: string): string[] {
  const treffer: string[] = [];
  for (const [, inneres] of ohneKommentare(quelle).matchAll(DEKLARATION)) {
    const inhalt = inneres.trim();
    if (inhalt === "RohParameter") continue;
    if (!inhalt.startsWith("{") || !inhalt.endsWith("}")) {
      treffer.push(`${wo}: searchParams als „${inhalt}" — nicht prüfbar; RohParameter oder ein Objektliteral erwartet`);
      continue;
    }
    const melde = (name: string, typ: string) => {
      if (!istEhrlich(typ)) {
        treffer.push(`${wo}: Feld „${name}" ist „${typ.trim()}" — RohWert aus lib/such-parameter.ts nehmen`);
      }
    };
    for (const [, typ] of inhalt.matchAll(INDEX_SIGNATUR)) melde("[key]", typ);
    for (const [, name, typ] of inhalt.replace(INDEX_SIGNATUR, "").matchAll(FELD)) melde(name, typ);
  }
  return treffer;
}

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
  const treffer = SEITEN.flatMap((datei) =>
    beanstandungen(readFileSync(datei, "utf8"), relative(WEB, datei)),
  );
  assert.deepEqual(treffer, [], `${treffer.length} zu enge Deklaration(en):\n${treffer.join("\n")}`);
});

// ── 3. Gegenprobe auf den Wächter selbst ───────────────────────────────────
// Ein kaputter Wächter ist schlimmer als gar keiner: Er winkt alles durch und
// sieht dabei aus wie eine bestandene Prüfung.

/** Die beanstandeten Feldnamen einer Quelle — derselbe Weg wie in der CI. */
function beanstandet(quelle: string): string[] {
  return beanstandungen(quelle, "x").map((m) => m.replace(/^x: Feld „([^"]+)".*$/u, "$1"));
}

pruefe("Gegenprobe: zu eng als einzelner Wert", () => {
  assert.deepEqual(beanstandet(`searchParams: Promise<{ q?: string; kat?: RohWert }>;`), ["q"]);
});

pruefe("Gegenprobe: zu eng als Liste", () => {
  assert.deepEqual(beanstandet(`searchParams: Promise<{ kat?: string[] }>;`), ["kat"]);
  assert.equal(istEhrlich("string[]"), false);
  assert.equal(istEhrlich("string"), false);
  assert.equal(istEhrlich("string | string[] | undefined"), true);
  assert.equal(istEhrlich("RohWert"), true);
});

pruefe("Gegenprobe: Ehrliches bleibt unbeanstandet", () => {
  assert.deepEqual(
    beanstandet(`searchParams: Promise<{ q?: RohWert; n?: string | string[] | undefined }>;`),
    [],
  );
  assert.deepEqual(beanstandet(`searchParams: Promise<RohParameter>;`), []);
  assert.deepEqual(beanstandet(`searchParams: Promise<{ [key: string]: string | string[] | undefined }>;`), []);
  // `params` ist nicht `searchParams` — ein enger Typ ist dort richtig.
  assert.deepEqual(beanstandet(`params: Promise<{ slug: string }>;`), []);
});

pruefe("Gegenprobe: eine zu enge Index-Signatur fällt auf", () => {
  assert.deepEqual(beanstandet(`searchParams: Promise<{ [key: string]: string }>;`), ["[key]"]);
});

pruefe("Gegenprobe: Kommentare stören nicht", () => {
  // Ohne Bereinigung risse die Trennung am Doppelpunkt IM Kommentar.
  assert.deepEqual(
    beanstandet(`searchParams: Promise<{\n  /** Achtung: nur intern. */\n  q?: RohWert;\n}>;`),
    [],
  );
  assert.deepEqual(beanstandet(`// searchParams: Promise<{ q?: string }>;`), []);
});

pruefe("Gegenprobe: die zweite Deklaration derselben Datei zählt mit", () => {
  const zwei =
    `export async function generateMetadata({ searchParams }: { searchParams: Promise<RohParameter> }) {}\n` +
    `export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) {}`;
  assert.deepEqual(beanstandet(zwei), ["created"]);
});

pruefe("Gegenprobe: Unlesbares wird gemeldet, nicht verschwiegen", () => {
  // Spitze Klammern im Feldtyp brechen den Abgleich ab — der Wächter sagt das,
  // statt Sicherheit vorzutäuschen, die er nicht hat.
  assert.deepEqual(beanstandungen(`searchParams: Promise<{ x?: Record<string, string> }>;`, "x").length, 1);
});

console.log(
  `\n${gelaufen} Prüfungen bestanden` + (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
