/**
 * Gruppen eines Trainings (Story #149) — reine Fachlogik ohne Server-Bezug.
 *
 * Eine Gruppe ist eine Bezeichnung am Training, mehr nicht: die Anwendung führt
 * keine Kinder und keine Kinderzahl. Was hier steht, entscheidet ausschliesslich,
 * welche Bezeichnung zulässig ist.
 *
 * Jede Regel nennt ihren SQL-Zwilling aus der Migration `training_gruppen`. Die
 * Datenbank ist die Trust-Boundary — diese Datei ist die frühe, sprechende
 * Antwort im Formular, nicht die Absicherung.
 */

/** Längstmögliche Bezeichnung einer Gruppe (getrimmt gezählt).
 *  SQL-Zwilling: `tg_name_laenge` an `training_gruppen`. */
export const GRUPPE_NAME_MAX = 40;

/**
 * Der Schlüssel, unter dem zwei Bezeichnungen als dieselbe gelten (AK 7).
 *
 * SQL-Zwilling: `lower(btrim(name))` im Unique-Index `tg_name_je_training`.
 * `toLocaleLowerCase("de")` statt `toLowerCase()`, damit die Kleinschreibung
 * derselben Sprache folgt wie die Anzeige — bei deutschen Bezeichnungen fallen
 * beide zusammen, aber die Absicht steht so im Code.
 */
export function gruppenSchluessel(name: string): string {
  return name.trim().toLocaleLowerCase("de");
}

/**
 * Der Satz, der eine bereits vergebene Bezeichnung ablehnt.
 *
 * Er entsteht an zwei Stellen — hier in der Vorabprüfung und in der Server
 * Action, wenn erst die Datenbank die Kollision sieht (`23505` am Unique-Index
 * `tg_name_je_training`). Beide Wege sollen dasselbe sagen, darum steht der
 * Satz nur einmal.
 */
export const MELDUNG_VERGEBEN = "Diese Bezeichnung gibt es in diesem Training schon.";

/**
 * Was einer Bezeichnung im Weg steht — `null`, wenn sie sich speichern lässt.
 *
 * `bestehende` sind alle Gruppen desselben Trainings. `eigeneId` schaltet beim
 * Umbenennen die eigene Zeile aus der Kollisionsprüfung aus: sonst wäre
 * «Gruppe 1» → «gruppe 1» ein Fehler gegen sich selbst (AK 8).
 *
 * Die Meldungen sind der Text am Feld, nicht ein Protokolleintrag — sie sagen,
 * was zu tun ist, und nennen die Regel, nicht die Spalte.
 */
export function nameProblem(
  name: string,
  bestehende: { id: string; name: string }[],
  eigeneId?: string,
): string | null {
  const getrimmt = name.trim();
  if (!getrimmt) return "Bitte eine Bezeichnung eingeben.";
  if (getrimmt.length > GRUPPE_NAME_MAX) return `Höchstens ${GRUPPE_NAME_MAX} Zeichen.`;
  const schluessel = gruppenSchluessel(getrimmt);
  const vergeben = bestehende.some(
    (g) => g.id !== eigeneId && gruppenSchluessel(g.name) === schluessel,
  );
  if (vergeben) return MELDUNG_VERGEBEN;
  return null;
}
