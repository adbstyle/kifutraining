// Die Spielerinnen und Spieler des Vereins aus einer CSV-Datei übernehmen
// (Epic Vereine #575, Story #585; Vorgänger am Team-Ort: Story #455).
//
// Gelesen wird im Browser: Die Datei verlässt das Gerät nie, an den Server
// gehen nur Vorname, Nachname, Jahrgang und J+S-Nummer je Zeile (#455 AK 28,
// #585 Precondition 5). Hier stehen das Dekodieren (UTF-8 oder Windows-
// Zeichensatz), das Zerlegen (Semikolon, Komma oder Tabulator), das Erkennen
// der Spalten an ihren Köpfen, das Herleiten der vier Angaben und die Sätze
// der Vorschau. Ob eine Zeile eine bestehende Spieler:in meint, entscheidet
// allein die Datenebene (`verein_spieler_importieren`) — über den ganzen
// Verein, mit demselben Schlüssel wie die Doppelerfassung.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { VEREIN_SPIELER_MAX, spielerVonText } from "@/lib/verein";
import { JS_MAX, SPIELER_MELDUNG, aufzaehlung, bereinigeName, jahrgangAus, nachTeamname, spielerProblem } from "@/lib/spieler";

/** Grösser liest der Import nicht — ein Verein passt weit darunter. */
export const IMPORT_BYTES_MAX = 1_000_000;
/** So viele Datenzeilen nimmt der Server höchstens entgegen (Marker `IMPORT_ZU_GROSS`). */
export const IMPORT_ZEILEN_MAX = 1000;

export const IMPORT_TEXT = {
  keineCsv: (name: string) =>
    `«${name}» ist keine CSV-Datei. Speichere sie in Excel unter «CSV (Trennzeichen-getrennt)» und wähle sie erneut.`,
  leer: "Die Datei ist leer.",
  nurKopf: "Die Datei hat nur eine Kopfzeile und keine Spieler:innen.",
  zeichensatz:
    "Der Zeichensatz der Datei lässt sich nicht sicher bestimmen; Umlaute würden verfälscht. Speichere sie als «CSV UTF-8» und wähle sie erneut.",
  /** Zu viele Zeilen: derselbe Satz wie der Marker der Datenebene. */
  zuGross: SPIELER_MELDUNG.IMPORT_ZU_GROSS,
  /** Die Datei selbst ist zu gross (1 MB), unabhängig von der Zeilenzahl. */
  zuGrossBytes:
    "Die Datei ist zu gross. Speichere nur die Spalten für Vorname, Nachname, Jahrgang und J+S-Nummer und wähle sie erneut.",
  /** Die Antwort der Datenebene hat nicht die vereinbarte Form (technischer Fehler). */
  unstimmig: "Der Import liess sich gerade nicht auswerten. Bitte versuche es noch einmal.",
  /** Die Einordnung stimmt nicht mehr mit der bestätigten Vorschau überein (#585 AK 9). */
  veraltet: "Seit der Vorschau hat sich der Spielerbestand geändert. Nichts übernommen. Prüfe die neue Vorschau.",
  vorname: "Der Vorname fehlt oder hat mehr als 60 Zeichen.",
  nachname: "Der Nachname fehlt oder hat mehr als 60 Zeichen.",
  geburtFehlt: "Das Geburtsdatum fehlt.",
  geburt: (roh: string) => `Das Geburtsdatum «${roh}» hat keine vierstellige Jahreszahl.`,
  js: (roh: string) => `«${roh}» ist keine J+S-Nummer und wird nicht übernommen.`,
  /** Vor der Dateiwahl: was mit Neuen und Bestehenden geschieht (#585 AK 3, 4). */
  einleitung: (verein: string) =>
    `Neue Spieler:innen kommen ohne Team in den ${verein}. Bestehende erkennt KiFu im ganzen Verein und legt sie nicht neu an.`,
  mehrfachViele:
    "Diese Spieler:innen werden mehrfach im Verein geführt. KiFu ändert bei keinem dieser Einträge die J+S-Nummer.",
  nichtsZuTun: "Alle stehen schon so im Verein; es gibt nichts zu übernehmen.",
  nichtsZuTunMehrfach: "Mehrfach geführte Spieler:innen ändert KiFu nicht.",
} as const;

