import { breitenCookie } from "@/lib/breite-cookie";

/* Breite der zweiten Spalte (Einordnung einer Übung, Epic #350) als Cookie,
   siehe `lib/breite-cookie.ts`. */

export const SPALTE_COOKIE = "kifu-spalte";

/** Die Grenzen beim Ziehen, in Pixeln. Schmaler trüge die Liste ihre
 *  Bezeichnungen nicht mehr neben den Werten, breiter liesse dem Inhalt auf
 *  einem Laptop zu wenig Platz. Zusätzlich nimmt die Spalte nie mehr als die
 *  Hälfte der Fläche ein. */
export const SPALTE_MIN = 288;
export const SPALTE_MAX = 640;

const spalte = breitenCookie({ name: SPALTE_COOKIE, min: SPALTE_MIN, max: SPALTE_MAX });
export const leseSpalte = spalte.lese;
export const spalteCookie = spalte.cookie;
export const begrenzeSpalte = spalte.begrenze;
