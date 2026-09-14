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
// File direkt hinter `searchParams:` stehen — dort allerdings JEDE Fundstelle,
// nicht bloss die erste (eine Datei trägt schnell zwei, sobald ein
// `generateMetadata` dazukommt). Wer die Signatur in ein ausgelagertes
// Interface schöbe, liefe am Scanner vorbei. Für die heutigen Seiten genügt
// das; es ist eine Konvention, kein stiller blinder Fleck.
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

/** Kommentare raus, bevor irgendetwas zerlegt wird.
 *
 *  Zwei Gründe, und beide sind schon aufgetreten: Ein Doc-Kommentar am Feld
 *  darf einen Doppelpunkt tragen („Achtung: nur intern"), und die Trennung von
 *  Name und Typ sucht genau den ersten Doppelpunkt — sie risse sonst mitten im
 *  Kommentar. Und auskommentierter Code ist kein Code: Eine stillgelegte
 *  Deklaration soll den Wächter nicht auslösen.
 *
 *  Zeilenenden bleiben erhalten (`[^\n]*`), damit keine zwei Zeilen
 *  zusammenfallen. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** JEDE `searchParams:`-Deklaration der Datei, in Reihenfolge — klammertief
 *  bis zur schliessenden `>` von `Promise<…>`. Nicht per Regex `[^>]*`, weil
 *  ein Feldtyp selbst spitze Klammern tragen darf.
 *
 *  ALLE, nicht nur die erste: Eine Datei kann zwei tragen — ein
 *  `generateMetadata` über der Seitenkomponente. Prüfte der Wächter bloss die
 *  erste, deckte eine ehrliche Metadaten-Signatur eine unehrliche Seite
 *  darunter zu, und genau der Rückfall, den er verhindern soll, käme
 *  ungesehen durch.
 *
 *  `null` steht für „gefunden, aber nicht als `Promise<…>` lesbar" — das
 *  meldet der Aufrufer, statt es zu verschweigen. */
