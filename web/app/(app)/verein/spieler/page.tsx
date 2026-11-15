import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { VereinSpielerAnsicht } from "@/components/verein/VereinSpielerAnsicht";
import { VereinSpielerListe } from "@/components/verein/VereinSpielerListe";
import { mitAnzahl, type AdressParameter } from "@/lib/adresse";
import { alsMitglied, alsVerwaltung, ladeVereinSpielerliste } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";
import {
  bereinigeEingrenzung,
  gleicheEingrenzung,
  liesSpielerAnzahl,
  liesSpielerEingrenzung,
  SPIELER_SEITE,
  type SpielerEingrenzung,
} from "@/lib/verein-spielerliste";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spieler:innen des Vereins - KiFu", robots: { index: false } };

const PFAD = "/verein/spieler";

/* Die Spieler:innen des Vereins (Story #579 AK 1, #582, #580): für alle
   Mitglieder des Vereins; die Verwaltung dazu mit allen Angaben und
   Aktionen. Konten ohne Verein gehen zu ihren Teams. Suche und Eingrenzung
   stehen in der Adresse (`?q=`, `?team=`, `?jahrgang=`, `?anzahl=`) und
   laufen auf dem Server über den ganzen Verein; hier wird nur eine Seite
   davon gezeigt. Die Rolle prüft die Datenebene (`verein_spielerliste` liefert
   Mitgliedern die Verwaltungsangaben gar nicht), die Wahl der Sicht hier
   ist nur die Darstellung, nicht die Sperre: Die Verwaltungssicht kommt nur,
   wenn Vereinslage UND Antwort sie tragen; die Sicht der Mitglieder bekommt
   immer nur die vier Angaben (`alsMitglied`). */
export default async function VereinSpielerPage({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");

  const holen = async (e: SpielerEingrenzung) => {
    const r = await ladeVereinSpielerliste(supabase, user.id, { vereinId: verein.id, ...e });
    // Die Mitgliedschaft fiel zwischen Vereinslage und Abfrage weg: wie ohne Verein.
    if (!r.ok && r.art === "nicht_gefunden") redirect("/teams");
    if (!r.ok) throw new Error(r.meldung);
    return r.wert;
  };

  let eingrenzung = liesSpielerEingrenzung(sp);
  let liste = await holen(eingrenzung);
  // Teams und Jahrgänge, die es im Verein nicht gibt, träfen nie: Sie fallen
  // aus der Eingrenzung, und die Liste wird ohne sie genau einmal neu geholt
  // (keine Schleife; ein Team, das gerade erst wegfiel, trifft dann eben nie).
  const sauber = bereinigeEingrenzung(eingrenzung, liste);
  if (!gleicheEingrenzung(eingrenzung, sauber)) {
    eingrenzung = sauber;
    liste = await holen(eingrenzung);
  }

  const anzahl = liesSpielerAnzahl(sp);
  const treffer = liste.spieler.length;
  const weiterHref = treffer > anzahl ? mitAnzahl(PFAD, sp, anzahl + SPIELER_SEITE) : null;
  const gemeinsam = { treffer, gesamt: liste.gesamt, ohneTeam: liste.ohneTeam, jahrgaenge: liste.jahrgaenge, eingrenzung, weiterHref, pfad: PFAD };

  const verwaltung = verein.istVerwaltung ? alsVerwaltung(liste) : null;
  return (
    <Seitenrahmen breite="voll" krumen={[{ label: verein.name }, { label: "Spieler:innen" }]}>
      <h1 className="sr-only">Spieler:innen des {verein.name}</h1>
      {verwaltung ? (
        <VereinSpielerListe
          vereinId={verein.id}
          vereinName={verein.name}
          spieler={verwaltung.spieler.slice(0, anzahl)}
          teams={verwaltung.teams}
          {...gemeinsam}
        />
      ) : (
        <VereinSpielerAnsicht {...mitglied(liste, anzahl)} {...gemeinsam} />
      )}
    </Seitenrahmen>
  );
}

/** Die Sicht der Mitglieder: eine Seite der Zeilen und die Teams, beides nur
 *  in der Form der Mitglieder. */
function mitglied(liste: Parameters<typeof alsMitglied>[0], anzahl: number) {
  const m = alsMitglied(liste);
  return { spieler: m.spieler.slice(0, anzahl), teams: m.teams };
}
