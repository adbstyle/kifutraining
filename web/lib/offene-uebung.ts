/* Die geöffnete Übung eines Trainings (Epic #369, Story #371): Sie hat eine
   eigene Adresse, damit Neuladen, Lesezeichen und ein weitergegebener Link
   dieselbe Übung wieder im Detail zeigen (AK 10). Zusammenstellen und Ansicht
   tragen sie im selben Suchparameter. */

/** Der Name des Suchparameters der geöffneten Übung. */
export const UEBUNG_PARAM = "uebung";

/** Die Übung, die die Adresse meint — `undefined`, wenn das Training sie nicht
 *  (mehr) führt. Eine solche Adresse gilt wie die des Trainings ohne
 *  geöffnete Übung (AK 11). */
export function uebungAus<T extends { id: string }>(
  param: string | undefined,
  uebungen: readonly T[],
): T | undefined {
  return param ? uebungen.find((u) => u.id === param) : undefined;
}

/** Die Adresse an die geöffnete Übung angleichen — ohne Navigation, wie beim
 *  Wechsel der Variante: Öffnen und Schliessen sind eine Frage der Anzeige,
 *  alle Übungen stehen bereits im Speicher. Nur im Browser aufzurufen. */
export function schreibeUebungInAdresse(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(UEBUNG_PARAM, id);
  else url.searchParams.delete(UEBUNG_PARAM);
  if (url.href !== window.location.href) window.history.replaceState(null, "", url);
}