// ── Datei lesen ─────────────────────────────────────────────────────────────

/** Bytes, die im Windows-Zeichensatz kein Zeichen sind: Wer sie enthält, ist
 *  weder UTF-8 noch Windows-1252 — Umlaute würden verfälscht. */
const KEIN_WINDOWS_ZEICHEN = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

/** Der Text der Datei, oder `null`, wenn der Zeichensatz nicht sicher ist:
 *  UTF-8 (mit oder ohne BOM) zuerst, sonst der Windows-Zeichensatz, in dem
 *  Excel und ClubCorner speichern. */
export function dekodiere(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    if (bytes.some((b) => KEIN_WINDOWS_ZEICHEN.has(b))) return null;
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Ein Datensatz der Datei; `nr` zählt wie eine Tabelle, die Kopfzeile ist 1. */
export type CsvZeile = { nr: number; werte: string[] };
export type CsvTabelle = { kopf: string[]; zeilen: CsvZeile[] };

/** Zerlegt CSV nach RFC 4180: Felder in Anführungszeichen dürfen Trennzeichen,
 *  Zeilenumbrüche und verdoppelte Anführungszeichen enthalten. */
function zerlege(text: string, trenner: string): string[][] {
  const saetze: string[][] = [];
  let satz: string[] = [];
  let feld = "";
  let zitat = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (zitat) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else zitat = false;
      } else feld += c;
    } else if (c === '"') zitat = true;
    else if (c === trenner) {
      satz.push(feld);
      feld = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      satz.push(feld);
      saetze.push(satz);
      satz = [];
      feld = "";
    } else feld += c;
  }
  if (feld !== "" || satz.length > 0) {
    satz.push(feld);
    saetze.push(satz);
  }
  return saetze;
}

/** Das Trennzeichen, das in der Kopfzeile am häufigsten steht. */
function trennerVon(text: string): string {
  const kopf = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  let bester = ",";
  let anzahl = 0;
  for (const t of [";", ",", "\t"]) {
    const n = kopf.split(t).length - 1;
    if (n > anzahl) [bester, anzahl] = [t, n];
  }
  return bester;
}

/** Die Datei als Tabelle, oder der Grund, warum sie sich nicht lesen lässt
 *  (#455 AK 4). Leere Datensätze fallen weg. */
export function leseDatei(
  name: string,
  bytes: Uint8Array,
): { ok: true; tabelle: CsvTabelle } | { ok: false; text: string } {
  if (/\.(xlsx?|xlsm|ods|numbers)$/i.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4b))
    return { ok: false, text: IMPORT_TEXT.keineCsv(name) };
  if (bytes.length > IMPORT_BYTES_MAX) return { ok: false, text: IMPORT_TEXT.zuGrossBytes };
  const text = dekodiere(bytes);
  if (text === null) return { ok: false, text: IMPORT_TEXT.zeichensatz };
  // Steuerzeichen ausser Tabulator und Zeilenende: keine Textdatei.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return { ok: false, text: IMPORT_TEXT.keineCsv(name) };
  const saetze = zerlege(text, trennerVon(text))
    .map((werte, i) => ({ nr: i + 1, werte: werte.map((w) => w.trim()) }))
    .filter((z) => z.werte.some((w) => w !== ""));
  if (saetze.length === 0) return { ok: false, text: IMPORT_TEXT.leer };
  const [kopf, ...zeilen] = saetze;
  if (zeilen.length === 0) return { ok: false, text: IMPORT_TEXT.nurKopf };
  if (zeilen.length > IMPORT_ZEILEN_MAX) return { ok: false, text: IMPORT_TEXT.zuGross };
  return { ok: true, tabelle: { kopf: kopf.werte, zeilen } };
}

