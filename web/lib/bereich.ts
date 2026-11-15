/* Der Bereich der Seitenleiste als Cookie: eines der eigenen Teams oder der
   Verein. Der Server liest es im Layout, damit auf Seiten ohne Bereich
   (Bibliotheken, Konto, /teams) der zuletzt gewählte schon im ersten HTML
   steht; der Client schreibt es, wenn jemand den Bereich wählt oder in einen
   hineingeht. Reine Navigation, kein Recht und keine Personenangabe — darum
   ohne `httpOnly`. Ein fremder oder verwaister Wert fällt auf den ersten
   Bereich der Liste zurück (`waehleBereich`). REIN: ohne Server-Importe. */

export const BEREICH_COOKIE = "kifu-bereich";

/** Ein Jahr: Die Wahl gilt, bis sie jemand ändert. */
const BEREICH_MAX_AGE = 60 * 60 * 24 * 365;

export type Bereich = { art: "team"; id: string } | { art: "verein" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Die Kennung eines Bereichs, wie sie im Cookie steht: `verein` oder `team:<id>`. */
export function bereichSchluessel(b: Bereich): string {
  return b.art === "verein" ? "verein" : `team:${b.id}`;
}

export function gleicherBereich(a: Bereich | null, b: Bereich | null): boolean {
  return a !== null && b !== null && bereichSchluessel(a) === bereichSchluessel(b);
}

/** Der gemerkte Bereich oder `null` (fehlt, unlesbar). */
export function leseBereich(wert: string | undefined): Bereich | null {
  if (wert === "verein") return { art: "verein" };
  const id = wert?.startsWith("team:") ? wert.slice(5) : null;
  return id && UUID.test(id) ? { art: "team", id } : null;
}

export function bereichCookie(b: Bereich): string {
  return `${BEREICH_COOKIE}=${bereichSchluessel(b)}; path=/; max-age=${BEREICH_MAX_AGE}; samesite=lax`;
}

/** Welcher Bereich gilt: der aus der Adresse, sonst der gemerkte — jeweils nur,
 *  wenn dieses Konto ihn hat (`verfuegbar`); sonst der erste der Liste.
 *  Ohne Bereiche `null`. */
export function waehleBereich(
  verfuegbar: Bereich[],
  ausPfad: Bereich | null,
  gemerkt: Bereich | null,
): Bereich | null {
  const hat = (b: Bereich | null) => b !== null && verfuegbar.some((v) => gleicherBereich(v, b));
  if (hat(ausPfad)) return ausPfad;
  if (hat(gemerkt)) return gemerkt;
  return verfuegbar[0] ?? null;
}
