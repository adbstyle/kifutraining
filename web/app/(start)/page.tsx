import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Startseite } from "@/components/start/Startseite";
import type { AdressParameter } from "@/lib/adresse";
import { getArbeitsbereichPfad } from "@/lib/arbeitsbereich";
import { getStartseitenBeispiele, toCardData } from "@/lib/queries/exercises";
import { KONTO_GELOESCHT_PARAMETER, katalogWeiterleitung } from "@/lib/startseite";
import { getUserImRequest } from "@/lib/supabase/server";

// Je Aufruf: Anmeldung, Bereich und Beispiele.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KiFu – Verein, Team und Training im Kinder- und Juniorenfussball",
  description:
    "KiFu organisiert Verein, Teams, Termine und Abmeldungen und hilft beim Planen der Trainings im Kinder- und Juniorenfussball. Heute gratis, Open Source.",
};

/* Die Startadresse «/»:
   1. Eine bisher geteilte Katalog-Adresse «/?…» mit Filtern führt samt
      Abfrage zum Katalog (#674).
   2. Angemeldet geht es ohne Umweg in den Arbeitsbereich (#671 PC 1): auch
      für die abgelegte App, die Marke, die Anmeldung ohne Ziel und die
      bestätigte Registrierung — sie alle landen auf «/». Ein Datenbankfehler
      wirft (Fehlerseite), statt in den Einstieg «Verein gründen» zu führen.
   3. Sonst die Startseite (#670), nach «Konto löschen» mit der Bestätigung. */
export default async function Startadresse({ searchParams }: { searchParams: Promise<AdressParameter> }) {
  const sp = await searchParams;
  const katalog = katalogWeiterleitung(sp);
  if (katalog) redirect(katalog);

  const user = await getUserImRequest();
  if (user) redirect(await getArbeitsbereichPfad());

  const beispiele = (await getStartseitenBeispiele()).map(toCardData);
  return (
    <Startseite beispiele={beispiele} kontoGeloescht={sp[KONTO_GELOESCHT_PARAMETER] !== undefined} angemeldet={false} />
  );
}