// ── Spalten erkennen ────────────────────────────────────────────────────────

export type ImportAngabe = "vorname" | "nachname" | "geburtsdatum" | "jsNummer";

export const IMPORT_ANGABEN: { angabe: ImportAngabe; label: string }[] = [
  { angabe: "vorname", label: "Vorname" },
  { angabe: "nachname", label: "Nachname" },
  { angabe: "geburtsdatum", label: "Geburtsdatum" },
  { angabe: "jsNummer", label: "J+S-Nummer" },
];

/** Welche Spalte (Index) für welche Angabe gilt; `null`: keine. */
export type Zuordnung = Record<ImportAngabe, number | null>;

/** Die Köpfe, an denen der Import eine Angabe erkennt — verglichen ohne
 *  Gross/Klein, Akzente, Leer- und Satzzeichen. Je Angabe Gruppen nach
 *  Vorrang: Ein Jahrgang geht einem Geburtsdatum vor (#455 PO 4). «Name»
 *  ist der Nachname, wie im Kader-Export von ClubCorner. */
const KOEPFE: Record<ImportAngabe, string[][]> = {
  vorname: [["vorname", "vornamen", "rufname", "prenom", "firstname", "givenname"]],
  nachname: [["nachname", "name", "familienname", "nom", "lastname", "surname", "familyname"]],
  geburtsdatum: [
    ["jahrgang", "jg", "geburtsjahr", "anneedenaissance", "birthyear"],
    ["geburtsdatum", "gebdatum", "geb", "geburtstag", "datedenaissance", "birthdate", "dateofbirth", "dob"],
  ],
  jsNummer: [["jsnummer", "jsnr", "jspersonennummer", "jsid"]],
};

/** Ein Spaltenkopf in Vergleichsform: «J+S-Nummer» → «jsnummer». */
export function kopfSchluessel(kopf: string): string {
  return kopf.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Die Spalten, die KiFu selbst erkennt (#455 AK 5–8). Passen mehrere Spalten
 *  gleich gut, bleibt die Angabe offen (AK 7), ebenso jede Spalte, die schon
 *  eine andere Angabe trägt. */
export function erkenneSpalten(kopf: string[]): Zuordnung {
  const schluessel = kopf.map(kopfSchluessel);
  const z: Zuordnung = { vorname: null, nachname: null, geburtsdatum: null, jsNummer: null };
  for (const { angabe } of IMPORT_ANGABEN) {
    for (const gruppe of KOEPFE[angabe]) {
      const treffer = schluessel.flatMap((s, i) => (gruppe.includes(s) ? [i] : []));
      if (treffer.length === 0) continue;
      if (treffer.length === 1) z[angabe] = treffer[0];
      break;
    }
  }
  return z;
}

/** Vorname, Nachname und Geburtsdatum brauchen je eine Spalte (AK 13). */
export function zuordnungVollstaendig(z: Zuordnung): boolean {
  return z.vorname !== null && z.nachname !== null && z.geburtsdatum !== null;
}

/** Ein Beispielwert je Spalte, für die Auswahl der Zuordnung. */
export function beispielVon(t: CsvTabelle, spalte: number): string {
  return t.zeilen.find((z) => (z.werte[spalte] ?? "") !== "")?.werte[spalte] ?? "";
}

// ── Angaben herleiten ───────────────────────────────────────────────────────

/** Der Jahrgang aus einem Jahrgang oder einem Geburtsdatum mit vierstelliger
 *  Jahreszahl (#455 AK 8, 17), etwa «07.04.2016», «7.4.2016», «2016-04-07»
 *  oder «2016»; eine angehängte Uhrzeit stört nicht. Sonst `null`. */
export function jahrgangAusDatum(roh: string): number | null {
  const t = roh.trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2})?$/, "");
  const jahr =
    /^(\d{4})$/.exec(t)?.[1] ??
    /^\d{1,2}[./-]\d{1,2}[./-](\d{4})$/.exec(t)?.[1] ??
    /^(\d{4})[./-]\d{1,2}[./-]\d{1,2}$/.exec(t)?.[1];
  return jahr ? jahrgangAus(jahr) : null;
}

