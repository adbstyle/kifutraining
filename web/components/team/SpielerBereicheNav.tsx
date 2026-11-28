"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TabNav } from "@/components/ui";
import { SPIELER_BEREICHE, teamBereichAusPfad, teamBereichHref } from "@/lib/team-bereiche";

/* Die Reiter unter «Spieler:innen» (#704): die Sichten auf die Spieler:innen
   des Teams. Links mit eigener Adresse (`TabNav`), damit eine Sicht als
   Lesezeichen taugt und weitergegeben werden kann; der offene Reiter ist
   markiert. Die Reiter tragen Eingrenzung und Zeitraum weiter
   (`REISENDE_SCHLUESSEL`, #704 AK 5) und springen beim Wechsel nicht nach oben.

   Die Suchparameter liest nur der innere Teil; bis sie da sind, stehen die
   Reiter ohne Eingrenzung (Suspense-Rückfall), nie gar nicht. */
export function SpielerBereicheNav({ teamId }: { teamId: string }) {
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
      ariaLabel="Sichten auf die Spieler:innen"
      scroll={false}
      items={SPIELER_BEREICHE.map((b) => ({
        label: b.label,
        href: teamBereichHref(teamId, b.schluessel, suche),
        current: b.schluessel === offen,
      }))}
    />
  );
}
