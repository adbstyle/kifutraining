import { breitenCookie } from "@/lib/breite-cookie";

/* Breite des Verzeichnisses neben einer langen Seite («Versionen» seit #408,
   Styleguide) als Cookie, siehe `lib/breite-cookie.ts`. Eine Breite für alle
   solchen Seiten: Wer sie einmal zieht, hat sie überall gleich. */

export const VERZEICHNIS_COOKIE = "kifu-verzeichnis";

/** Die Grenzen beim Ziehen, in Pixeln: schmaler trüge eine Zeile kaum noch
 *  ihr Thema, breiter liesse den Texten zu wenig Platz. Höchstens die halbe
 *  Fläche. Ohne gezogene Wahl gilt die Vorgabe. */
export const VERZEICHNIS_MIN = 176;
export const VERZEICHNIS_MAX = 480;
export const VERZEICHNIS_VORGABE = 256;

const verzeichnis = breitenCookie({
  name: VERZEICHNIS_COOKIE,
  min: VERZEICHNIS_MIN,
  max: VERZEICHNIS_MAX,
});
export const leseVerzeichnis = verzeichnis.lese;
export const verzeichnisCookie = verzeichnis.cookie;
export const begrenzeVerzeichnis = verzeichnis.begrenze;
