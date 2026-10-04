/* Gruppen-Kopfzeilen in Auswahlpanels — geteilt von Select, MultiSelect und
   AuswahlFilter. Eine Dimension, deren Werte aus zwei Welten stammen
   (Kinder- und Juniorenfussball), führt ihre Werte unter je einer nicht
   wählbaren Kopfzeile. Die Kopfzeile entsteht positional, sobald `group`
   wechselt — die Optionen müssen darum gruppensortiert übergeben werden.

   Die Kopfzeile ist für die Vorlesehilfe strukturell unsichtbar; ohne Verweis
   erführe eine Screenreader-Nutzerin nie, zu welcher Gruppe ein Wert gehört.
   Jede Option zeigt darum per `aria-describedby` auf ihre Kopfzeile:
   vorgelesen wird «<Wert>, <Gruppe>». */

export const gruppenKopfKlasse = "px-3 pb-1 pt-2 type-label-small text-on-surface-mittel";

/** Die Gruppe, deren Kopfzeile vor der Option `i` steht — oder null, wenn die
 *  Option dieselbe Gruppe trägt wie ihre Vorgängerin. */
export function gruppenKopf(optionen: readonly { group?: string }[], i: number): string | null {
  const g = optionen[i]?.group;
  return g && g !== optionen[i - 1]?.group ? g : null;
}

/** Die id der Kopfzeile einer Gruppe, eindeutig je Feld (`basis`). */
export function gruppenIdVon(basis: string, gruppe: string): string {
  return `${basis}-gruppe-${gruppe.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`;
}
