import type { MetadataRoute } from "next";
import { basisOrigin, robotsRegeln } from "@/lib/auffindbar";

/* robots.txt (#673 AK 1): Auf Produktion nur Startseite, «Versionen»,
   Impressum und Datenschutz (Regeln in lib/auffindbar.ts); Staging, Previews
   und lokal sperren alles. Vercel baut je Umgebung, `VERCEL_ENV` und
   `APP_ORIGIN` stehen schon beim Build fest. */
export default function robots(): MetadataRoute.Robots {
  const produktion = process.env.VERCEL_ENV === "production";
  return {
    rules: robotsRegeln(process.env.VERCEL_ENV),
    ...(produktion ? { sitemap: `${basisOrigin(process.env.APP_ORIGIN)}/sitemap.xml` } : {}),
  };
}
