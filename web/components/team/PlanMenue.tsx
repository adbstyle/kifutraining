"use client";

import { useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { OverflowMenu } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { holeAboAktion } from "@/lib/actions/abos";
import { AboDialog } from "./AboDialog";

/** Das ⋮ des Trainingsplans — darin der Einstieg ins Kalender-Abo (#330 AK 1).
 *  Er holt den persönlichen Link (beim ersten Mal wird er angelegt, danach
 *  kommt derselbe, AK 6) und zeigt ihn im Dialog samt Warnung und Anleitung.
 *  Das Abo richtet man einmal ein; offen neben «Termin erstellen» stünde es
 *  bei jedem Besuch im Weg. Nach der Wahl liegt der Fokus wieder auf dem ⋮,
 *  und der Dialog gibt ihn beim Schliessen dorthin zurück. */
export function PlanMenue({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [pending, startTransition] = useTransition();
  const melde = useSnackbar();
  const [links, setLinks] = useState<{ url: string; webcal: string } | null>(null);

  function holen() {
    if (pending) return;
    startTransition(async () => {
      const res = await holeAboAktion(teamId);
      if (!res.ok) {
        melde(res.error);
        return;
      }
      setLinks({ url: res.url, webcal: res.webcal });
    });
  }

  return (
    <>
      <OverflowMenu
        label="Weitere Aktionen zum Trainingsplan"
        items={[{ label: "Kalender abonnieren", icon: CalendarDays, onSelect: holen }]}
      />
      <AboDialog links={links} teamName={teamName} onClose={() => setLinks(null)} />
    </>
  );
}
