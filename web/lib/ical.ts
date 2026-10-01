// Das Kalender-Abo als iCalendar (RFC 5545) — Team-Kalender #330.
//
// Zeiten gehen als Wanduhrzeit mit TZID=Europe/Zurich hinaus, samt der
// Zeitzonen-Definition: So erscheint ein Termin im Kalenderprogramm zum selben
// Zeitpunkt wie in der Schweiz, auch wenn das Gerät eine andere Zeitzone nutzt
// (PC 4), und die Zeitumstellung verschiebt nichts. Je Termin gehen nur Titel,
// Beginn, Ende, Ort und der Verweis in die Anwendung hinaus (PC 2).
//
// REIN: importiert nur lib/serie.ts.
import { plusTage } from "@/lib/serie";

export type AboTermin = {
  id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  /** Zeitpunkt der letzten Änderung (timestamptz, ISO). */
  geaendert: string;
};

/** Ein Termin mit Beginn, aber ohne Ende dauert im Abo 90 Minuten (PC 3). */
export const ABO_DAUER_MIN = 90;

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
    .replace(/;/g, "\;")
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

function plusMinuten(datum: string, zeit: string, min: number): { datum: string; zeit: string } {
  const [h, m] = hhmm(zeit).split(":").map(Number);
  const gesamt = h * 60 + m + min;
  const rest = gesamt % 1440;
  return {
    datum: plusTage(datum, Math.floor(gesamt / 1440)),
    zeit: `${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`,
  };
}

/** Der Pfad des Feeds zu einem Abo-Token. */
export const aboDatei = (token: string) => `${token}.ics`;
export const aboPfad = (token: string) => `/api/kalender/${aboDatei(token)}`;

export function kalenderText(k: {
  kalenderName: string;
  /** «Training · Teamname» (PC 2). */
  titel: string;
  teamId: string;
  origin: string;
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
    const verweis = `${k.origin}/team/${k.teamId}/termin/${t.id}`;
    // PC 6: Die UID ist die Kennung des Termins — ein geänderter, verschobener
    // oder in eine neue Serie übergegangener Termin erscheint genau einmal.
    z.push("BEGIN:VEVENT", `UID:${t.id}@ki-fu.ch`, `DTSTAMP:${utc(k.jetzt.toISOString())}`, `LAST-MODIFIED:${utc(t.geaendert)}`);
    if (!t.beginn) {
      z.push(`DTSTART;VALUE=DATE:${kompakt(t.datum)}`, `DTEND;VALUE=DATE:${kompakt(plusTage(t.datum, 1))}`);
    } else {
      // Die Datenbank erzwingt «Ende nach Beginn» (tt_ende_nach_beginn); ein
      // Ende, das es nicht ist, gilt wie «ohne Ende» — nie ein DTEND vor dem
      // DTSTART, das Kalenderprogramme verwerfen.
      const hatEnde = t.ende !== null && hhmm(t.ende) > hhmm(t.beginn);
      const ende = hatEnde ? { datum: t.datum, zeit: t.ende as string } : plusMinuten(t.datum, t.beginn, ABO_DAUER_MIN);
      z.push(`DTSTART;TZID=Europe/Zurich:${lokal(t.datum, t.beginn)}`, `DTEND;TZID=Europe/Zurich:${lokal(ende.datum, ende.zeit)}`);
    }
    z.push(`SUMMARY:${textEscape(k.titel)}`);
    if (t.ort) z.push(`LOCATION:${textEscape(t.ort)}`);
    z.push(`URL:${verweis}`, `DESCRIPTION:${textEscape(verweis)}`, "END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}
