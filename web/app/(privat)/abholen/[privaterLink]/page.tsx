import type { Metadata } from "next";
import { AbholSeite } from "@/components/privat/AbholSeite";
import { GiltNicht } from "@/components/privat/GiltNicht";
import { ladeAbholAnsicht } from "@/lib/abholung";
import { ABHOLUNG_TEXT } from "@/lib/spieler";

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
  if (!ansicht.gueltig) return <GiltNicht titel={ABHOLUNG_TEXT.ungueltigTitel} text={ABHOLUNG_TEXT.ungueltig} />;
  return <AbholSeite token={privaterLink} team={ansicht.team} />;
}
