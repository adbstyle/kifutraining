"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TabNav } from "@/components/ui";
import { TEAM_BEREICHE, teamBereichAusPfad, teamBereichHref } from "@/lib/team-bereiche";

/* Die Reiter der Team-Verwaltung (#656): Spieler:innen | Kader & Schnuppern |
   Privater Link | Trainer:innen. Links mit eigener Adresse (`TabNav`), damit
   ein Bereich als Lesezeichen taugt und weitergegeben werden kann (AK 2); der
   offene Reiter ist markiert (AK 3). Die Reiter tragen die Eingrenzung der
   Spielerliste weiter (#601) und springen beim Wechsel nicht nach oben.

   Die Suchparameter liest nur der innere Teil; bis sie da sind, stehen die
   Reiter ohne Eingrenzung (Suspense-Rückfall), nie gar nicht. */
export function TeamBereicheNav({ teamId }: { teamId: string }) {
  return (
    <Suspense fallback={<Reiter teamId={teamId} />}>
      <ReiterMitEingrenzung teamId={teamId} />
    </Suspense>
  );
}

function ReiterMitEingrenzung({ teamId }: { teamId: string }) {
  const suche = useSearchParams();
  return <Reiter teamId={teamId} suche={new URLSearchParams(suche.toString())} />;
}

function Reiter({ teamId, suche }: { teamId: string; suche?: URLSearchParams }) {
  const offen = teamBereichAusPfad(usePathname(), teamId);
  return (
    <TabNav
      ariaLabel="Bereiche des Teams"
      scroll={false}
      items={TEAM_BEREICHE.map((b) => ({
        label: b.label,
        href: teamBereichHref(teamId, b.schluessel, suche),
        current: b.schluessel === offen,
      }))}
    />
  );
}
