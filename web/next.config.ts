import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server-Action-Body-Limit (Default 1 MB) anheben. Der Client verkleinert
    // Bilder vor dem Upload (lib/image-compress.ts) auf < MAX_STORED_IMAGE_MB
    // (1,5 MB); 3 MB lassen Spielraum für Bild + Formularfelder, damit eine
    // knapp zu grosse Datei unsere eigene Meldung (storedImageError) erhält
    // statt eines rohen Plattformfehlers. Vercel-Limit (~4,5 MB) bleibt Obergrenze.
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Feld-Diagramme werden aus Supabase Storage ausgeliefert (öffentliche URLs).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
