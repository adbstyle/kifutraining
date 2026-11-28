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
      // Hinter einem privaten Link (#436) und der Abholadresse (#438) ist der
      // Pfad das Geheimnis: nicht
      // als Referrer weitergeben, nicht indexieren, nirgends zwischenspeichern.
      // Ohne Rahmen wie die Erlauben-Seite — ein Schalter liesse sich sonst
      // unterschieben.
      ...["/abmelden/:pfad*", "/abholen/:pfad*"].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      })),
      // Das Manifest eines Links (#650) holt der Browser bei jedem
      // Seitenaufruf; es nennt nur Vorname, Verein und den Link selbst. Darum
      // darf es im Browser (nie in einem geteilten Cache) einen Tag liegen.
      // Die Regel steht nach der obigen: Next lässt bei gleichem Schlüssel die
      // spätere gelten, die übrigen Schutz-Header bleiben.
      {
        source: "/abmelden/:link/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "private, max-age=86400" }],
      },
    ];
  },
  // Apple-Geräte kennen kein SVG-Icon und raten ohne Verweis eine Reihe
  // fester Adressen durch (`/apple-touch-icon.png`, `-precomposed`, je
  // Grösse). Jede landete als 404 in der Catch-all-Seite und kostete einen
  // Funktionsaufruf samt App-Layout. Das Icon steht als app/apple-icon.png
  // (Next verlinkt es selbst); die geratenen Adressen zeigen auf dieselbe
  // statische Datei. Es ist app/icon.svg ohne gerundete Ecken (iOS rundet
  // selbst), 180×180 und deckend gerendert — ändert sich icon.svg, neu erzeugen.
  async rewrites() {
    return [{ source: "/:datei(apple-touch-icon.*\\.png)", destination: "/apple-icon.png" }];
  },
  // Die bisherigen Adressen der Team-Verwaltung (#656) führen an die neue
  // Stelle derselben Sicht (#704 AK 6): die Spielerliste, Kader & Schnuppern
  // und der private Link unter «Spieler:innen», die Trainer:innen auf die
  // Seite «Team». Next hängt die Suchparameter selbst an, die Eingrenzung
  // reist also mit. Bewusst nicht dauerhaft (307 statt 308): Browser und
  // Zwischenspeicher merken sich eine dauerhafte Weiterleitung, sie liesse
  // sich nicht mehr zurücknehmen. Vor dem App-Layout, kostet darum keinen
  // Seitenaufbau.
  async redirects() {
    return [
      { source: "/team/:id/verwaltung", destination: "/team/:id/spieler", permanent: false },
      { source: "/team/:id/verwaltung/kader", destination: "/team/:id/spieler/kader", permanent: false },
      { source: "/team/:id/verwaltung/link", destination: "/team/:id/spieler/link", permanent: false },
      { source: "/team/:id/verwaltung/trainer", destination: "/team/:id/trainer", permanent: false },
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
