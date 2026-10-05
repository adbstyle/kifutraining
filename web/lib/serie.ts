// Die Regeln einer Terminserie (Team-Kalender #324, #326).
//
// Eine Regelquelle für die Serien-Dialoge der Oberfläche und die KI-Werkzeuge
// «terminserie_festlegen», «termin_aendern» und «termin_entfernen» mit
// Reichweite. Die Datenebene (Migration terminserien) prüft dieselben Regeln
// als Rückhalt und meldet mit den Markern aus SERIE_MELDUNG.
//
// REIN: importiert nur lib/termin.ts (ebenfalls rein) — `check:kern` lädt sie mit tsx.
import { TERMIN_TEXT, istKalendertag, textProblem, zeitProblem } from "@/lib/termin";

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag (Zwilling: `extract(isodow …)`). */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WOCHENTAGE: readonly Wochentag[] = [1, 2, 3, 4, 5, 6, 7];
export const WOCHENTAG_KURZ: Record<Wochentag, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
export const WOCHENTAG_LANG: Record<Wochentag, string> = {
  1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 7: "Sonntag",
};

/** Die Kürzel des KI-Werkzeugs — Wörter statt Zahlen, damit der Assistent
 *  nicht rätselt, ob die Woche am Sonntag beginnt. */
export const KI_WOCHENTAG = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type KiWochentag = (typeof KI_WOCHENTAG)[number];
export const alsWochentag = (k: KiWochentag): Wochentag => (KI_WOCHENTAG.indexOf(k) + 1) as Wochentag;
export const alsKiWochentag = (w: Wochentag): KiWochentag => KI_WOCHENTAG[w - 1];

/** «Nur dieser», «dieser und folgende», «alle» — wie in gängigen Kalendern (PO 16). */
export type Reichweite = "nur_dieser" | "dieser_und_folgende" | "alle";

/** Der Wochentag eines Kalendertags. In UTC gerechnet: Ein Kalendertag hat
 *  keine Zeitzone, und die Zeitumstellung verschiebt so keinen Tag. */
export function wochentagVon(iso: string): Wochentag {
  const t = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (t === 0 ? 7 : t) as Wochentag;
}

const zwei = (n: number) => String(n).padStart(2, "0");
const alsIso = (d: Date) => `${String(d.getUTCFullYear()).padStart(4, "0")}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}`;

/** Der letzte zulässige Tag einer Serie: der gleiche Kalendertag im
 *  Folgejahr, nach einem 29. Februar der 28. Februar (#324 AK 5) —
 *  Zwilling von `(beginn_datum + interval '1 year')::date`. Am Rand der
 *  vierstelligen Jahre (ab 9999) gibt es kein Folgejahr: Dann gilt
 *  «9999-12-31», damit nie ein fünfstelliges Jahr entsteht (Postgres kennt
 *  es nicht, und `serienTage` käme mit ihm nicht zurecht). */
export function maxEnddatum(von: string): string {
  const [j, m, t] = von.split("-").map(Number);
  if (j >= 9999) return "9999-12-31";
  const letzter = new Date(Date.UTC(j + 1, m, 0)).getUTCDate();
  return `${String(j + 1).padStart(4, "0")}-${zwei(m)}-${zwei(Math.min(t, letzter))}`;
}

/** Einen Kalendertag um `n` Tage verschieben. */
export function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return alsIso(d);
}

/** Die Tage einer Regel, aufsteigend (Zwilling von `serien_tage`). Die
 *  Schleife läuft über die Zahl der Tage zwischen `von` und `bis`, nicht über
 *  das Datum selbst: Am Jahr 9999 schlüge ein «Tag plus eins» in einen
 *  ungültigen Wert um und die Schleife endete nie. Erwartet gültige Tage. */
export function serienTage(wochentage: readonly Wochentag[], von: string, bis: string): string[] {
  const tage: string[] = [];
  const n = Math.round((new Date(`${bis}T00:00:00Z`).getTime() - new Date(`${von}T00:00:00Z`).getTime()) / 86_400_000);
  for (let i = 0; i <= n; i++) {
    const d = plusTage(von, i);
    if (wochentage.includes(wochentagVon(d))) tage.push(d);
  }
  return tage;
}

/** «Di, Do» — für Karten und Auskünfte. */
export function wochentageText(w: readonly Wochentag[]): string {
  return [...w].sort().map((x) => WOCHENTAG_KURZ[x]).join(", ");
}

