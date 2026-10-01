"use client";

import { useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { holeAboAktion } from "@/lib/actions/abos";
import { AboDialog } from "./AboDialog";

/** Der Einstieg ins Kalender-Abo im Trainingsplan eines Teams (#330 AK 1):
 *  holt den persönlichen Link (beim ersten Mal wird er angelegt, danach kommt
 *  derselbe, AK 6) und zeigt ihn im Dialog samt Warnung und Anleitung. */
export function AboKnopf({ teamId, teamName }: { teamId: string; teamName: string }) {
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
      {/* Nicht `disabled`: Ein gesperrter Knopf verliert den Fokus, und der
          Dialog könnte ihn beim Schliessen nicht dorthin zurückgeben. */}
      <Button variant="outlined" onClick={holen} aria-disabled={pending}>
        <CalendarDays size={18} aria-hidden /> Kalender abonnieren
      </Button>
      <AboDialog links={links} teamName={teamName} onClose={() => setLinks(null)} />
    </>
  );
}
