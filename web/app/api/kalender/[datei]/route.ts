import { createAnonClient } from "@/lib/supabase/anon";
import { ABO_ERLOSCHEN, aboTokenAus, kalenderAntwort, kalenderNichtErreichbar, kalenderText, type AboTermin } from "@/lib/ical";
import { oeffentlicherOriginAus } from "@/lib/origin";
import { aboBeschreibung, aboTitel, type AboTrainerTermin } from "@/lib/trainer";

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
  termine?: (Omit<AboTermin, "titel" | "ortLink"> & {
    art: "training" | "spiel";
    bezeichnung: string | null;
    /** Der Kartenlink zum Ort (#533 PC 4); fehlt vor der Migration. */
    ort_link?: string | null;
  } & AboTrainerTermin)[];
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
  // Nur die eigenen Einladungen, mit dem eigenen Stand vorn im Titel und der
  // Besetzung im Eintrag (#522); abgesagte als «frei».
  const termine: AboTermin[] = feed.gueltig
    ? feed.termine!.map(({ art, bezeichnung, stand, trainer, besetzung_art, besetzung_zahl, erwartete_spielerzahl, spielstand, ort_link, ...t }) => {
        const besetzung = { stand, trainer, besetzung_art, besetzung_zahl, erwartete_spielerzahl, spielstand };
        return {
          ...t,
          ortLink: ort_link ?? null,
          titel: aboTitel(besetzung, `${art === "spiel" && bezeichnung ? bezeichnung : "Training"} · ${feed.team!.name}`),
          beschreibung: aboBeschreibung(besetzung),
          frei: stand === "abgesagt",
        };
      })
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
