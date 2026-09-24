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
  // Die Erlauben-Seite für KI-Clients (#142) ist bei offener Client-
  // Registrierung die EINZIGE Schranke vor einem Zugang zum Konto. Eingebettet
  // in eine fremde Seite liesse sich ein Klick auf «Erlauben» unterschieben
  // (Clickjacking) — darum darf sie in keinem Rahmen stehen. Beide Header:
  // `frame-ancestors` ist der Standard, `X-Frame-Options` fängt ältere Browser.
  async headers() {
    return [
      {
        source: "/oauth/consent",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
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
