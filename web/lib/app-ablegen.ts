import { GRUND_HELL } from "@/lib/farben";

/* Die Seite des privaten Links als App ablegen (#650): wann der Hinweis
   erscheint, auf welchem Gerät welcher Weg gilt, und das Manifest je Link.

   REIN: kein Browser, kein Server — der Hook `useAppAblegen` liest Gerät und
   Speicher und reicht sie hier durch, die Manifest-Route ebenso die Daten des
   Links. Geprüft in scripts/pruefe-kern.ts.

   Besuche und das Schliessen merkt sich das Gerät im lokalen Speicher
   (`APP_ABLEGEN_SPEICHER`, steht in lib/browser-speicher.ts) — je Link unter
   dem Kürzel aus `linkSchluessel`, nie der Link selbst. Ein erneuerter Link
   beginnt damit neu. */

/** Name im lokalen Speicher des Browsers. */
export const APP_ABLEGEN_SPEICHER = "kifu-app-ablegen";

/** Wie viele Links ein Gerät sich merkt; der zuletzt besuchte steht zuerst,
 *  der älteste fällt heraus (wie `BENACHRICHTIGUNG_MAX_LINKS`). */
export const APP_ABLEGEN_MAX_LINKS = 20;

/** Ab dem wievielten Besuch auf diesem Gerät der Hinweis erscheint (AK 6). */
export const HINWEIS_AB_BESUCH = 2;

/** Nach dem Schliessen erscheint der Hinweis frühestens nach 7 Tagen wieder (AK 7). */
export const HINWEIS_PAUSE_MS = 7 * 24 * 60 * 60 * 1000;

/** Ein neuer Besuch zählt erst, wenn der letzte mindestens so lange her ist:
 *  Neu laden, zurück aus den Infos oder ein zweiter Tipp auf den Link im Chat
 *  gleich danach sind derselbe Besuch (übliche Sitzungsgrenze von 30 Minuten). */
export const BESUCH_ABSTAND_MS = 30 * 60 * 1000;

/** Was das Gerät je Link weiss: Kürzel, Besuche, letzter gezählter Besuch,
 *  wann der Hinweis zuletzt geschlossen wurde (ms; `null` = nie). */
export type AblageStand = { k: string; b: number; l: number; z: number | null };

const SCHLUESSEL = /^[A-Za-z0-9_-]{12}$/;
const istZeit = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;

/** Der gespeicherte Wert, Unlesbares fällt weg (auch ein ganz kaputter Wert). */
export function liesAblage(wert: string | null | undefined): AblageStand[] {
  if (!wert) return [];
  let roh: unknown;
  try {
    roh = JSON.parse(wert);
  } catch {
    return [];
  }
  if (!Array.isArray(roh)) return [];
  const stand: AblageStand[] = [];
  for (const e of roh) {
    if (!e || typeof e !== "object") continue;
    const { k, b, l, z } = e as Record<string, unknown>;
    if (typeof k !== "string" || !SCHLUESSEL.test(k) || !istZeit(b) || !istZeit(l) || !(z === null || istZeit(z))) continue;
    if (stand.some((s) => s.k === k)) continue;
    stand.push({ k, b, l, z });
  }
  return stand.slice(0, APP_ABLEGEN_MAX_LINKS);
}

const schreibe = (stand: AblageStand[]) => JSON.stringify(stand.slice(0, APP_ABLEGEN_MAX_LINKS));

/** Der Stand eines Links, oder `null`, wenn das Gerät ihn nicht kennt. */
export function ablageFuer(wert: string | null | undefined, schluessel: string): AblageStand | null {
  return liesAblage(wert).find((s) => s.k === schluessel) ?? null;
}

/** Ein Aufruf der Seite: zählt als neuer Besuch, wenn der letzte mindestens
 *  `BESUCH_ABSTAND_MS` zurückliegt; der Link rückt nach vorn. */
export function mitBesuch(wert: string | null | undefined, schluessel: string, jetzt: number): string {
  const stand = liesAblage(wert);
  if (!SCHLUESSEL.test(schluessel) || !istZeit(jetzt)) return schreibe(stand);
  const bisher = stand.find((s) => s.k === schluessel);
  const rest = stand.filter((s) => s.k !== schluessel);
  const neu: AblageStand = !bisher
    ? { k: schluessel, b: 1, l: jetzt, z: null }
    : jetzt - bisher.l >= BESUCH_ABSTAND_MS
      ? { ...bisher, b: bisher.b + 1, l: jetzt }
      : bisher;
  return schreibe([neu, ...rest]);
}

/** Der Hinweis wurde geschlossen (oder die App gerade abgelegt): Er ruht ab jetzt. */
export function mitGeschlossen(wert: string | null | undefined, schluessel: string, jetzt: number): string {
  const stand = liesAblage(wert);
  if (!SCHLUESSEL.test(schluessel) || !istZeit(jetzt)) return schreibe(stand);
  const bisher = stand.find((s) => s.k === schluessel) ?? { k: schluessel, b: 1, l: jetzt, z: null };
  return schreibe([{ ...bisher, z: jetzt }, ...stand.filter((s) => s.k !== schluessel)]);
}

/** Das Betriebssystem, soweit es für das Ablegen zählt. */
export type System = "ios" | "android" | "andere";

export type Geraet = {
  system: System;
  /** Ein Browser in einer App (WhatsApp, Instagram, Facebook …): Dort lässt
   *  sich die Seite nicht als App ablegen (AK 8). */
  inApp: boolean;
};

