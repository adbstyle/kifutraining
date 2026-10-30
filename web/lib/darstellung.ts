/* Gewählte Darstellung (Epic #563, #567) als Cookie: Der Server liest es im
   Layout und setzt eine Marke ins erste HTML, nach der `globals.css` das
   `color-scheme` wählt — kein Blitz im anderen Erscheinungsbild. Der Browser
   schreibt es beim Umschalten. Pro Browser, nicht pro Konto: Wer ein Gerät
   teilt, teilt auch die Wahl. Ohne `httpOnly` wie die anderen UI-Cookies
   (siehe /cookies).

   «Wie das Gerät» ist kein gespeicherter Wert, sondern das fehlende Cookie:
   Wer dorthin zurückkehrt, löscht es. */

export type Darstellung = "geraet" | "hell" | "dunkel";

export const DARSTELLUNG_COOKIE = "kifu-darstellung";

/** Ein Jahr, wie die übrigen Cookies der Anwendung. */
const DARSTELLUNG_MAX_AGE = 60 * 60 * 24 * 365;

/** Nur «hell» und «dunkel» übersteuern; alles andere folgt dem Gerät. */
export function leseDarstellung(wert: string | undefined): Darstellung {
  return wert === "hell" || wert === "dunkel" ? wert : "geraet";
}

export function darstellungCookie(darstellung: Darstellung): string {
  return darstellung === "geraet"
    ? `${DARSTELLUNG_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${DARSTELLUNG_COOKIE}=${darstellung}; path=/; max-age=${DARSTELLUNG_MAX_AGE}; samesite=lax`;
}
