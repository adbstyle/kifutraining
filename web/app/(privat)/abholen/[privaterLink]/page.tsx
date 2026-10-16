import type { Metadata } from "next";
import { AbholSeite, AbholungGiltNicht } from "@/components/privat/AbholSeite";
import { ladeAbholAnsicht } from "@/lib/abholung";

/* Die Abholadresse eines Teams (#438): Eltern holen den privaten Link ihres
   Kindes selbst ab. Jeder Aufruf liest neu — eine erneuerte oder
   ausgeschaltete Adresse gilt sofort nicht mehr (PC 4).

   Titel und Beschreibung sind fest und nennen weder Team noch Spieler:innen:
   Ein Chat, in dem die Adresse geteilt wird, zeigt sie als Vorschau (AK 19).
   Der Parameter heisst `privaterLink` wie beim Spieler-Link — daran erkennt
   die Besucherstatistik die Seite und zählt sie nicht (AK 20). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spieler:in-Link abholen - KiFu",
  description: "Den privaten Link für Trainings abholen.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AbholAdresse({ params }: { params: Promise<{ privaterLink: string }> }) {
  const { privaterLink } = await params;
  const ansicht = await ladeAbholAnsicht(privaterLink);
  if (!ansicht.gueltig) return <AbholungGiltNicht />;
  return <AbholSeite token={privaterLink} team={ansicht.team} />;
}