/** Browser in Apps, an ihrer Kennung im User-Agent: Facebook und Messenger,
 *  Instagram, WhatsApp, Snapchat, TikTok, Line, LinkedIn, X/Twitter,
 *  Pinterest, die Google-App auf dem iPhone und jede Android-WebView (`; wv)`). */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Snapchat|musical_ly|TikTok|BytedanceWebview|\bLine\/|LinkedInApp|Twitter|Pinterest|\bGSA\/|; wv\)/i;

/** Welches Gerät die Seite zeigt. `beruehrungspunkte` ist
 *  `navigator.maxTouchPoints`: Ein iPad meldet sich als Mac, hat aber einen
 *  Touchscreen. Auf dem iPhone fehlt jedem Browser in einer App das Wort
 *  «Safari» — Safari, Chrome, Firefox und Edge tragen es und können ablegen. */
export function erkenneGeraet(ua: string, beruehrungspunkte = 0): Geraet {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && beruehrungspunkte > 1);
  const android = !ios && /Android/.test(ua);
  const inApp = IN_APP.test(ua) || (ios && !/Safari\//.test(ua));
  return { system: ios ? "ios" : android ? "android" : "andere", inApp: (ios || android) && inApp };
}

/** Ob der Hinweis erscheint (AK 6, 7; OoS 4): nur auf dem Mobile, nicht in der
 *  abgelegten App, ab dem zweiten Besuch und frühestens 7 Tage nach dem
 *  Schliessen. */
export function zeigeHinweis({
  geraet,
  standalone,
  stand,
  jetzt,
}: {
  geraet: Geraet;
  standalone: boolean;
  stand: AblageStand | null;
  jetzt: number;
}): boolean {
  if (geraet.system === "andere" || standalone || !stand) return false;
  if (stand.b < HINWEIS_AB_BESUCH) return false;
  return stand.z === null || jetzt - stand.z >= HINWEIS_PAUSE_MS;
}

/** Der Name der App (AK 4): Vorname und Verein, ohne Artikel. */
export const appName = (vorname: string, verein: string) => `${vorname} · ${verein}`;

/** «Lenas Termine», aber «Jonas’ Termine»: Auf s, ss, ß, x, z, tz und ce
 *  endende Namen tragen den Apostroph statt des s. */
export function genitiv(vorname: string): string {
  return /(?:s|ß|x|z|ce)$/i.test(vorname) ? `${vorname}’` : `${vorname}s`;
}

/** Die Pfade der Icons unter `public/icons`, erzeugt aus `app/icon.svg`: die
 *  Bildmarke auf dem hellen Grund (`GRUND_HELL`) wie `app/apple-icon.png`, beim
 *  maskierbaren Icon so klein, dass sie in jeder Form des Startbildschirms
 *  (Kreis, Tropfen) ganz bleibt. */
export const APP_ICONS = [
  { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const;

/** Das Manifest eines privaten Links (AK 1, 3–5): `id`, `start_url` und `scope`
 *  tragen den Link — so ist jede Spieler:in eine eigene App auf demselben Gerät,
 *  und die abgelegte App öffnet ihre Termine direkt. Der Bereich endet ohne
 *  Schrägstrich, damit die Startseite selbst darin liegt (die Infos auch). */
export function linkManifest({ token, vorname, verein }: { token: string; vorname: string; verein: string }) {
  const pfad = `/abmelden/${token}`;
  return {
    id: pfad,
    name: appName(vorname, verein),
    description: `Die Termine von ${vorname}: ab- und anmelden.`,
    lang: "de-CH",
    dir: "ltr",
    start_url: pfad,
    scope: pfad,
    display: "standalone",
    background_color: GRUND_HELL,
    theme_color: GRUND_HELL,
    icons: APP_ICONS,
  } as const;
}

/** Die Texte (Begriff durchgängig «Mobile»). Die Mitteilungen
 *  nennt der Hinweis erst mit Story 2 (#483). */
export const APP_ABLEGEN_TEXT = {
  hinweisTitel: (vorname: string) => `Termine von ${vorname} als App`,
  hinweisText: (vorname: string) =>
    `Lege diese Seite auf den Home-Bildschirm. Dann öffnest du ${genitiv(vorname)} Termine mit einem Tipp, ohne den Link im Chat zu suchen.`,
  /** AK 8: in einem Browser in einer App. */
  inApp: "Hier lässt sich die Seite nicht als App ablegen. Öffne den Link im Browser deines Mobiles, etwa in Safari oder Chrome.",
  schliessen: "Hinweis schliessen",
  soGehts: "So geht’s",
  ablegen: "Als App ablegen",
  /** Der ruhige Knopf unter den Terminen. */
  knopf: "Diese Seite als App ablegen",
  anleitungTitel: "Diese Seite als App ablegen",
  /** Vor der Vorschau des Namens. */
  vorschau: "So heisst die App auf dem Home-Bildschirm:",
  ios: [
    "Tippe in Safari auf «Teilen» (das Quadrat mit dem Pfeil nach oben). Findest du es nicht, tippe zuerst auf «…».",
    "Wähle «Zum Home-Bildschirm». Steht es nicht da, scrolle nach unten oder tippe auf «Mehr».",
    "Tippe auf «Hinzufügen». Danach öffnest du die App mit einem Tipp auf ihr Symbol.",
  ],
  android: [
    "Tippe oben rechts im Browser auf das Menü ⋮.",
    "Wähle «Zum Startbildschirm hinzufügen» oder «App installieren».",
    "Tippe auf «Hinzufügen» bzw. «Installieren». Danach öffnest du die App mit einem Tipp auf ihr Symbol.",
  ],
  schliessenKnopf: "Schliessen",
} as const;