/** Die J+S-Nummer einer Zelle: nur 1 bis 20 Ziffern (#455 AK 19). Alles
 *  andere — «k.A.», «-», eine AHV-Nummer mit Punkten — gilt wie eine leere
 *  Zelle und wird genannt. */
export function jsAus(roh: string): { wert: string | null; ungueltig: boolean } {
  const t = roh.trim();
  if (t === "") return { wert: null, ungueltig: false };
  return new RegExp(`^\\d{1,${JS_MAX}}$`).test(t) ? { wert: t, ungueltig: false } : { wert: null, ungueltig: true };
}

/** Was an den Server geht: die vier Angaben je Zeile, sonst nichts. */
export type ImportEintrag = { zeile: number; vorname: string; nachname: string; jahrgang: number; jsNummer: string | null };

/** Eine Zeile, die der Import auslässt oder deren J+S-Nummer er nicht nimmt. */
export type ImportHinweis = { zeile: number; name: string; text: string; ausgelassen: boolean };

/** Die Angaben aller Zeilen nach der Zuordnung, und was an Zeilen nicht passt
 *  (#455 AK 17–20). Zeilen ohne jede zugeordnete Angabe fallen still weg. */
export function importZeilen(t: CsvTabelle, z: Zuordnung): { eintraege: ImportEintrag[]; hinweise: ImportHinweis[] } {
  const eintraege: ImportEintrag[] = [];
  const hinweise: ImportHinweis[] = [];
  const zelle = (zeile: CsvZeile, spalte: number | null) => (spalte === null ? "" : (zeile.werte[spalte] ?? ""));
  for (const zeile of t.zeilen) {
    const vorname = bereinigeName(zelle(zeile, z.vorname));
    const nachname = bereinigeName(zelle(zeile, z.nachname));
    const geburt = zelle(zeile, z.geburtsdatum);
    const js = zelle(zeile, z.jsNummer);
    if (!vorname && !nachname && !geburt && !js) continue;
    const name = `${vorname} ${nachname}`.trim();
    const jahrgang = jahrgangAusDatum(geburt);
    const problem = spielerProblem({ vorname, nachname, jahrgang: jahrgang ?? "" });
    if (problem) {
      const text =
        problem.feld === "vorname"
          ? IMPORT_TEXT.vorname
          : problem.feld === "nachname"
            ? IMPORT_TEXT.nachname
            : geburt.trim()
              ? IMPORT_TEXT.geburt(geburt.trim())
              : IMPORT_TEXT.geburtFehlt;
      hinweise.push({ zeile: zeile.nr, name, text, ausgelassen: true });
      continue;
    }
    const j = jsAus(js);
    if (j.ungueltig) hinweise.push({ zeile: zeile.nr, name, text: IMPORT_TEXT.js(js.trim()), ausgelassen: false });
    eintraege.push({ zeile: zeile.nr, vorname, nachname, jahrgang: jahrgang!, jsNummer: j.wert });
  }
  return { eintraege, hinweise };
}

// ── Vorschau und Ergebnis ───────────────────────────────────────────────────

/** Ein Team einer bestehenden Spieler:in; ohne Team: leere Liste. */
export type ImportTeam = { id: string; name: string };

/** Wie die Datenebene die Zeilen einordnet (`verein_spieler_importieren`,
 *  Vertrag Story #585): Zeilen, die eine spätere Zeile derselben Spieler:in
 *  überstimmt, fehlen still (#455 AK 21). Alle Listen aufsteigend nach
 *  `zeile`, die Teams nach Namen. `bestand`: so viele führt der Verein jetzt;
 *  `ueber`: um wie viele er mit den Neuen über der Grenze läge (0, wenn es
 *  passt oder niemand neu ist). `mehrfach`: mehrere Einträge im Verein
 *  tragen dieselben Angaben — die Teams sind die Vereinigung aller. */
