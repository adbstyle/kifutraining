import type { Metadata } from "next";
import { ElternAnsicht } from "@/components/privat/ElternAnsicht";
import { GiltNicht } from "@/components/privat/GiltNicht";
import { ladeLinkAnsicht } from "@/lib/privater-link";
import { LINK_TEXT } from "@/lib/spieler";

/* Der private Link einer Spieler:in (#436): Ihre Spielervertretung meldet sie
   ohne Konto für anstehende Termine ab und wieder an. Jeder Aufruf liest neu —
   ein erneuerter Link gilt sofort nicht mehr (PC 2).

   Titel und Beschreibung sind fest und nennen weder Team noch Spieler:in: Ein
   Chat, in dem der Link geteilt wird, zeigt sie als Vorschau (AK 13). Der
   Parameter heisst `privaterLink`, daran erkennt die Besucherstatistik die
   Seite und zählt sie nicht (AK 14). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trainings ab- und anmelden - KiFu",
  description: "Für Trainings ab- und wieder anmelden.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SpielerLinkSeite({ params }: { params: Promise<{ privaterLink: string }> }) {
  const { privaterLink } = await params;
  const ansicht = await ladeLinkAnsicht(privaterLink);
  if (!ansicht.gueltig) return <GiltNicht titel={LINK_TEXT.ungueltigTitel} text={LINK_TEXT.ungueltig} />;
  return <ElternAnsicht token={privaterLink} team={ansicht.team} spieler={ansicht.spieler} termine={ansicht.termine} />;
}