function parameterTypen(quelle: string): (string | null)[] {
  const gefunden: (string | null)[] = [];
  const marke = "searchParams:";
  for (let ab = 0; ; ) {
    const treffer = quelle.indexOf(marke, ab);
    if (treffer === -1) return gefunden;
    ab = treffer + marke.length;

    const rest = quelle.slice(ab);
    const kopf = /^\s*Promise\s*</.exec(rest);
    if (!kopf) {
      gefunden.push(null);
      continue;
    }
    let i = kopf[0].length;
    const von = i;
    let tiefe = 1;
    for (; i < rest.length && tiefe > 0; i++) {
      if (rest[i] === "<") tiefe++;
      else if (rest[i] === ">") tiefe--;
    }
    gefunden.push(tiefe === 0 ? rest.slice(von, i - 1).trim() : null);
  }
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

/** Ehrlich ist ein Feldtyp, der BEIDE Gestalten zulässt: den einzelnen Wert
 *  und die Liste. Ein Feld aus `searchParams` kann keine von beiden
 *  ausschliessen — `?kat=a` liefert einen String, `?kat=a&kat=b` ein Array,
 *  und Next entscheidet das nach der Adresse, nicht nach dem Typ.
 *
 *  Beide Richtungen sind derselbe Fehler: `{ kat?: string }` bricht an
 *  `.trim()`, `{ kat?: string[] }` an `.map()`. Nur auf `string[]` zu prüfen
 *  liesse die zweite Hälfte durch — und wer `string[]` schreibt, hat gerade
 *  bewusst über den Typ nachgedacht und sich trotzdem für eine Gestalt
 *  entschieden. */
function istEhrlich(typ: string): boolean {
  if (typ === "RohWert") return true;
  const listenfrei = typ.replace(/string\s*\[\s*\]/g, "");
  return /string\s*\[\s*\]/.test(typ) && /\bstring\b/.test(listenfrei);
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

/** Was an einer Quelle zu beanstanden ist, als fertige Meldungen.
 *
 *  Bewusst EINE Funktion für den Ernstfall und die Gegenprobe weiter unten:
 *  Prüfte die Gegenprobe einen nachgebauten Weg, bewiese sie nur, dass der
 *  Nachbau funktioniert — und genau der Pfad, der in der CI läuft, bliebe
 *  ungetestet. */
function beanstandungen(quelle: string, wo: string): string[] {
  const treffer: string[] = [];
  for (const typ of parameterTypen(ohneKommentare(quelle))) {
    if (typ === null) {
      treffer.push(`${wo}: searchParams ohne lesbares Promise<…> — so kann ich nicht prüfen`);
      continue;
    }
    if (GANZE_SIGNATUR.includes(typ)) continue;
    if (!typ.startsWith("{")) {
      treffer.push(`${wo}: unbekannte Form „${typ}" — Objektliteral oder RohParameter erwartet`);
      continue;
    }
    for (const { name, typ: feldTyp } of felder(typ)) {
      if (!istEhrlich(feldTyp)) {
        treffer.push(`${wo}: Feld „${name}" ist „${feldTyp}" — RohWert aus lib/such-parameter.ts nehmen`);
      }
    }
  }
  return treffer;
}

const SEITEN = seiten(join(WEB, "app"));

pruefe(`Jede Seite deklariert searchParams ehrlich (${SEITEN.length} Seiten)`, () => {
  const treffer = SEITEN.flatMap((datei) =>
    beanstandungen(readFileSync(datei, "utf8"), relative(WEB, datei)),
  );
  assert.deepEqual(treffer, [], `${treffer.length} zu enge Deklaration(en):\n${treffer.join("\n")}`);
});

// ── 3. Gegenprobe auf den Wächter selbst ───────────────────────────────────
// Ein kaputter Parser ist schlimmer als gar keiner: Er winkt alles durch und
// sieht dabei aus wie eine bestandene Prüfung. Darum steht jeder Fall, den
// dieser Scanner können muss, hier als eigene Behauptung.

/** Die beanstandeten FELDNAMEN einer Quelle — dieselbe Prüfung wie in der CI,
 *  nur auf das Wesentliche eingedampft, damit die Behauptungen lesbar
 *  bleiben. */
function beanstandet(quelle: string): string[] {
  return beanstandungen(quelle, "x").map((m) => m.replace(/^x: Feld „([^"]+)".*$/u, "$1"));
}

pruefe("Gegenprobe: zu eng als einzelner Wert deklariert", () => {
  assert.deepEqual(beanstandet(`searchParams: Promise<{ q?: string; kat?: RohWert }>;`), ["q"]);
});

pruefe("Gegenprobe: zu eng als Liste deklariert", () => {
  // Die andere Hälfte derselben Lüge: `?kat=a` liefert einen String, und
  // `.map()` darauf wirft. Ein Wächter, der nur `string[]` verlangte, hielte
  // ausgerechnet diese Deklaration für vorbildlich.
  assert.deepEqual(beanstandet(`searchParams: Promise<{ kat?: string[] }>;`), ["kat"]);
  assert.equal(istEhrlich("string[]"), false);
  assert.equal(istEhrlich("string"), false);
  assert.equal(istEhrlich("string | string[] | undefined"), true);
  assert.equal(istEhrlich("RohWert"), true);
});

pruefe("Gegenprobe: ehrliche Deklarationen bleiben unbeanstandet", () => {
  assert.deepEqual(
    beanstandet(`searchParams: Promise<{ q?: RohWert; n?: string | string[] | undefined }>;`),
    [],
  );
  assert.deepEqual(beanstandet(`searchParams: Promise<RohParameter>;`), []);
  // `params` ist nicht `searchParams` — ein enger Typ ist dort richtig.
  assert.deepEqual(beanstandet(`params: Promise<{ slug: string }>;`), []);
});

pruefe("Gegenprobe: ein Doppelpunkt im Kommentar reisst nichts auseinander", () => {
  // Ohne Kommentar-Bereinigung träfe die Trennung von Name und Typ den
  // Doppelpunkt IM Kommentar — der Wächter meldete dann einwandfreien Code.
  assert.deepEqual(
    beanstandet(`searchParams: Promise<{\n  /** Achtung: nur intern. */\n  q?: RohWert;\n}>;`),
    [],
  );
  // Auskommentierter Code ist kein Code.
  assert.deepEqual(beanstandet(`// searchParams: Promise<{ q?: string }>;`), []);
});

pruefe("Gegenprobe: die zweite Deklaration derselben Datei wird mitgeprüft", () => {
  // Ein generateMetadata über der Seitenkomponente darf keine unehrliche
  // Signatur darunter zudecken.
  const zwei =
    `export async function generateMetadata({ searchParams }: { searchParams: Promise<RohParameter> }) {}\n` +
    `export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) {}`;
  assert.deepEqual(beanstandet(zwei), ["created"]);
});

console.log(
  `\n${gelaufen} Prüfungen bestanden` + (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
