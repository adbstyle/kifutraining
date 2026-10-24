import { createAnonClient } from "@/lib/supabase/anon";
import { kalenderAntwort, kalenderNichtErreichbar, kalenderText, type AboTermin } from "@/lib/ical";
import { oeffentlicherOriginAus } from "@/lib/origin";

/* Der Feed eines Kalender-Abos (#330). Jeder Abruf liefert den aktuellen Stand
   (PC 6). Ein ungültiger oder erloschener Link liefert einen leeren Kalender
   statt eines Fehlers: So entfernen Kalenderprogramme, die das tun, die
   Einträge beim nächsten Abruf (PC 9, OoS 8).

   Der Link IST das Geheimnis: Das Token steht nie in einer Log-Zeile, und die
   Antwort ist weder zwischenspeicherbar noch für Suchmaschinen gedacht. */
export const dynamic = "force-dynamic";

const DATEI = /^([0-9a-f]{64})\.ics$/;

type Feed = {
  gueltig: boolean;
  team?: { id: string; name: string };
  termine?: (AboTermin & { art: "training" | "spiel"; bezeichnung: string | null })[];
};

export async function GET(req: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const origin = oeffentlicherOriginAus(req);
  const m = DATEI.exec(datei);
  let feed: Feed = { gueltig: false };
  if (m) {
    const { data, error } = await createAnonClient().rpc("kalender_abo_termine", { p_token: m[1] });
    if (error) return kalenderNichtErreichbar(error.message);
    feed = data as Feed;
  }
  const titel = feed.gueltig ? `Training · ${feed.team!.name}` : "KiFu";
  // Ein Spiel heisst nach seiner Bezeichnung (#459 PC 1); der Kalender nennt
  // Trainings und Spiele (PC 6).
  const termine: AboTermin[] = feed.gueltig
    ? feed.termine!.map(({ art, bezeichnung, ...t }) =>
        art === "spiel" && bezeichnung ? { ...t, titel: `${bezeichnung} · ${feed.team!.name}` } : t,
      )
    : [];
  return kalenderAntwort(
    kalenderText({
      kalenderName: feed.gueltig ? `Trainings und Spiele · ${feed.team!.name}` : "KiFu – Abo erloschen",
      titel,
      verweis: (id) => `${origin}/team/${feed.team?.id ?? ""}/termin/${id}`,
      termine,
      jetzt: new Date(),
    }),
  );
}
