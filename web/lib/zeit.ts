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

/** Der heutige Kalendertag am Trainingsort als `YYYY-MM-DD`. */
export function heuteAmTrainingsort(): string {
  const teile = new Intl.DateTimeFormat("de-CH", {
    timeZone: TRAININGS_ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const wert = (typ: Intl.DateTimeFormatPartTypes) =>
    teile.find((p) => p.type === typ)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}
