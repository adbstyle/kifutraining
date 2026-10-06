// Länge und Breite einer Fläche in ganzen Metern — EINE Regel für die
// Spielfeldgrösse einer Übung und die Felder eines Termins (Epic #388 PO 6:
// «ganze Meter von 5 bis 120 wie bei Übungen»).
//
// SQL-Zwillinge: die CHECKs `ex_/te_spielfeld_paarweise` und
// `ex_/te_spielfeld_bereich` (Übungen) sowie `termin_felder_gueltig()`
// (Migration termin_felder).
//
// REIN: keine Importe — `check:kern` lädt diese Datei mit tsx.

/** Kleinste und grösste sinnvolle Kantenlänge in Metern.
 *
 *  Exportiert, damit die Eingabefelder dieselben Grenzen anbieten, die
 *  geprüft werden — sonst liefe das `min`/`max` eines Formulars von der Regel
 *  weg, ohne dass es jemandem auffiele. */
export const SPIELFELD_MIN = 5;
export const SPIELFELD_MAX = 120;

/** Die Meldungen der Regel — an Übung und Termin wortgleich. */
export const MASS_TEXT = {
  paarweise: "Bitte Länge und Breite angeben oder beides leer lassen.",
  bereich: `Länge und Breite in ganzen Metern, zwischen ${SPIELFELD_MIN} und ${SPIELFELD_MAX}.`,
} as const;
