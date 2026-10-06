/* Welche Releases dieser Browser schon gesehen hat (#410), als Cookie: der
   Zeitpunkt der Veröffentlichung des neuesten Releases, den die Seite
   «Versionen» hier angezeigt hat. Neu ist jeder Release, der danach
   veröffentlicht wurde — auch ein nachgeschobener Patch einer älteren Linie.
   Eine nachträgliche Korrektur ändert den Zeitpunkt nicht und gilt darum
   nicht als neu.

   Der Server liest das Cookie im Layout, damit die Markierung schon im ersten
   HTML stimmt; der Browser schreibt es (VersionenKontext). Pro Browser, nicht
   pro Konto, und ohne `httpOnly` wie die anderen UI-Cookies (siehe /cookies). */

export const GESEHEN_COOKIE = "kifu-versionen";

/** Ein Jahr, wie die übrigen Cookies der Anwendung. */
const GESEHEN_MAX_AGE = 60 * 60 * 24 * 365;

/** Der gemerkte Zeitpunkt (schon dekodiert, wie ihn `cookies()` liefert),
 *  oder `null`, wenn fehlend oder unlesbar. */
export function leseGesehen(wert: string | undefined): string | null {
  return wert && !Number.isNaN(Date.parse(wert)) ? wert : null;
}

export function gesehenCookie(iso: string): string {
  return `${GESEHEN_COOKIE}=${encodeURIComponent(iso)}; path=/; max-age=${GESEHEN_MAX_AGE}; samesite=lax`;
}

/** Ist `a` später als `b`? Fehlt `b`, ist nichts neu: Beim ersten Besuch
 *  gilt alles bis dahin als bekannt. */
export function spaeter(a: string | null, b: string | null): boolean {
  return !!a && !!b && Date.parse(a) > Date.parse(b);
}