export type ImportVorschau = {
  bestand: number;
  ueber: number;
  neu: number[];
  js: { zeile: number; alt: string | null; teams: ImportTeam[] }[];
  gleich: { zeile: number; teams: ImportTeam[] }[];
  mehrfach: { zeile: number; teams: ImportTeam[] }[];
};

/** Was die Oberfläche nach der Vorschau bestätigt: Weicht die Einordnung bei
 *  der Übernahme davon ab, übernimmt die Datenebene nichts (#585 AK 9). */
export type ImportErwartet = { neu: number[]; js: number[]; mehrfach: number[] };

/** Die Antwort der Übernahme: übernommen, oder nichts geändert, weil der
 *  Bestand die Vorschau überholt hat (`grund`) — dann mit der neuen Vorschau. */
export type ImportAusgang =
  | { status: "uebernommen"; neu: number; js: number }
  | { status: "veraltet"; grund: "bestand" | "grenze"; vorschau: ImportVorschau };

export function erwartetVon(v: ImportVorschau): ImportErwartet {
  return { neu: v.neu, js: v.js.map((j) => j.zeile), mehrfach: v.mehrfach.map((m) => m.zeile) };
}

/** Ein Objekt der Antwort, oder `null`. */
const objekt = (x: unknown): Record<string, unknown> | null =>
  typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const ganz = (x: unknown): x is number => Number.isInteger(x);
const teamsForm = (x: unknown): x is ImportTeam[] =>
  Array.isArray(x) && x.every((t) => typeof objekt(t)?.id === "string" && typeof objekt(t)?.name === "string");
/** Eine Liste von Einträgen mit Zeilennummer und Teams, je mit `weiter` geprüft. */
const eintraegeForm = (x: unknown, weiter: (e: Record<string, unknown>) => boolean = () => true) =>
  Array.isArray(x) &&
  x.every((e) => {
    const o = objekt(e);
    return o !== null && ganz(o.zeile) && teamsForm(o.teams) && weiter(o);
  });

/** Die Vorschau in der Form der Datenebene, die Teams in deutscher Ordnung —
 *  oder `null`, wenn die Antwort diese Form nicht hat (der Kern meldet dann
 *  einen technischen Fehler statt einer falschen Vorschau, wie die
 *  Spielerliste des Vereins). Weitere Schlüssel (`status`) zählen nicht. */
export function vorschauAus(antwort: unknown): ImportVorschau | null {
  const r = objekt(antwort);
  if (
    !r ||
    !ganz(r.bestand) ||
    !ganz(r.ueber) ||
    !Array.isArray(r.neu) ||
    !r.neu.every(ganz) ||
    !eintraegeForm(r.js, (e) => e.alt === null || typeof e.alt === "string") ||
    !eintraegeForm(r.gleich) ||
    !eintraegeForm(r.mehrfach)
  )
    return null;
  const roh = r as ImportVorschau;
  const teams = (t: ImportTeam[]) => t.map((x) => ({ id: x.id, name: x.name })).sort((a, b) => nachTeamname(a.name, b.name));
  return {
    bestand: roh.bestand,
    ueber: roh.ueber,
    neu: [...roh.neu],
    js: roh.js.map((j) => ({ zeile: j.zeile, alt: j.alt, teams: teams(j.teams) })),
    gleich: roh.gleich.map((g) => ({ zeile: g.zeile, teams: teams(g.teams) })),
    mehrfach: roh.mehrfach.map((m) => ({ zeile: m.zeile, teams: teams(m.teams) })),
  };
}

/** Die Antwort der Übernahme (`status` `uebernommen` oder `veraltet`) als
 *  Ausgang — oder `null`, wenn sie keine dieser Formen hat. */
export function ausgangAus(antwort: unknown): ImportAusgang | null {
  const r = objekt(antwort);
  if (r?.status === "uebernommen")
    return ganz(r.neu) && ganz(r.js) ? { status: "uebernommen", neu: r.neu, js: r.js } : null;
  if (r?.status !== "veraltet" || (r.grund !== "bestand" && r.grund !== "grenze")) return null;
  const vorschau = vorschauAus(r.vorschau);
  return vorschau ? { status: "veraltet", grund: r.grund, vorschau } : null;
}

