/* Breite der zweiten Spalte (Einordnung einer Übung, Epic #350) als Cookie —
   wie die Breite der Seitenleiste (`lib/seitenleiste.ts`): Der Server liest es
   im Layout, damit die Spalte schon im ersten HTML in der gewählten Breite
   steht; der Client schreibt es, wenn der Trainer sie verschoben hat. Reine
   UI-Vorliebe, darum ohne `httpOnly`. */

export const SPALTE_COOKIE = "kifu-spalte";

/** Die Grenzen beim Ziehen, in Pixeln. Schmaler trüge die Liste ihre
 *  Bezeichnungen nicht mehr neben den Werten, breiter liesse dem Inhalt auf
 *  einem Laptop zu wenig Platz. Zusätzlich nimmt die Spalte nie mehr als die
 *  Hälfte der Fläche ein. */
export const SPALTE_MIN = 288;
export const SPALTE_MAX = 640;

/** Ein Jahr: Die Wahl gilt, bis sie jemand ändert. */
const SPALTE_MAX_AGE = 60 * 60 * 24 * 365;

/** Die gespeicherte Breite oder `null` (fehlt, unlesbar, ausserhalb der
 *  Grenzen) — dann gilt die Vorgabe, die mit dem Fenster mitwächst. */
export function leseSpalte(wert: string | undefined): number | null {
  const px = Number(wert);
  return Number.isFinite(px) && px >= SPALTE_MIN && px <= SPALTE_MAX ? Math.round(px) : null;
}

/** `null` löscht das Cookie: zurück zur Vorgabe. */
export function spalteCookie(px: number | null): string {
  return px === null
    ? `${SPALTE_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${SPALTE_COOKIE}=${Math.round(px)}; path=/; max-age=${SPALTE_MAX_AGE}; samesite=lax`;
}

/** Eine Breite in die Grenzen holen; `flaeche` ist die Breite beider Spalten. */
export function begrenzeSpalte(px: number, flaeche: number): number {
  return Math.round(Math.min(Math.max(px, SPALTE_MIN), SPALTE_MAX, Math.max(SPALTE_MIN, flaeche / 2)));
}
