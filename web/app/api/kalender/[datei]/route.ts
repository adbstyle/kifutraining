import { createAnonClient } from "@/lib/supabase/anon";
import { kalenderText, type AboTermin } from "@/lib/ical";
import { oeffentlicherOriginAus } from "@/lib/origin";

/* Der Feed eines Kalender-Abos (#330). Jeder Abruf liefert den aktuellen Stand
   (PC 6). Ein ungültiger oder erloschener Link liefert einen leeren Kalender
   statt eines Fehlers: So entfernen Kalenderprogramme, die das tun, die
   Einträge beim nächsten Abruf (PC 9, OoS 8).

   Der Link IST das Geheimnis: Das Token steht nie in einer Log-Zeile, und die
   Antwort ist weder zwischenspeicherbar noch für Suchmaschinen gedacht. */
export const dynamic = "force-dynamic";

const DATEI = /^([0-9a-f]{64})\.ics$/;

type Feed = { gueltig: boolean; team?: { id: string; name: string }; termine?: AboTermin[] };

export async function GET(req: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const origin = oeffentlicherOriginAus(req);
  const m = DATEI.exec(datei);
  let feed: Feed = { gueltig: false };
  if (m) {
    const { data, error } = await createAnonClient().rpc("kalender_abo_termine", { p_token: m[1] });
    if (error) {
      // Nur die Meldung der Datenbank, nie der Aufruf: Er trägt das Token.
      console.error("[abo]", error.message);
      return new Response("Der Kalender ist gerade nicht erreichbar.", {
        status: 503,
        headers: { "Retry-After": "300", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
    feed = data as Feed;
  }
  const titel = feed.gueltig ? `Training · ${feed.team!.name}` : "KiFu";
  const text = kalenderText({
    kalenderName: feed.gueltig ? titel : "KiFu – Abo erloschen",
    titel,
    teamId: feed.team?.id ?? "",
    origin,
    termine: feed.gueltig ? feed.termine! : [],
    jetzt: new Date(),
  });
  return new Response(text, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="kifu.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}
