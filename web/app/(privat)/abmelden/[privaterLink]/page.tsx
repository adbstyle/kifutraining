import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { ElternAnsicht } from "@/components/privat/ElternAnsicht";
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
  if (!ansicht.gueltig) return <LinkGiltNicht />;
  return <ElternAnsicht token={privaterLink} team={ansicht.team} spieler={ansicht.spieler} termine={ansicht.termine} />;
}

/* Erneuert, entfernt oder nie vergeben — alle gleich (AK 10, 11). */
function LinkGiltNicht() {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-4 px-6 py-8">
      <Link2Off size={48} strokeWidth={1.6} className="text-on-surface-mittel" aria-hidden />
      <h1 className="type-headline-small text-on-surface">{LINK_TEXT.ungueltigTitel}</h1>
      <p className="type-body-large text-on-surface-mittel">{LINK_TEXT.ungueltig}</p>
    </div>
  );
}
