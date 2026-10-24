import { createAnonClient } from "@/lib/supabase/anon";
import { ABO_ERLOSCHEN, aboTokenAus, kalenderAntwort, kalenderNichtErreichbar, kalenderText, type AboTermin } from "@/lib/ical";
import { oeffentlicherOriginAus } from "@/lib/origin";

/* Der Feed eines Kalender-Abos (#330). Jeder Abruf liefert den aktuellen Stand
   (PC 6). Ein ungültiger oder erloschener Link liefert einen leeren Kalender
   statt eines Fehlers: So entfernen Kalenderprogramme, die das tun, die
   Einträge beim nächsten Abruf (PC 9, OoS 8).

   Der Link IST das Geheimnis: Das Token steht nie in einer Log-Zeile, und die
   Antwort ist weder zwischenspeicherbar noch für Suchmaschinen gedacht. */
export const dynamic = "force-dynamic";

type Feed = {
  gueltig: boolean;
  team?: { id: string; name: string };
  termine?: (Omit<AboTermin, "titel"> & { art: "training" | "spiel"; bezeichnung: string | null })[];
};

export async function GET(req: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const origin = oeffentlicherOriginAus(req);
  const token = aboTokenAus(datei);
  let feed: Feed = { gueltig: false };
  if (token) {
    const { data, error } = await createAnonClient().rpc("kalender_abo_termine", { p_token: token });
    if (error) return kalenderNichtErreichbar(error.message);
    feed = data as Feed;
  }
  // Ein Spiel heisst nach seiner Bezeichnung (#459 PC 1), sonst
  // «Training · Teamname» (PC 2); der Kalender nennt Trainings und Spiele (PC 6).
  const termine: AboTermin[] = feed.gueltig
    ? feed.termine!.map(({ art, bezeichnung, ...t }) => ({
        ...t,
        titel: `${art === "spiel" && bezeichnung ? bezeichnung : "Training"} · ${feed.team!.name}`,
      }))
    : [];
  return kalenderAntwort(
    kalenderText({
      kalenderName: feed.gueltig ? `Trainings und Spiele · ${feed.team!.name}` : ABO_ERLOSCHEN,
      verweis: (id) => `${origin}/team/${feed.team?.id ?? ""}/termin/${id}`,
      termine,
      jetzt: new Date(),
    }),
  );
}
