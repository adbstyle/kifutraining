/**
 * Ehrliche Such-Parameter — die Antwort auf eine Typlüge von Next 15.
 *
 * `searchParams` liefert für JEDES Feld `string | string[] | undefined`: Next
 * fasst wiederholte Parameter nicht zusammen. Steht derselbe Name zweimal in
 * der Adresse (`?q=a&q=b`), kommt ein Array an. Wer das Feld als reines
 * `string` deklariert, belügt damit den Compiler — er glaubt es, die Laufzeit
 * widerspricht mit einem `TypeError` („.trim is not a function"), und React
 * macht daraus eine weisse Fehlerseite mit HTTP 500.
 *
 * Auf Produktion nachgewiesen mit `/trainings?q=a&q=b`,
 * `/trainings?stufen=E&stufen=F` und `/login?redirect=/a&redirect=/b`.
 *
 * Die Abwehr steht auf zwei Beinen:
 *
 * 1. **`RohWert` ist der einzige ehrliche Feldtyp.** Jede Seite deklariert
 *    ihre Felder damit — `{ q?: RohWert }`, nie `{ q?: string }`. Die
 *    Aufzählung bleibt dabei erhalten: Wer die Signatur liest, sieht weiter,
 *    welche Parameter die Seite überhaupt kennt.
 * 2. **Je Wertart genau eine Lese-Funktion**, die EINMAL entscheidet, was bei
 *    Mehrfachangabe gilt. Skalare nehmen den ERSTEN Wert — wie
 *    `URLSearchParams.get()`, das die Route Handler unter `app/auth/` schon
 *    nutzen. Dieselbe Adresse verhält sich damit in Server Component und
 *    Route Handler gleich.
 *
 * Kein deklaratives Schema (`leseParameter(sp, { q: text, … })`): Was mit dem
 * Rohwert danach geschieht, ist von Feld zu Feld verschieden — Vokabular-Filter
 * bei `stufen`, Pfad-Prüfung bei `redirect`, blosse Anwesenheit bei `termin`.
 * Ein Schema bräuchte für die Hälfte der Felder ohnehin eine Fluchttür nach
 * draussen und wäre dann eine zweite Art, dasselbe zu tun.
 *
 * Der Zwilling dazu ist `scripts/pruefe-such-parameter.ts`: Er prüft diese
 * Funktionen gegen Duplikat-Eingaben UND meldet jede Seite, die ein Feld
 * wieder zu eng deklariert. Ohne ihn fiele ein Rückfall erst im Betrieb auf —
 * `{ q?: string }` ist für TypeScript ein völlig unauffälliger Typ.
 */

/** Der einzige ehrliche Typ für ein Feld aus `searchParams`. */
export type RohWert = string | string[] | undefined;

/** Für Seiten, die einen Parameter unter einem importierten Namen lesen (etwa
 *  `VARIANTE_PARAM`) und ihn darum nicht als festes Feld schreiben können.
 *  Wo der Name feststeht, ist die feldweise Deklaration vorzuziehen — sie ist
 *  ebenso ehrlich, verrät aber zusätzlich, welche Parameter es gibt. */
export type RohParameter = Record<string, RohWert>;

/** Der erste Wert — die gemeinsame Grundlage aller skalaren Helfer. Nicht
 *  exportiert: Wer einen Skalar liest, soll sagen, WAS er liest (`text`,
 *  `zahl`, `flag`, `pfad`), nicht bloss „nimm den ersten". */
function erstwert(wert: RohWert): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert;
}

/** Ein Textfeld: erster Wert, getrimmt; leer zählt als nicht gesetzt. Auch
 *  richtig für Felder, bei denen nur die Anwesenheit zählt (`?termin=<id>`). */
export function text(wert: RohWert): string | undefined {
  const s = erstwert(wert)?.trim();
  return s ? s : undefined;
}

/** Eine Mehrfachauswahl. `?kat=a,b` und `?kat=a&kat=b` ergeben dasselbe — ein
 *  Array wird dazu erst zusammengefügt und dann wie eine einzelne Angabe
 *  zerlegt. Leere Teile fallen weg. */
export function liste(wert: RohWert): string[] {
  if (!wert) return [];
  return (Array.isArray(wert) ? wert.join(",") : wert).split(",").filter(Boolean);
}

/** Eine positive Ganzzahl aus dem ersten Wert; alles andere (leer, 0, negativ,
 *  keine Zahl) gilt als nicht gesetzt. Den fachlichen Vorgabewert bestimmt die
 *  aufrufende Seite. */
export function zahl(wert: RohWert): number | undefined {
  const n = Number.parseInt(erstwert(wert) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Ein Schalter: wahr bei genau `"1"` — die einzige Schreibweise, die diese
 *  Anwendung je in die Adresse schreibt (`?created=1`, `?mine=1`, …). Ein
 *  abweichender erster Wert gilt als nicht gesetzt; `?mine=0` ist damit
 *  falsch und nicht etwa „irgendein Text, also wahr". */
export function flag(wert: RohWert): boolean {
  return erstwert(wert) === "1";
}

/** Ein Ziel INNERHALB dieser Anwendung — das Rücksprungziel nach dem Login.
 *
 *  Gültig ist nur ein Pfad mit genau EINEM führenden `/`. `//evil.example`
 *  beginnt zwar ebenfalls mit `/`, ist aber eine schema-relative URL: Als
 *  `Location`-Kopfzeile schickt sie den Browser auf einen fremden Host. Ein
 *  blosses `startsWith("/")` sieht das nicht — genau daran hing hier ein
 *  offener Redirect. Der Backslash zählt mit, weil Browser `/\` wie `//`
 *  auflösen.
 *
 *  ZUERST STRIPPEN, DANN PRÜFEN — und diese Reihenfolge ist der ganze Punkt:
 *  Browser entfernen Tabulator, Wagenrücklauf und Zeilenvorschub aus einer
 *  URL, BEVOR sie sie zerlegen (WHATWG URL Standard). Für `/⇥/evil.example`
 *  sähe eine Prüfung auf der rohen Zeichenkette ein harmloses `/…`, der
 *  Browser dagegen `//evil.example` — und folgte auf den fremden Host. Wer
 *  hier die rohe Zeichenkette prüft, prüft etwas, das nie jemand liest.
 *  Zurückgegeben wird darum ebenfalls die bereinigte Fassung: Was die Prüfung
 *  gesehen hat, ist genau das, was weitergereicht wird. */
export function pfad(wert: RohWert, vorgabe = "/"): string {
  const s = erstwert(wert)?.replace(/[\t\r\n]/g, "");
  if (!s || !s.startsWith("/")) return vorgabe;
  return s.startsWith("//") || s.startsWith("/\\") ? vorgabe : s;
}
