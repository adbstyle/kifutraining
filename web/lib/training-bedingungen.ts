// Die Bedingungen, die ein öffentliches Training erfüllen muss — und ihre
// Übersetzung in Klartext (Story A).
//
// Sie gelten nicht nur beim Öffentlich-Schalten, sondern solange ein Training
// öffentlich ist. Durchgesetzt werden sie in der Datenbank; diese Datei hält
// die Prüfung für die Vorab-Meldung und die Übersetzung des DB-Fehlers, damit
// beide Seiten dieselbe Regel nennen statt zweier Formulierungen davon.

/** Marker, mit dem die Datenebene eine verletzte Bedingung meldet. */
const BEDINGUNG_MARKER = "TRAINING_UNVOLLSTAENDIG";

/** Die Bedingungen — in der Reihenfolge, in der die Datenebene sie prüft. */
export type Bedingung = "stufe" | "einleitung" | "freies_spiel";

/** Was fehlt, aus Sicht des Trainers. Ergänzt den Satz «Es fehlt …». */
export const BEDINGUNG_FEHLT: Record<Bedingung, string> = {
  stufe: "mindestens eine Alterskategorie",
  einleitung: "mindestens eine Übung in der Einleitung",
  freies_spiel: "mindestens eine Übung im freien Spiel",
};

/** Die Hauptteilkategorie des freien Spiels. Es liegt im Hauptteil — die
 *  Bedingung deckt «mindestens eine Übung im Hauptteil» damit zwingend mit ab. */
export const FREIES_SPIEL = "fussball-spielen";

function istBedingung(wert: string): wert is Bedingung {
  return wert in BEDINGUNG_FEHLT;
}

/** Die verletzte Bedingung aus einer DB-Fehlermeldung, oder `null` wenn der
 *  Fehler ein anderer war. */
export function bedingungAusFehler(message: string): Bedingung | null {
  if (!message.includes(BEDINGUNG_MARKER)) return null;
  const teil = message.split(`${BEDINGUNG_MARKER}:`).pop()?.trim() ?? "";
  // Der Marker steht am Ende der Meldung, kann aber von Kontextzeilen gefolgt
  // sein — nur das erste Wort ist die Bedingung.
  const wort = teil.split(/\s/)[0] ?? "";
  return istBedingung(wort) ? wort : null;
}

/** Die Meldung für eine Änderung, die ein öffentliches Training unter die
 *  Bedingungen gebracht hätte. Nennt den Weg, nicht nur die Absage (AK 7). */
function bedingungsMeldung(bedingung: Bedingung): string {
  return (
    `Ein öffentliches Training braucht ${BEDINGUNG_FEHLT[bedingung]}. ` +
    "Setze es zuerst auf Entwurf, wenn du es so ändern willst."
  );
}

/** Verletzte ein DB-Fehler eine Bedingung? Dann die Meldung dazu, sonst `null`.
 *  Für jede Action, die ein Training oder seine Fassungen ändert. */
function bedingungsFehler(message: string): string | null {
  const bedingung = bedingungAusFehler(message);
  return bedingung ? bedingungsMeldung(bedingung) : null;
}

/** Die Meldung zu einem DB-Fehler: die Bedingungs-Erklärung, wenn es eine ist,
 *  sonst der Originaltext. Für jede Action, die ein Training oder eine seiner
 *  Fassungen so ändern könnte, dass ein öffentliches Training unter die
 *  Bedingungen fiele. */
export function fehlerMeldung(message: string): string {
  return bedingungsFehler(message) ?? message;
}
