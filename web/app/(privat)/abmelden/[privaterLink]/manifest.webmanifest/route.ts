import { linkManifest } from "@/lib/app-ablegen";
import { ladeLinkApp } from "@/lib/privater-link";

/* Das Manifest eines privaten Links (#650 AK 1, 3–5): Name «Vorname · Verein»,
   `id`, `start_url` und `scope` je Link. Ein ungültiger, erneuerter oder
   unbekannter Link bekommt keines (404, ohne zu sagen, warum). Der Browser
   holt es bei jedem Seitenaufruf: darum nur Vorname und Verein
   (`ladeLinkApp`), und es darf einen Tag im Browser liegen; die übrigen
   Kopfzeilen wie jede Seite unter /abmelden (next.config.ts): kein
   Referrer, nicht indexieren. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ privaterLink: string }> }) {
  const { privaterLink } = await params;
  const app = await ladeLinkApp(privaterLink);
  if (!app) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(linkManifest({ token: privaterLink, vorname: app.vorname, verein: app.verein })), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
