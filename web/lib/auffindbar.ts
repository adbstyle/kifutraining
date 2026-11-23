/* Auffindbar und mit Link-Vorschau (#673). REIN: keine Server-Importe —
   `check:kern` lädt die Datei und prüft die Regeln.

   - Suchmaschinen sehen auf Produktion nur, was für sie gedacht ist (AK 1):
     die Startseite «/», «Versionen» und — mit #672 — Impressum und
     Datenschutz (Entscheid 1). Alles andere ist gesperrt; Staging und
     Previews sperren ganz.
   - Jede Adresse zeigt beim Teilen dieselbe Vorschau: Marke, «KiFu» und der
     Claim (AK 3, Entscheid 2). Darum steht die Vorschau EINMAL in der Wurzel
     (`app/layout.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`),
     und keine Seite setzt eigene `openGraph`-/`twitter`-Angaben — so trägt
     auch ein privater Link nie einen Namen in die Vorschau eines Chats. */

/** Die Adresse von Produktion; Rückfall, wenn `APP_ORIGIN` fehlt (lokal). */
export const PRODUKTION_ORIGIN = "https://ki-fu.ch";

/** Der Name und der Claim der Vorschau — der Claim steht wortgleich auf der
 *  Startseite (components/start/Startseite.tsx). */
export const VORSCHAU_NAME = "KiFu";
export const VORSCHAU_CLAIM = "Mehr Fussball. Weniger Bürokratie.";

/** Was Suchmaschinen auf Produktion lesen dürfen. «/$» ist genau die
 *  Startseite (sonst gälte «/» als Präfix für alles). Die Vorschaubilder sind
 *  frei, damit Dienste, die robots.txt achten, sie laden können. */
export const FREIGEGEBEN = ["/$", "/versionen", "/impressum", "/datenschutz", "/opengraph-image", "/twitter-image"] as const;

/** Die Seiten der Sitemap (Pfade unter dem Origin). */
export const SITEMAP_PFADE = ["/", "/versionen", "/impressum", "/datenschutz"] as const;

/** Dienste, die nur eine Link-Vorschau holen, nicht indexieren. Sie dürfen
 *  jede Adresse lesen — sonst bliebe die Vorschau beim Teilen eines
 *  gesperrten Links leer (Entscheid 2). Was sie dort finden, ist die feste
 *  Marken-Vorschau der Wurzel. */
export const VORSCHAU_DIENSTE = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot-LinkExpanding",
  "WhatsApp",
  "TelegramBot",
  "Discordbot",
] as const;

export type RobotsRegel = { userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[] };

/** Die Regeln von robots.txt je Umgebung (`VERCEL_ENV`). Nur Produktion gibt
 *  etwas frei; Staging, Previews und lokal sperren alles. */
export function robotsRegeln(vercelEnv: string | undefined): RobotsRegel[] {
  if (vercelEnv !== "production") return [{ userAgent: "*", disallow: "/" }];
  return [
    { userAgent: "*", allow: [...FREIGEGEBEN], disallow: "/" },
    { userAgent: [...VORSCHAU_DIENSTE], allow: "/" },
  ];
}

/** Die Basis absoluter Adressen (Sitemap, canonical, Vorschaubild):
 *  `APP_ORIGIN` wie überall (lib/origin.ts), sonst Produktion. */
export function basisOrigin(appOrigin: string | undefined): string {
  return (appOrigin || PRODUKTION_ORIGIN).replace(/\/+$/, "");
}
