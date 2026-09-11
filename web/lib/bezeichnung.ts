/**
 * Die Regel für vom Trainer vergebene Bezeichnungen innerhalb eines Trainings
 * (Epic #200) — reine Fachlogik ohne Server-Bezug.
 *
 * Zwei Objekte tragen heute eine solche Bezeichnung: die Gruppe (#149) und die
 * Variante des Hauptteils (#201). Die Regel ist bei beiden dieselbe — nicht
 * leer, getrimmt gezählt begrenzt, je Training eindeutig ohne Unterschied von
 * Gross- und Kleinschreibung — und steht darum genau einmal hier. Ihre
 * SQL-Zwillinge sind die Unique-Indizes `tg_name_je_training` bzw.
 * `tv_name_je_training` und die CHECKs `tg_name_laenge` bzw. `tv_name_laenge`.
 *
 * Die Datenbank bleibt die Trust-Boundary — diese Datei ist die frühe,
 * sprechende Antwort im Formular, nicht die Absicherung. Nur die Datenbank
 * kann zwei gleichzeitige Anlagen auseinanderhalten.
 */

/**
 * Der Schlüssel, unter dem zwei Bezeichnungen als dieselbe gelten.
 *
 * SQL-Zwilling: `lower(btrim(name))` in beiden Unique-Indizes.
 * `toLocaleLowerCase("de")` statt `toLowerCase()`, damit die Kleinschreibung
 * derselben Sprache folgt wie die Anzeige — bei deutschen Bezeichnungen fallen
 * beide zusammen, aber die Absicht steht so im Code.
 */
export function bezeichnungSchluessel(name: string): string {
  return name.trim().toLocaleLowerCase("de");
}

/**
 * Der Satz, der eine bereits vergebene Bezeichnung ablehnt.
 *
 * Er entsteht an zwei Stellen — hier in der Vorabprüfung und in der Server
 * Action, wenn erst die Datenbank die Kollision sieht (`23505` am
 * Unique-Index). Beide Wege sollen dasselbe sagen, darum steht der Satz nur
 * einmal.
 */
export const MELDUNG_VERGEBEN = "Diese Bezeichnung gibt es in diesem Training schon.";

/**
 * Was einer Bezeichnung im Weg steht — `null`, wenn sie sich speichern lässt.
 *
 * `bestehende` sind alle gleichartigen Objekte desselben Trainings. `eigeneId`
 * schaltet beim Umbenennen die eigene Zeile aus der Kollisionsprüfung aus:
 * sonst wäre «Gruppe 1» → «gruppe 1» ein Fehler gegen sich selbst.
 *
 * Die Meldungen sind der Text am Feld, nicht ein Protokolleintrag — sie sagen,
 * was zu tun ist, und nennen die Regel, nicht die Spalte.
 */
export function bezeichnungProblem(
  name: string,
  bestehende: readonly { id: string; name: string }[],
  opt: { eigeneId?: string; max: number },
): string | null {
  const getrimmt = name.trim();
  if (!getrimmt) return "Bitte eine Bezeichnung eingeben.";
  if (getrimmt.length > opt.max) return `Höchstens ${opt.max} Zeichen.`;
  const schluessel = bezeichnungSchluessel(getrimmt);
  const vergeben = bestehende.some(
    (b) => b.id !== opt.eigeneId && bezeichnungSchluessel(b.name) === schluessel,
  );
  if (vergeben) return MELDUNG_VERGEBEN;
  return null;
}
