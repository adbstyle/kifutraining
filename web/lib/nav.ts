/** Geteilte Navigations-Konstanten (neutral — bewusst KEIN "use client",
 *  damit der Wert sowohl in Server- als auch Client-Komponenten als echter
 *  String ankommt; ein Re-Export aus einem Client-Modul würde serverseitig
 *  nur eine Client-Referenz liefern). */

/** Cookie, in dem der Aufklappzustand der Navigation Rail gemerkt wird. */
export const NAV_EXPANDED_COOKIE = "kifu-nav-expanded";
