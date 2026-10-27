// Das Kalender-Abo als iCalendar (RFC 5545) — Team-Kalender #330.
//
// Zeiten gehen als Wanduhrzeit mit TZID=Europe/Zurich hinaus, samt der
// Zeitzonen-Definition: So erscheint ein Termin im Kalenderprogramm zum selben
// Zeitpunkt wie in der Schweiz, auch wenn das Gerät eine andere Zeitzone nutzt
// (PC 4), und die Zeitumstellung verschiebt nichts. Je Termin gehen nur Titel,
// Beginn, Ende, Ort und der Verweis in die Anwendung hinaus (PC 2) — beim Abo
// einer Spielervertretung (#506) statt des Verweises eine Beschreibung und
// der Status ihrer Spieler:in; die Beschreibung trägt bei Spielen Treffpunkte
// und Bemerkung so, wie Mitglieder sie geschrieben haben.
//
// REIN: importiert nichts; dazu zwei Antwort-Helfer der Feed-Routen.

export type AboTermin = {
  id: string;
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  /** Der Kartenlink zum Ort (#533 PC 4); steht in der Beschreibung, weil
   *  `URL` der Verweis in die Anwendung ist. */
  ortLink?: string | null;
  /** Zeitpunkt der letzten Änderung (timestamptz, ISO). Ohne ihn keine
   *  LAST-MODIFIED: Der Stand einer Spieler:in ändert sich, ohne dass der
   *  Termin es tut (#506). */
  geaendert?: string;
  /** «Training · Teamname» (#330 PC 2), ein Spiel «Bezeichnung · Teamname»
   *  (#459 PC 1), am privaten Link mit dem Status vorn (#507 AK 6). */
  titel: string;
  /** Freitext für DESCRIPTION, vor einem Verweis. */
  beschreibung?: string;
  /** STATUS des Eintrags (RFC 5545 3.8.1.11). CANCELLED bewusst nicht:
   *  Google Kalender verschluckt solche Einträge teils ganz (#506). */
  status?: "CONFIRMED" | "TENTATIVE";
  /** Als «frei» eintragen (TRANSP:TRANSPARENT), etwa abgesagt (#506). */
  frei?: boolean;
};

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Zurich",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** TEXT-Werte nach RFC 5545 3.3.11: Backslash, Semikolon und Komma bekommen
 *  einen Backslash, Zeilenumbrüche werden zu `\n`. */
export function textEscape(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Zeilen höchstens 75 Oktette (RFC 5545 3.1); Fortsetzungen beginnen mit
 *  einem Leerzeichen. Gezählt wird UTF-8, geteilt nie mitten im Zeichen. */
export function falten(zeile: string): string {
  const enc = new TextEncoder();
  const teile: string[] = [];
  let aktuell = "";
  let laenge = 0;
  for (const zeichen of zeile) {
    const n = enc.encode(zeichen).length;
    const grenze = teile.length === 0 ? 75 : 74;
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = "";
      laenge = 0;
    }
    aktuell += zeichen;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

const kompakt = (iso: string) => iso.replace(/-/g, "");
/** Uhrzeit auf `HH:MM` — eine `time`-Spalte liefert auch `HH:MM:SS`. */
const hhmm = (zeit: string) => zeit.slice(0, 5);
const lokal = (datum: string, zeit: string) => `${kompakt(datum)}T${hhmm(zeit).replace(":", "")}00`;
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Der Dateiname und der Pfad des Feeds zu einem Abo-Token; `bereich`
 *  trennt das Abo am privaten Link (`"spieler/"`, #507) von dem der Mitglieder. */
export const aboDatei = (token: string) => `${token}.ics`;
export const aboPfad = (token: string, bereich = "") => `/api/kalender/${bereich}${aboDatei(token)}`;

/** Das Token aus dem Dateinamen eines Feeds — 64 Hex-Zeichen, sonst `null`. */
export function aboTokenAus(datei: string): string | null {
  return /^([0-9a-f]{64})\.ics$/.exec(datei)?.[1] ?? null;
}

/** Der Name eines leeren Kalenders zu einer ungültigen oder erloschenen
 *  Adresse: So entfernen Programme, die das tun, die Einträge (#330 PC 9). */
export const ABO_ERLOSCHEN = "KiFu – Abo erloschen";

/** Die vollständige Abo-Adresse, wie man sie ins Kalenderprogramm einfügt. */
export const aboUrl = (origin: string, token: string, bereich?: string) => `${origin}${aboPfad(token, bereich)}`;

export function kalenderText(k: {
  kalenderName: string;
  /** Die Adresse eines Termins in der Anwendung (#330 PC 7); ohne sie kein
   *  Verweis — das Abo einer Spielervertretung verriete sonst ihren Link. */
  verweis?: (terminId: string) => string;
  /** Hängt sich an die UID: Dieselben Termine in mehreren Abos (zwei
   *  Spieler:innen eines Teams, Mitglied und Elternteil) bleiben je
   *  Kalender eigene Einträge. */
  uidZusatz?: string;
  termine: AboTermin[];
  jetzt: Date;
}): string {
  const z = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KiFu//Team-Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${textEscape(k.kalenderName)}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const t of k.termine) {
    // PC 7, 8: Der Verweis führt über eine eigene Adresse, die Anmeldung,
    // Rückblick und «nicht mehr vorhanden» auflöst.
    const verweis = k.verweis?.(t.id);
    // PC 6: Die UID ist die Kennung des Termins — ein geänderter, verschobener
    // oder in eine neue Serie übergegangener Termin erscheint genau einmal.
    const uid = k.uidZusatz ? `${t.id}.${k.uidZusatz}` : t.id;
    z.push("BEGIN:VEVENT", `UID:${uid}@ki-fu.ch`, `DTSTAMP:${utc(k.jetzt.toISOString())}`);
    if (t.geaendert) z.push(`LAST-MODIFIED:${utc(t.geaendert)}`);
    // Beginn und Ende sind Pflicht, das Ende liegt am selben Tag danach
    // (NOT NULL, `tt_ende_nach_beginn`).
    z.push(`DTSTART;TZID=Europe/Zurich:${lokal(t.datum, t.beginn)}`, `DTEND;TZID=Europe/Zurich:${lokal(t.datum, t.ende)}`);
    z.push(`SUMMARY:${textEscape(t.titel)}`);
    if (t.ort) z.push(`LOCATION:${textEscape(t.ort)}`);
    if (t.status) z.push(`STATUS:${t.status}`);
    if (t.frei) z.push("TRANSP:TRANSPARENT");
    if (verweis) z.push(`URL:${verweis}`);
    const beschreibung = [t.beschreibung, t.ortLink ? `Karte: ${t.ortLink}` : null, verweis].filter(Boolean).join("\n\n");
    if (beschreibung) z.push(`DESCRIPTION:${textEscape(beschreibung)}`);
    z.push("END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}

/** Der Feed als Antwort — nie zwischengespeichert, nicht für Suchmaschinen:
 *  Die Adresse IST das Geheimnis. */
export function kalenderAntwort(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="kifu.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Die Datenebene antwortet nicht: ein Fehler mit Wiederholung statt eines
 *  leeren Kalenders, der die Einträge im Programm löschen würde. Nur die
 *  Meldung der Datenbank ins Log, nie der Aufruf: Er trägt das Token. */
export function kalenderNichtErreichbar(meldung: string): Response {
  console.error("[abo]", meldung);
  return new Response("Der Kalender ist gerade nicht erreichbar.", {
    status: 503,
    headers: { "Retry-After": "300", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
