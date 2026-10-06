/* Eine gezogene Breite als Cookie — für die Spalte der geteilten Fläche
   (`lib/spalte.ts`) und das Verzeichnis unter «Versionen»
   (`lib/verzeichnis.ts`). Der Server liest es, damit die Fläche schon im
   ersten HTML in der gewählten Breite steht; der Client schreibt es, wenn
   jemand sie verschoben hat. Reine UI-Vorliebe, darum ohne `httpOnly`. */

/** Ein Jahr: Die Wahl gilt, bis sie jemand ändert. */
const MAX_AGE = 60 * 60 * 24 * 365;

export function breitenCookie({ name, min, max }: { name: string; min: number; max: number }) {
  return {
    /** Die gespeicherte Breite oder `null` (fehlt, unlesbar, ausserhalb der
     *  Grenzen) — dann gilt die Vorgabe. */
    lese(wert: string | undefined): number | null {
      const px = Number(wert);
      return Number.isFinite(px) && px >= min && px <= max ? Math.round(px) : null;
    },
    /** `null` löscht das Cookie: zurück zur Vorgabe. */
    cookie(px: number | null): string {
      return px === null
        ? `${name}=; path=/; max-age=0; samesite=lax`
        : `${name}=${Math.round(px)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    },
    /** Eine Breite in die Grenzen holen; nie mehr als die halbe `flaeche`
     *  (die Breite beider Spalten). */
    begrenze(px: number, flaeche: number): number {
      return Math.round(Math.min(Math.max(px, min), max, Math.max(min, flaeche / 2)));
    },
  };
}
