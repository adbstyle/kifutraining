/**
 * Zeitrechnung für Trainingstermine.
 *
 * Datum und Beginn eines Termins sind ohne Zeitzone gespeichert: gemeint ist
 * die Uhr am Trainingsort. Der Trainingsort ist die Schweiz, also wird auch
 * „heute" dort gemessen — weder dort, wo der Server steht (auf Vercel UTC),
 * noch dort, wo gerade jemand hinschaut. Das hat zwei Gründe.
 *
 * Fachlich stimmt die Einteilung damit auch für eine Trainerin, die aus einer
 * anderen Zeitzone nachsieht: Das Training vom Mittwoch ist am Schweizer
 * Mittwoch vorbei, nicht am japanischen.
 *
 * Technisch ist es die Voraussetzung dafür, dass der Plan überhaupt in
 * Abschnitte zerfallen darf. Server und Browser rendern dieselbe Liste; würde
 * jeder „heute" selbst aus seiner eigenen Zeit bestimmen, käme zwischen
 * Mitternacht und 01:00 bzw. 02:00 Schweizer Zeit ein anderer Tag heraus. Die
 * Abschnitte wären dann serverseitig anders geschnitten als im Browser, und
 * genau solche Strukturunterschiede meldet React beim Hydrieren als Fehler.
 * Solange nur eine Karte gedämpft wurde, blieb das folgenlos; sobald Einträge
 * die Gruppe wechseln, springt die Liste sichtbar um.
 */

export const TRAININGS_ZEITZONE = "Europe/Zurich";

/** Der Kalendertag eines Zeitpunkts am Trainingsort als `YYYY-MM-DD` — auch
 *  für Zeitpunkte, die keine Termine sind (etwa wann ein KI-Zugang erlaubt
 *  wurde): kurz nach Mitternacht gehört zum Schweizer Tag, nicht zum UTC-Tag
 *  des Servers. Ein ungültiges Datum ergibt `""` statt «NaN-NaN-NaN». */
export function kalendertagAmTrainingsort(d: Date = new Date()): string {
  if (Number.isNaN(d.getTime())) return "";
  const teile = new Intl.DateTimeFormat("de-CH", {
    timeZone: TRAININGS_ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const wert = (typ: Intl.DateTimeFormatPartTypes) =>
    teile.find((p) => p.type === typ)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}

/** Der heutige Kalendertag am Trainingsort als `YYYY-MM-DD`. */
export function heuteAmTrainingsort(): string {
  return kalendertagAmTrainingsort();
}

/** Datum und Uhrzeit eines Zeitpunkts am Trainingsort als `YYYY-MM-DDTHH:MM`. */
export function jetztAmTrainingsort(d: Date = new Date()): string {
  const teile = new Intl.DateTimeFormat("de-CH", {
    timeZone: TRAININGS_ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const wert = (typ: Intl.DateTimeFormatPartTypes) => teile.find((p) => p.type === typ)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}T${wert("hour")}:${wert("minute")}`;
}

/** Hat ein Termin begonnen? Minutengenau an der Uhr am Trainingsort (Epic
 *  #433). Zwilling der SQL-Funktion `termin_begonnen`. `jetzt` gibt der
 *  Server mit, damit Server und Browser gleich entscheiden. */
export function terminBegonnen(datum: string, beginn: string, jetzt: string = jetztAmTrainingsort()): boolean {
  return `${datum}T${beginn.slice(0, 5)}` <= jetzt;
}

/**
 * Ein Termindatum als „Mi., 23.09.2026".
 *
 * Der Wochentag ist beim Planen die wichtigste Information und in der reinen
 * Zahlenform nicht ablesbar. Die Schreibweise ist in der ganzen Anwendung
 * dieselbe (NFR 3) — Plan, Durchführen-Ansicht, Bestand und Brotkrumen teilen
 * sich diesen einen Helfer.
 *
 * Der abgekürzte Wochentag trägt im Schweizer Deutsch einen Punkt — so
 * schreibt ihn `de-CH` selbst, und so steht er überall in der Anwendung.
 *
 * Bewusst fest auf `de-CH` und auf das Muster `T00:00:00`: Server und Browser
 * rendern dieselbe Zeichenkette, sonst meldete React beim Hydrieren einen
 * Unterschied. Ein unlesbares Datum kommt unverändert zurück, statt „Invalid
 * Date" anzuzeigen.
 */
export function datumKurz(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("de-CH", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

/** Tage zwischen zwei Kalendertagen (`YYYY-MM-DD`), in UTC gerechnet: Ein
 *  Kalendertag hat keine Zeitzone, die Zeitumstellung verschiebt so keinen Tag. */
function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}

/** Der Montag der Kalenderwoche eines Kalendertags, als Tage seit 1970. */
function wochenMontag(tag: string): number {
  const tage = Math.round(Date.parse(`${tag}T00:00:00Z`) / 86_400_000);
  // 1970-01-01 war ein Donnerstag: +3 macht den Montag zum Wochenanfang.
  return tage - ((((tage + 3) % 7) + 7) % 7);
}

const vor = (n: number, eins: string, mehr: string) => `vor ${n} ${n === 1 ? eins : mehr}`;

/**
 * Seit wann ein Zeitpunkt zurückliegt, für den letzten Statuswechsel einer
 * Spieler:in am Termin (#467 AK 3–10): «gerade eben», «vor 25 Minuten»,
 * «vor 3 Stunden» (heute), «gestern», «vorgestern», «diese Woche», «letzte
 * Woche», sonst das Datum. Passen zwei Stufen, gewinnt die feinste — die
 * Minuten gelten auch über Mitternacht, «gestern» auch am Montag für den
 * Sonntag (PO 2026-10-19).
 *
 * Minuten und Stunden zählen die verstrichene Zeit, abgerundet; Tage und
 * Wochen (Montag bis Sonntag) die Kalendertage am Trainingsort. `jetzt` gibt
 * der Server mit, damit Server und Browser dieselbe Zeichenkette rendern; die
 * Angabe gilt bis zum nächsten Laden.
 */
export function seitWann(zeitpunkt: string, jetzt: string): string {
  const t = new Date(zeitpunkt);
  const j = new Date(jetzt);
  const minuten = Math.floor((j.getTime() - t.getTime()) / 60_000);
  if (minuten < 1) return "gerade eben";
  if (minuten < 60) return vor(minuten, "Minute", "Minuten");
  const tag = kalendertagAmTrainingsort(t);
  const heute = kalendertagAmTrainingsort(j);
  const tage = tageZwischen(tag, heute);
  if (tage <= 0) return vor(Math.floor(minuten / 60), "Stunde", "Stunden");
  if (tage === 1) return "gestern";
  if (tage === 2) return "vorgestern";
  const wochen = (wochenMontag(heute) - wochenMontag(tag)) / 7;
  if (wochen === 0) return "diese Woche";
  if (wochen === 1) return "letzte Woche";
  return datumKurz(tag);
}
