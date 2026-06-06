import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server-Action-Body-Limit (Default 1 MB) als Backstop über das 4-MB-
    // Bild-Limit (lib/image.ts) heben. Der Client prüft die Grösse bereits vor
    // dem Senden; das Plattform-Limit von Vercel (~4,5 MB) bleibt die Obergrenze.
    serverActions: { bodySizeLimit: "5mb" },
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
