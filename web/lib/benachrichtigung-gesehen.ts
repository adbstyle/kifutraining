/* Welche Benachrichtigungen dieses Gerät schon angezeigt hat (#642 AK 2), als
   Cookie: je privatem Link der Zeitpunkt (ms) der neuesten Benachrichtigung,
   die die Ansicht gezeigt hat. Neu ist, was danach entstand. Auf einem Gerät
   ohne Eintrag zeigt die Seite zum ersten Mal an: Alles Bisherige gilt als
   gesehen.

   Der Schlüssel eines Links ist aus ihm abgeleitet (`linkSchluessel`, nur
   Server): Ein erneuerter Link beginnt neu, und das Geheimnis selbst steht nie
   im Cookie. Der Server liest das Cookie beim Rendern der Seite, damit der
   Zähler schon im ersten HTML stimmt; der Browser schreibt es (Hook
   `useBenachrichtigungen`). Pro Gerät, nicht pro Person, ohne `httpOnly` wie
   die anderen UI-Cookies (siehe /cookies). Der Pfad ist der Bereich der
   privaten Links — das Cookie geht an keine andere Seite.

   REIN: Vorbild `versionen-gesehen.ts`. */

export const BENACHRICHTIGUNG_COOKIE = "kifu-benachrichtigungen";

/** Der Bereich der privaten Links der Eltern. */
const PFAD = "/abmelden";

/** Ein Jahr, wie die übrigen Cookies der Anwendung. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** Wie viele Links ein Gerät sich merkt; der zuletzt geschriebene steht zuerst,
 *  der älteste fällt zuerst heraus (ein Gerät hält selten mehr Links). */
export const BENACHRICHTIGUNG_MAX_LINKS = 20;

type Stand = { k: string; t: number };

const SCHLUESSEL = /^[A-Za-z0-9_-]{12}$/;
const ZEIT = /^[0-9a-z]{1,12}$/;

/** Der Wert, wie er im Cookie steht: «k:t.k:t» (t in base36), Unlesbares fällt weg. */
function lies(wert: string | null | undefined): Stand[] {
  if (!wert) return [];
  const stand: Stand[] = [];
  for (const teil of wert.split(".")) {
    const [k, t, rest] = teil.split(":");
    if (rest !== undefined || !k || !t || !SCHLUESSEL.test(k) || !ZEIT.test(t)) continue;
    const ms = parseInt(t, 36);
    if (Number.isSafeInteger(ms) && ms >= 0 && !stand.some((s) => s.k === k)) stand.push({ k, t: ms });
  }
  return stand.slice(0, BENACHRICHTIGUNG_MAX_LINKS);
}

const schreibe = (stand: Stand[]) => stand.map((s) => `${s.k}:${s.t.toString(36)}`).join(".");

/** Der gemerkte Zeitpunkt für einen Link (Wert schon dekodiert, wie ihn
 *  `cookies()` liefert), oder `null`, wenn dieses Gerät ihn nicht kennt. */
export function leseGesehenStand(wert: string | null | undefined, schluessel: string): number | null {
  return lies(wert).find((s) => s.k === schluessel)?.t ?? null;
}

/** Der neue Cookie-Wert: `ms` für diesen Link, nie niedriger als bisher; der
 *  Link rückt nach vorn, mehr als 20 verdrängen den ältesten. */
export function mitGesehen(wert: string | null | undefined, schluessel: string, ms: number): string {
  if (!SCHLUESSEL.test(schluessel) || !Number.isSafeInteger(ms) || ms < 0) return schreibe(lies(wert));
  const stand = lies(wert);
  const bisher = stand.find((s) => s.k === schluessel)?.t ?? -1;
  const rest = stand.filter((s) => s.k !== schluessel);
  return schreibe([{ k: schluessel, t: Math.max(bisher, ms) }, ...rest].slice(0, BENACHRICHTIGUNG_MAX_LINKS));
}

export function benachrichtigungCookie(wert: string): string {
  return `${BENACHRICHTIGUNG_COOKIE}=${encodeURIComponent(wert)}; path=${PFAD}; max-age=${MAX_AGE}; samesite=lax`;
}

/** Der Wert aus `document.cookie` (dekodiert), oder `undefined`. */
export function wertAusCookieString(cookies: string): string | undefined {
  for (const teil of cookies.split(";")) {
    const i = teil.indexOf("=");
    if (i < 0 || teil.slice(0, i).trim() !== BENACHRICHTIGUNG_COOKIE) continue;
    try {
      return decodeURIComponent(teil.slice(i + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
