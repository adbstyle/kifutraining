/* Die Fensterbreiten, ab denen sich die Oberfläche umstellt — als Media-Query
   für den Browser, wo eine Weiche nicht allein im CSS liegen kann (ein
   Nachladen, ein Umleiten, ein Fokus). Es sind Tailwinds eigene Schwellen;
   ändert sich eine dort, ändert sie sich hier mit, sonst läuft die
   CSS-Weiche der Seite anders als ihr Gegenstück im Skript. */

/** Tailwind `sm` — ab hier zeigt die Übungsmaske die Zeichenfläche. */
export const AB_SM = "(min-width: 40rem)";

/** Tailwind `lg` — ab hier steht die Seitenleiste neben dem Inhalt. */
export const AB_LG = "(min-width: 64rem)";

/** Tailwind `xl` — ab hier teilen sich Übungsseite und Training in Inhalt und
 *  Spalte (`ZweiSpalten`). */
export const AB_XL = "(min-width: 80rem)";
