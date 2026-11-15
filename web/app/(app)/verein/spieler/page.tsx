import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { VereinSpielerAnsicht } from "@/components/verein/VereinSpielerAnsicht";
import { VereinSpielerListe } from "@/components/verein/VereinSpielerListe";
import { mitAnzahl, type AdressParameter } from "@/lib/adresse";
import { alsVerwaltung, ladeVereinSpielerliste } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";
import {
  bereinigeEingrenzung,
  gleicheEingrenzung,
  liesSpielerAnzahl,
  liesSpielerEingrenzung,
  SPIELER_SEITE,
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
   ist nur die Darstellung, nicht die Sperre. */
export default async function VereinSpielerPage({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");

  const laden = (e: ReturnType<typeof liesSpielerEingrenzung>) =>
    ladeVereinSpielerliste(supabase, user.id, { vereinId: verein.id, suche: e.suche, teamIds: e.teamIds, ohneTeam: e.ohneTeam, jahrgaenge: e.jahrgaenge });

  let eingrenzung = liesSpielerEingrenzung(sp);
  let r = await laden(eingrenzung);
  // Die Mitgliedschaft fiel zwischen Vereinslage und Abfrage weg: wie ohne Verein.
  if (!r.ok && r.art === "nicht_gefunden") redirect("/teams");
  if (!r.ok) throw new Error(r.meldung);
  // Teams und Jahrgänge, die es im Verein nicht gibt, träfen nie: Sie fallen
  // aus der Eingrenzung, und die Liste wird ohne sie neu geholt.
  const sauber = bereinigeEingrenzung(eingrenzung, r.wert);
  if (!gleicheEingrenzung(eingrenzung, sauber)) {
    eingrenzung = sauber;
    r = await laden(eingrenzung);
    if (!r.ok) throw new Error(r.meldung);
  }
  const liste = r.wert;

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
        <VereinSpielerAnsicht
          spieler={liste.spieler.slice(0, anzahl)}
          teams={liste.teams}
          {...gemeinsam}
        />
      )}
    </Seitenrahmen>
  );
}