/** Bestätigen lässt sich nur, was etwas ändert: eine neue Spieler:in oder eine
 *  geänderte J+S-Nummer — `mehrfach` allein genügt nicht (#585 AK 5) — und
 *  nur, solange der Verein mit den Neuen unter der Grenze bleibt (AK 6). */
export function importUebernehmbar(v: ImportVorschau): boolean {
  return v.ueber === 0 && v.neu.length + v.js.length > 0;
}

/** Die Grenze des Vereins ist erreicht (AK 6): mit der Zahl, um die er
 *  darüber läge. */
export function importUeberGrenzeText(v: ImportVorschau): string {
  const wer = v.neu.length === 1 ? "dieser neuen Spieler:in" : `diesen ${v.neu.length} neuen`;
  return `Mit ${wer} wären es ${v.bestand + v.neu.length} Spieler:innen, ${v.ueber} mehr als ${VEREIN_SPIELER_MAX}. Nichts übernommen. Entferne Zeilen aus der Datei oder lösche zuerst Spieler:innen.`;
}

/** Vor der Übernahme (AK 3, 4): wie viele neu sind, dass sie ohne Team
 *  bleiben und wer sie sieht. «Danach sind es x von 1000» gibt es nur, wenn sie
 *  hineinpassen. */
export function importNeuText(neu: number, bestand: number, verein: string): string {
  const [kommen, sehen] =
    neu === 1
      ? ["1 Spieler:in kommt neu", "sehen sie mit Name und Jahrgang; löschen lässt sie sich nur einzeln"]
      : [`${neu} Spieler:innen kommen neu`, "sehen sie mit Name und Jahrgang; löschen lassen sie sich nur einzeln"];
  return `${kommen} in den ${verein}, ohne Team. Alle Trainer:innen des Vereins ${sehen}. Danach sind es ${spielerVonText(bestand + neu)}.`;
}

/** Zeilen, die im Verein mehrfach geführt werden (AK 5): eine Einzelne mit
 *  Namen und Teams, mehrere in einem Satz über der Tabelle. */
export function importMehrfachText(zeilen: { name: string; jahrgang: number; teams: ImportTeam[] }[]): string {
  if (zeilen.length !== 1) return IMPORT_TEXT.mehrfachViele;
  const [z] = zeilen;
  const teams = z.teams.length > 0 ? ` (${aufzaehlung(z.teams.map((t) => t.name))})` : "";
  return `${z.name}, ${z.jahrgang}, wird mehrfach im Verein geführt${teams}. KiFu ändert bei keinem dieser Einträge die J+S-Nummer.`;
}

/** Der Satz, wenn nichts zu übernehmen ist; Mehrfachgeführte ändert KiFu nie. */
export function importNichtsZuTunText(mehrfach: number): string {
  return mehrfach > 0 ? `${IMPORT_TEXT.nichtsZuTun} ${IMPORT_TEXT.nichtsZuTunMehrfach}` : IMPORT_TEXT.nichtsZuTun;
}

/** Die Meldung nach der Übernahme (AK 10): Zahlen, und dass die Neuen ohne
 *  Team sind — dort hängt die Aktion «Zuordnen». */
export function importErgebnisText(r: { neu: number; js: number }): string {
  const spieler = (n: number) => (n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`);
  const teile: string[] = [];
  if (r.neu > 0) teile.push(`${spieler(r.neu)} aufgenommen`);
  if (r.js > 0) teile.push(r.neu > 0 ? `bei ${r.js} die J+S-Nummer geändert` : `Bei ${spieler(r.js)} die J+S-Nummer geändert`);
  const ohneTeam = r.neu === 0 ? "" : r.neu === 1 ? " Sie ist ohne Team." : " Die neuen sind ohne Team.";
  return `${teile.join(", ")}.${ohneTeam}`;
}
