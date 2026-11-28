import { GRUND, GRUND_HELL } from "@/lib/farben";

/* Die Seite des privaten Links als App ablegen (#650): auf welchem Gerät
   welcher Weg gilt, und das Manifest je Link. Angeboten wird das Ablegen im
   Angebot (lib/angebot.ts) und in der Glocken-Ansicht (#698 AK 7).

   REIN: kein Browser, kein Server. Geprüft in scripts/pruefe-kern.ts. */

/** Das Betriebssystem, soweit es für das Ablegen zählt. */
export type System = "ios" | "android" | "andere";

export type Geraet = {
  system: System;
  /** Ein Browser in einer App (WhatsApp, Instagram, Facebook …): Dort lässt
   *  sich die Seite nicht als App ablegen (#698 AK 6). */
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

/* ── KiFu für Personen mit Konto als App (#651) ──────────────────────────────
   Ein Manifest für die ganze Anwendung, verlinkt nur im Layout der App und der
   Anmelde-Seiten — nie unter /abmelden oder /abholen: Dort gilt das Manifest
   des Links (#650) bzw. keines. Darum kein `app/manifest.ts` (Next hängt das
   an jede Seite und überdeckt das Manifest des Links). Kein Service Worker:
   keine Mitteilungen, nichts ohne Netz (#651 OoS 1, 2). */

/** Wo das Manifest liegt (`app/manifest.webmanifest/route.ts`); die Middleware
 *  lässt den Pfad aus — der Browser holt es ohne Cookies. */
export const KONTO_MANIFEST_PFAD = "/manifest.webmanifest";

/** Der Name auf dem Home-Bildschirm (AK 2), auch für das iPhone. */
export const KONTO_APP_NAME = "KiFu";

/** Die Startseite der abgelegten App: «/». Angemeldet führt sie in den
 *  Arbeitsbereich (#671), ohne Sitzung auf die Startseite mit dem Weg zur
 *  Anmeldung, die ohne Ziel wieder auf «/» und damit in den Arbeitsbereich
 *  führt (AK 3). */
export const KONTO_APP_START = "/";

/** Das Manifest für Personen mit Konto (AK 1, 2): `id` fest auf «/», damit eine
 *  spätere andere Startseite keine zweite App ergibt; der Bereich ist die ganze
 *  Anwendung, sonst stünde beim Wechsel etwa in den Katalog die Leiste des
 *  Browsers da. Name «KiFu», Bildmarke wie beim Link (`APP_ICONS`). */
export function kontoManifest() {
  return {
    id: "/",
    name: KONTO_APP_NAME,
    short_name: KONTO_APP_NAME,
    description: "Übungen, Trainings und Termine deiner Teams.",
    lang: "de-CH",
    dir: "ltr",
    start_url: KONTO_APP_START,
    scope: "/",
    display: "standalone",
    background_color: GRUND_HELL,
    theme_color: GRUND_HELL,
    icons: APP_ICONS,
  } as const;
}

/** Die Farbe der Systemleiste: der Grund im jeweiligen Erscheinungsbild
 *  (Zwilling `--color-elev-00` in globals.css). Gilt für alle Seiten. */
export const THEME_FARBEN = [
  { media: "(prefers-color-scheme: light)", color: GRUND_HELL },
  { media: "(prefers-color-scheme: dark)", color: GRUND },
] as const;

/** Die Angaben im Kopf der App und der Anmelde-Seiten (AK 1, 2): Manifest
 *  und, fürs iPhone, Vollbild und Name unter dem Symbol. Das Symbol selbst
 *  kommt aus `app/apple-icon.png` (jede Seite). */
export const KONTO_APP_METADATA = {
  manifest: KONTO_MANIFEST_PFAD,
  appleWebApp: { capable: true, title: KONTO_APP_NAME, statusBarStyle: "default" },
} as const;

/** Die Texte (Begriff durchgängig «Mobile»). */
export const APP_ABLEGEN_TEXT = {
  /** In einem Browser in einer App. */
  inApp: "Hier lässt sich die Seite nicht als App ablegen. Öffne den Link im Browser deines Mobiles, etwa in Safari oder Chrome.",
  /** Der Eintrag in der Glocken-Ansicht (#698 AK 7). */
  eintragTitel: "Als App ablegen",
  eintragText: (vorname: string) => `${genitiv(vorname)} Termine mit einem Tipp öffnen, ohne den Link im Chat zu suchen.`,
  ablegen: "Ablegen",
  anleitungTitel: "Diese Seite als App ablegen",
  /** Vor der Vorschau des Namens. */
  vorschau: "So heisst die App auf dem Home-Bildschirm:",
  ios: [
    "Tippe im Browser auf «Teilen» (das Quadrat mit dem Pfeil nach oben), in Safari unten, in Chrome oben. Findest du es nicht, tippe zuerst auf «…».",
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
