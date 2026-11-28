import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SectionMessage } from "@/components/ui";
import { VereinSeite } from "@/components/verein/VereinSeite";
import { VereinSpielerAktionen } from "@/components/verein/VereinSpielerAktionen";
import { VereinSpielerAnsicht } from "@/components/verein/VereinSpielerAnsicht";
import { VereinSpielerListe } from "@/components/verein/VereinSpielerListe";
import { mitAnzahl, type AdressParameter } from "@/lib/adresse";
import { ladeVereinSpielerliste } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";
import { SPIELER_ERFASSEN_GESPERRT_ID, VEREIN_MELDUNG, VEREIN_SEITEN, vereinSpielerVoll } from "@/lib/verein";
import {
  bereinigeEingrenzung,
  bereinigteAdresse,
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
   Mitgliedern die Verwaltungsangaben gar nicht); die Sicht wählt die Seite
   allein an `verwaltung` aus derselben Antwort — eine Quelle, sodass ein
   Rollenwechsel zwischen zwei Abfragen nichts auseinanderlaufen lässt. Teams
   und Jahrgänge in der Adresse, die es im Verein nicht gibt (oder die gar
   keine sind), leiten einmal auf die bereinigte Adresse weiter.

   Wie die Seiten eines Teams (#707): «Spieler:innen» als letzte Brotkrume,
   für die Verwaltung «Spieler:in hinzufügen» und den Import in der
   Kopfzeile — an der Grenze des Vereins beide gesperrt, mit dem Satz
   darunter —, die Zahlen in der Zeile über der Liste. Mitglieder ohne
   Verwaltung haben keine Aktionen. */
export default async function VereinSpielerPage({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");

  const r = await ladeVereinSpielerliste(supabase, user.id, { vereinId: verein.id, ...liesSpielerEingrenzung(sp) });
  // Die Mitgliedschaft fiel zwischen Vereinslage und Abfrage weg: wie ohne Verein.
  if (!r.ok && r.art === "nicht_gefunden") redirect("/teams");
  if (!r.ok) throw new Error(r.meldung);
  const liste = r.wert;

  // Teams und Jahrgänge, die es im Verein nicht gibt, träfen nie: Die Adresse
  // wird einmal bereinigt, statt sie als unsichtbaren Filter mitzuschleppen.
  const eingrenzung = bereinigeEingrenzung(liesSpielerEingrenzung(sp), liste);
  const sauber = bereinigteAdresse(PFAD, sp, eingrenzung);
  if (sauber) redirect(sauber);

  const anzahl = liesSpielerAnzahl(sp);
  const treffer = liste.spieler.length;
  const weiterHref = treffer > anzahl ? mitAnzahl(PFAD, sp, anzahl + SPIELER_SEITE) : null;
  const gemeinsam = { treffer, gesamt: liste.gesamt, ohneTeam: liste.ohneTeam, jahrgaenge: liste.jahrgaenge, eingrenzung, weiterHref, pfad: PFAD };

  // Die Grenze zählt den ganzen Verein, nicht die Treffer (AK 4).
  const voll = vereinSpielerVoll(liste.gesamt);

  return (
    <VereinSeite
      vereinName={verein.name}
      seite={VEREIN_SEITEN.spieler}
      aktionen={
        liste.verwaltung ? (
          <VereinSpielerAktionen vereinId={verein.id} vereinName={verein.name} pfad={PFAD} voll={voll} eingrenzung={eingrenzung} />
        ) : undefined
      }
    >
      {liste.verwaltung && voll && (
        <div id={SPIELER_ERFASSEN_GESPERRT_ID} className="mb-4">
          <SectionMessage>{VEREIN_MELDUNG.VEREIN_VOLL}</SectionMessage>
        </div>
      )}
      {liste.verwaltung ? (
        <VereinSpielerListe
          vereinId={verein.id}
          vereinName={verein.name}
          spieler={liste.spieler.slice(0, anzahl)}
          teams={liste.teams}
          {...gemeinsam}
        />
      ) : (
        <VereinSpielerAnsicht spieler={liste.spieler.slice(0, anzahl)} teams={liste.teams} {...gemeinsam} />
      )}
    </VereinSeite>
  );
}