export const SERIE_TEXT = {
  wochentage: "Bitte mindestens einen Wochentag wählen.",
  endeVorBeginn: "Das Enddatum darf nicht vor dem Beginndatum liegen.",
  zuLang:
    "Eine Terminserie dauert höchstens bis zum gleichen Kalendertag im Folgejahr (nach einem 29. Februar bis zum 28. Februar).",
  ohneTag: "Im gewählten Zeitraum liegt keiner der gewählten Wochentage.",
  datumUndRegel: "Datum und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern.",
  /** #325: Einträge gelöschter Konten gibt es nur am Termin, nicht an der
   *  Serie; eine Serienänderung der Verantwortlichen ersetzte sie überall. */
  namenloseNurEinzeln: "Ehemalige Mitglieder ohne Namen lassen sich nur für diesen einen Termin entfernen.",
  namenloseUndRegel:
    "Ehemalige Mitglieder ohne Namen und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern.",
  /** #389, #390: Eine Serie gibt noch keine Felder und keine Spielerzahl vor
   *  — beide gelten an einem Serientermin nur für ihn. Übergang bis #391
   *  (Felder und Spielerzahl einer Terminserie), das beide Sätze wieder
   *  entfernt. */
  platzNurEinzeln: "Felder und erwartete Spielerzahl lassen sich nur für diesen einen Termin festhalten.",
  platzUndRegel:
    "Felder oder erwartete Spielerzahl und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern.",
} as const;

export type SerienRegel = { wochentage: Wochentag[]; von: string; bis: string };

/** Was sich an Wochentagen und Zeitraum gegenüber der Serie geändert hat —
 *  nur diese Teile, wie beim Termin (PO 17); `null`, wenn nichts. Die
 *  Reihenfolge der Wochentage zählt nicht. */
export function regelAenderung(
  alt: { wochentage: readonly Wochentag[]; beginnDatum: string; endDatum: string },
  neu: SerienRegel,
): Partial<SerienRegel> | null {
  const a: Partial<SerienRegel> = {};
  if ([...neu.wochentage].sort().join() !== [...alt.wochentage].sort().join()) a.wochentage = [...neu.wochentage].sort() as Wochentag[];
  if (neu.von !== alt.beginnDatum) a.von = neu.von;
  if (neu.bis !== alt.endDatum) a.bis = neu.bis;
  return Object.keys(a).length > 0 ? a : null;
}

/** Die Obergrenze des Enddatums, solange die Reichweite noch nicht gewählt
 *  ist (#326 AK 5, PC 19). Für «alle» zählt das Beginndatum der Serie, für
 *  «dieser und folgende» das der neuen Teilserie — ohne verschobenes
 *  Beginndatum also der gewählte Termin. Vorab gilt die weitere der beiden
 *  Grenzen; die engere prüft der Fachkern mit der Reichweite, mit demselben
 *  Satz (`SERIE_TEXT.zuLang`). */
export function obergrenzeVorab(serie: { beginnDatum: string }, regel: { von: string }, terminDatum: string): string {
  const von = regel.von === serie.beginnDatum && terminDatum > regel.von ? terminDatum : regel.von;
  return maxEnddatum(von);
}

/** Was an einer geänderten Regel schon vor der Wahl der Reichweite nicht
 *  stimmt, sonst `null`: die Regeln von `serieProblem` (nur Wochentage und
 *  Zeitraum, Platzhalterzeit wie im Fachkern), die Obergrenze aber nach
 *  `obergrenzeVorab`. */
export function regelProblemVorab(
  serie: { beginnDatum: string },
  regel: SerienRegel,
  terminDatum: string,
): { feld: SerieFeld; text: string } | null {
  const p = serieProblem({ ...regel, beginn: "00:00", ende: "00:01" });
  if (p?.text === SERIE_TEXT.zuLang && regel.bis <= obergrenzeVorab(serie, regel, terminDatum)) return null;
  return p;
}

/** Für welche Reichweiten eine Änderung an einem Serientermin gilt
 *  (#326 AK 1–4): das Datum nur für diesen Termin, Wochentage und Zeitraum nur
 *  für diesen und folgende oder für alle; Zeit, Ort, Bemerkung und
 *  Verantwortliche (#325) für jede. `null`, wenn Datum und Regel zugleich
 *  geändert werden — das schliesst sich aus (`SERIE_TEXT.datumUndRegel`).
 *
 *  `namenlose`: An den Verantwortlichen ändern sich allein die Einträge
 *  gelöschter Konten (#325 PC 8). Die gibt es nur am Termin; eine Änderung für
 *  folgende oder alle ersetzte an jedem erfassten Termin ALLE Einträge, auch
 *  die namenlosen. Darum gilt sie wie das Datum nur für diesen Termin
 *  (`SERIE_TEXT.namenloseNurEinzeln`, mit der Regel zusammen
 *  `SERIE_TEXT.namenloseUndRegel`).
 *
 *  `platz`: Felder (#389) oder erwartete Spielerzahl (#390) ändern sich. Die
 *  Serie gibt noch keine vor, darum gelten sie nur für diesen Termin
 *  (`SERIE_TEXT.platzNurEinzeln`) — bis #391. */
export function erlaubteReichweiten(g: {
  datum: boolean;
  regel: boolean;
  namenlose?: boolean;
  platz?: boolean;
}): readonly Reichweite[] | null {
  const nurEinzeln = g.datum || !!g.namenlose || !!g.platz;
  if (nurEinzeln && g.regel) return null;
  if (nurEinzeln) return ["nur_dieser"];
  if (g.regel) return ["dieser_und_folgende", "alle"];
  return ["nur_dieser", "dieser_und_folgende", "alle"];
}

