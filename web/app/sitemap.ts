import type { MetadataRoute } from "next";
import { SITEMAP_PFADE, basisOrigin } from "@/lib/auffindbar";

/* Sitemap (#673): genau die Seiten, die robots.txt auf Produktion freigibt. */
export default function sitemap(): MetadataRoute.Sitemap {
  const basis = basisOrigin(process.env.APP_ORIGIN);
  return SITEMAP_PFADE.map((pfad) => ({ url: `${basis}${pfad}` }));
}
