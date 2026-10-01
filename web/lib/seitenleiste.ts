/* Breite der Seitenleiste als Cookie: Der Server liest es im Layout, damit
   die Leiste schon im ersten HTML in der gewählten Breite steht; der Client
   schreibt es beim Umschalten. Reine UI-Vorliebe, keine Personenangabe —
   darum ohne `httpOnly`. */

export const LEISTE_COOKIE = "kifu-leiste";

/** Ein Jahr: Die Wahl gilt, bis sie jemand ändert. */
const LEISTE_MAX_AGE = 60 * 60 * 24 * 365;

/** Nur „slim" zählt als schmal; alles andere (fehlt, veraltet) ist breit. */
export function leseLeiste(wert: string | undefined): boolean {
  return wert === "slim";
}

export function leisteCookie(slim: boolean): string {
  return `${LEISTE_COOKIE}=${slim ? "slim" : "breit"}; path=/; max-age=${LEISTE_MAX_AGE}; samesite=lax`;
}