export type SerieFeld = "wochentage" | "von" | "bis" | "beginn" | "ende" | "ort" | "bemerkung";

/** Was an einer Serie nicht stimmt, sonst `null` (#324 AK 2, 4–6; #326 AK 5:
 *  beim Ändern mit dem aktuellen Beginndatum der jeweiligen Serie). */
export function serieProblem(f: {
  wochentage: readonly number[];
  von: string;
  bis: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
}): { feld: SerieFeld; text: string } | null {
  const w = f.wochentage;
  if (w.length === 0 || w.length > 7 || new Set(w).size !== w.length || w.some((x) => !Number.isInteger(x) || x < 1 || x > 7))
    return { feld: "wochentage", text: SERIE_TEXT.wochentage };
  if (!istKalendertag(f.von)) return { feld: "von", text: TERMIN_TEXT.datum };
  if (!istKalendertag(f.bis)) return { feld: "bis", text: TERMIN_TEXT.datum };
  if (f.bis < f.von) return { feld: "bis", text: SERIE_TEXT.endeVorBeginn };
  if (f.bis > maxEnddatum(f.von)) return { feld: "bis", text: SERIE_TEXT.zuLang };
  if (serienTage(w as Wochentag[], f.von, f.bis).length === 0) return { feld: "wochentage", text: SERIE_TEXT.ohneTag };
  const z = zeitProblem(f.beginn, f.ende);
  if (z) return z;
  return textProblem(f);
}

/** Die Sätze zu den Markern der Datenebene (Migrationen terminserien und
 *  terminserien_aendern) und zu den Regeln, die der Fachkern vorab prüft.
 *
 *  Kein Marker hier und in `TERMIN_MELDUNG` steckt in einem anderen — die
 *  `includes`-Suche (`weitereMeldung`, `kalenderFehler`) bleibt eindeutig; ein
 *  Test in `check:kern` wacht darüber. Darum heisst der Marker zum fehlenden
 *  Zeitraum `SERIE_OHNE_ZEITRAUM` und nicht `SERIE_ZEITRAUM_FEHLT`: Der
 *  begänne mit `SERIE_ZEIT`. */
export const SERIE_MELDUNG = {
  TEAM_NICHT_GEFUNDEN: "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.",
  SERIE_WOCHENTAGE: SERIE_TEXT.wochentage,
  SERIE_ENDE_VOR_BEGINN: SERIE_TEXT.endeVorBeginn,
  SERIE_ZU_LANG: SERIE_TEXT.zuLang,
  SERIE_OHNE_TAG: SERIE_TEXT.ohneTag,
  SERIE_ZEIT: "Bitte Beginn und Ende angeben; das Ende liegt am selben Tag nach dem Beginn.",
  SERIE_OHNE_ZEITRAUM: TERMIN_TEXT.datum,
  TERMIN_OHNE_SERIE: "Dieser Termin gehört zu keiner Terminserie.",
  REICHWEITE_UNGUELTIG: "Wähle «nur dieser», «dieser und folgende» oder «alle».",
  REICHWEITE_FEHLT:
    "Dieser Termin gehört zu einer Terminserie. Gib an, ob es nur für diesen Termin, für diesen und alle folgenden oder für alle Termine der Serie gilt.",
  DATUM_NUR_EINZELN: "Das Datum lässt sich nur für diesen einen Termin ändern.",
  REGEL_NUR_SERIE: "Wochentage und Zeitraum gelten für die Serie. Wähle «dieser und folgende» oder «alle».",
  TEILSERIE_BEGINN: "Mit «dieser und folgende» beginnt die Serie frühestens am gewählten Termin.",
  DATUM_FOLGT_NICHT: "Das Datum lässt sich nicht wieder der Serie folgen lassen; es zählt stets das aktuelle.",
  SERIE_GEAENDERT:
    "Die Terminserie wurde inzwischen von einem anderen Mitglied geändert. Sieh sie dir noch einmal an.",
  SERIE_BELEGUNG_GEAENDERT:
    "Seit deiner Auswahl hat sich geändert, welche wegfallenden Termine ein Training tragen. Sieh dir die Änderung noch einmal an.",
  KEINE_AENDERUNG: "Gib mindestens eine Angabe an, die sich ändern soll.",
  SERIE_ANGABEN_UNGUELTIG: "Wähle, welche Angaben wieder der Serie folgen sollen: Zeit, Ort oder Bemerkung.",
} as const;

/** Der KI-Weg verlangt eine ausdrückliche Bestätigung, wenn «dieser und
 *  folgende» oder «alle» vergangene Termine erfasst oder entfallen lässt
 *  (PO 16, #326 AK 11, #325 AK 20). */
export function vergangeneBestaetigen(n: number): string {
  return `Das erfasst ${n} vergangene ${n === 1 ? "Termin" : "Termine"}. Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}
