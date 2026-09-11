/**
 * Vom Trainer gesetzte Reihenfolgen (#209) — reine Fachlogik ohne Server-Bezug.
 *
 * Varianten des Hauptteils (#202) und Gruppen eines Trainings (#209) tragen
 * beide eine Ordnung, und beide ändern sie auf dieselbe Weise: ein Tausch mit
 * dem Nachbarn, am Rand ohne Wirkung. Diese Datei ist die eine Stelle, an der
 * das steht — die Oberfläche rechnet damit den Zustand nach dem Klick voraus
 * (optimistisch), die Datenbank führt ihn aus.
 *
 * SQL-Zwillinge: `verschiebe_gruppe()` und `verschiebe_variante()`. Dort
 * geschieht der Tausch über den Zwischenwert -1, weil die Position je Training
 * eindeutig ist; hier braucht es den Umweg nicht — eine Liste hat keinen
 * Unique-Index.
 */

/**
 * Ein Element mit seinem Nachbarn tauschen: `dir = -1` nach vorne, `dir = 1`
 * nach hinten.
 *
 * Am Rand (und bei einem Index ausserhalb der Liste) geschieht nichts. Die
 * Eingabe wird NIE verändert — zurück kommt immer eine neue Liste, auch im
 * Fall ohne Wirkung. Eine Funktion, die mal dieselbe Referenz und mal eine
 * neue liefert, wäre in React eine Falle: Der eine Fall löste ein Neuzeichnen
 * aus, der andere nicht, und welcher gerade vorliegt, sähe man dem Aufruf
 * nicht an.
 */
export function verschoben<T>(liste: readonly T[], index: number, dir: -1 | 1): T[] {
  const kopie = liste.slice();
  const ziel = index + dir;
  if (index < 0 || index >= kopie.length || ziel < 0 || ziel >= kopie.length) return kopie;
  [kopie[index], kopie[ziel]] = [kopie[ziel], kopie[index]];
  return kopie;
}

/**
 * Haben zwei Folgen denselben Inhalt in derselben Reihenfolge?
 *
 * Gebraucht, wo eine optimistisch vorausgerechnete Ordnung gegen die
 * tatsächlich gespeicherte gehalten wird: Stimmen sie überein, ist nichts zu
 * schicken — und nach der Antwort des Servers ist nichts zurückzunehmen.
 */
export function gleicheFolge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
