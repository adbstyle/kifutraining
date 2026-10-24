import { createAnonClient } from "@/lib/supabase/anon";
import { kalenderAntwort, kalenderNichtErreichbar, kalenderText } from "@/lib/ical";
import { aboEintrag, aboKalenderName, type AboFeed } from "@/lib/spieler-abo";

/* Der Feed des Kalender-Abos einer Spielervertretung (#507), mit Trainings
   und Spielen im selben Kalender (#508 AK 1). Jeder Abruf
   liefert den Stand, den der private Link im selben Moment zeigt, ohne
   ausgefallene Termine (PC 1, 4). Eine ungültige oder erloschene
   Abo-Adresse liefert einen leeren Kalender wie beim Abo der Mitglieder
   (PC 7) — und nichts, woran man erkennt, ob es sie je gab.

   Die Adresse IST das Geheimnis: Sie steht nie in einer Log-Zeile. */
export const dynamic = "force-dynamic";

const DATEI = /^([0-9a-f]{64})\.ics$/;

export async function GET(_req: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const m = DATEI.exec(datei);
  let feed: AboFeed = { gueltig: false };
  if (m) {
    const { data, error } = await createAnonClient().rpc("spieler_abo_termine", { p_token: m[1] });
    if (error) return kalenderNichtErreichbar(error.message);
    feed = data as AboFeed;
  }
  return kalenderAntwort(
    kalenderText({
      kalenderName: feed.gueltig ? aboKalenderName(feed.team) : "KiFu – Abo erloschen",
      titel: "KiFu",
      uidZusatz: feed.gueltig ? feed.abo : undefined,
      termine: feed.gueltig ? feed.termine.map((t) => aboEintrag(t, feed.team)) : [],
      jetzt: new Date(),
    }),
  );
}
