import { linkManifest } from "@/lib/app-ablegen";
import { ladeLinkAnsicht } from "@/lib/privater-link";

/* Das Manifest eines privaten Links (#650 AK 1, 3–5): Name «Vorname · Verein»,
   `id`, `start_url` und `scope` je Link. Ein ungültiger, erneuerter oder
   unbekannter Link bekommt keines (404, ohne zu sagen, warum). Kopfzeilen
   wie jede Seite unter /abmelden (next.config.ts): kein Referrer, nicht
   indexieren, nirgends zwischenspeichern. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ privaterLink: string }> }) {
  const { privaterLink } = await params;
  const ansicht = await ladeLinkAnsicht(privaterLink);
  if (!ansicht.gueltig) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(linkManifest({ token: privaterLink, vorname: ansicht.spieler.vorname, verein: ansicht.verein })), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
