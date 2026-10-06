/* Breite des Verzeichnisses auf «Versionen» (#408) als Cookie — wie die
   Breite der Spalte (`lib/spalte.ts`): Der Server liest es, damit das
   Verzeichnis schon im ersten HTML in der gewählten Breite steht; der Client
   schreibt es, wenn es jemand verschoben hat. Reine UI-Vorliebe, darum ohne
   `httpOnly`. */

export const VERZEICHNIS_COOKIE = "kifu-verzeichnis";

/** Die Grenzen beim Ziehen, in Pixeln: schmaler trüge eine Zeile kaum noch
 *  ihr Thema, breiter liesse den Texten zu wenig Platz. Höchstens die halbe
 *  Fläche. Ohne gezogene Wahl gilt `VERZEICHNIS_VORGABE`. */
export const VERZEICHNIS_MIN = 176;
export const VERZEICHNIS_MAX = 480;
export const VERZEICHNIS_VORGABE = 256;

/** Ein Jahr: Die Wahl gilt, bis sie jemand ändert. */
const VERZEICHNIS_MAX_AGE = 60 * 60 * 24 * 365;

/** Die gespeicherte Breite oder `null` (fehlt, unlesbar, ausserhalb der Grenzen). */
export function leseVerzeichnis(wert: string | undefined): number | null {
  const px = Number(wert);
  return Number.isFinite(px) && px >= VERZEICHNIS_MIN && px <= VERZEICHNIS_MAX
    ? Math.round(px)
    : null;
}

/** `null` löscht das Cookie: zurück zur Vorgabe. */
export function verzeichnisCookie(px: number | null): string {
  return px === null
    ? `${VERZEICHNIS_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${VERZEICHNIS_COOKIE}=${Math.round(px)}; path=/; max-age=${VERZEICHNIS_MAX_AGE}; samesite=lax`;
}

/** Eine Breite in die Grenzen holen; `flaeche` ist die Breite beider Spalten. */
export function begrenzeVerzeichnis(px: number, flaeche: number): number {
  return Math.round(
    Math.min(Math.max(px, VERZEICHNIS_MIN), VERZEICHNIS_MAX, Math.max(VERZEICHNIS_MIN, flaeche / 2)),
  );
}
