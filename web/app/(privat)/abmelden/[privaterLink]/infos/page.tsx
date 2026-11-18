import type { Metadata } from "next";
import { LinkInfos } from "@/components/privat/LinkInfos";
import { FeedbackLink } from "@/components/privat/FeedbackLink";
import { GiltNicht } from "@/components/privat/GiltNicht";
import { ladeLinkAnsicht } from "@/lib/privater-link";
import { LINK_TEXT } from "@/lib/spieler";

/* Die Infos am privaten Link (#598 AK 10): alle Erklärungen an einem Ort,
   hinter dem ⓘ neben dem Namen — dieselbe Adresse plus «/infos», kein zweiter
   Link. Sie liest wie die Termin-Seite neu bei jedem Aufruf; ein erneuerter
   Link gilt auch hier sofort nicht mehr.

   Titel und Beschreibung sind fest wie auf der Termin-Seite (keine Namen in
   der Vorschau eines Chats); der Parameter heisst `privaterLink`, damit die
   Besucherstatistik die Seite nicht zählt. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Infos - KiFu",
  description: "Infos zum Team und wie das Melden geht.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function LinkInfosSeite({ params }: { params: Promise<{ privaterLink: string }> }) {
  const { privaterLink } = await params;
  const ansicht = await ladeLinkAnsicht(privaterLink);
  if (!ansicht.gueltig) return <GiltNicht titel={LINK_TEXT.ungueltigTitel} text={LINK_TEXT.ungueltig} />;
  return (
    <>
      <LinkInfos
        token={privaterLink}
        teams={ansicht.teams}
        spieler={ansicht.spieler}
        verein={ansicht.verein}
        schnuppert={!!ansicht.probe}
        probeInfo={ansicht.probe_info ?? null}
        teamInfos={ansicht.team_infos ?? []}
      />
      <FeedbackLink token={privaterLink} ohneTeam={ansicht.teams.length === 0} verein={ansicht.verein} />
    </>
  );
}
