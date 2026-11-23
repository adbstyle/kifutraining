import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Startseite } from "@/components/start/Startseite";
import type { AdressParameter } from "@/lib/adresse";
import { getArbeitsbereichPfad } from "@/lib/arbeitsbereich";
import { getStartseitenBeispiele, toCardData } from "@/lib/queries/exercises";
import { KONTO_GELOESCHT_PARAMETER, katalogWeiterleitung, nurMitKontoZiel } from "@/lib/startseite";
import { getUserImRequest } from "@/lib/supabase/server";

// Je Aufruf: Anmeldung, Bereich und Beispiele.
export const dynamic = "force-dynamic";

/* Was das Suchergebnis sagt (#673 AK 2): Vereinsverwaltung, Team und
   Abmeldungen, Trainingsplanung nach SFV und KI-Assistent im Kinder- und
   Juniorenfussball. Die Vorschau beim Teilen bleibt die der Wurzel (AK 3). */
export const metadata: Metadata = {
  title: "KiFu – Vereinsverwaltung, Team und Training im Kinder- und Juniorenfussball",
  description:
    "Vereinsverwaltung, Team und Abmeldungen, Trainingsplanung nach SFV und ein KI-Assistent für den Kinder- und Juniorenfussball. Heute gratis, Open Source.",
  alternates: { canonical: "/" },
};

/* Die Startadresse «/»:
   1. Eine bisher geteilte Katalog-Adresse «/?…» mit Filtern führt samt
      Abfrage zum Katalog (#674).
   2. Angemeldet geht es ohne Umweg in den Arbeitsbereich (#671 PC 1): auch
      für die abgelegte App, die Marke, die Anmeldung ohne Ziel und die
      bestätigte Registrierung — sie alle landen auf «/». Ein Datenbankfehler
      wirft (Fehlerseite), statt in den Einstieg «Verein gründen» zu führen.
      Kam die Adresse vom Hinweis «nur mit Konto» (#669), geht es stattdessen
      zum Ziel des Verweises.
   3. Sonst die Startseite (#670), nach «Konto löschen» mit der Bestätigung,
      nach einem Verweis auf Übung, Training oder Katalog mit dem Hinweis
      «nur mit Konto» (#669 PC 1). */
export default async function Startadresse({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  const katalog = katalogWeiterleitung(sp);
  if (katalog) redirect(katalog);

  const nurMitKonto = nurMitKontoZiel(sp);
  const user = await getUserImRequest();
  if (user) redirect(nurMitKonto ?? (await getArbeitsbereichPfad()));

  const beispiele = (await getStartseitenBeispiele()).map(toCardData);
  return (
    <Startseite
      beispiele={beispiele}
      kontoGeloescht={sp[KONTO_GELOESCHT_PARAMETER] !== undefined}
      nurMitKonto={nurMitKonto}
      angemeldet={false}
    />
  );
}
