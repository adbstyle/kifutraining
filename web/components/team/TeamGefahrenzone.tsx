"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { SectionMessage, Button, Dialog, Gefahrenzone } from "@/components/ui";
import { verlasseTeam, type MitgliedschaftResult } from "@/lib/actions/teams";

/* Team verlassen — in der Gefahrenzone der Teamverwaltung (Story 13, #581).

   Verlassen betrifft nur die eigene Person. Auch als letztes Mitglied bleibt
   das Team bestehen, ohne Trainer:in: Auflösen kann es nur die Vereinsverwaltung
   im Bereich «Verein» (AK 28) — darum verlangt der Austritt keine Namenseingabe.
   Als letzte Person nennt der Dialog zusätzlich, was dann gilt.

   Scheitert der Austritt, bleibt der Dialog offen und nennt den Grund als
   Section Message — dort, wo man erneut versuchen oder abbrechen kann. Eine
   Snackbar läge unter dem Dialog (Material, #234). Nur wenn es das Team nicht
   mehr gibt (PC 5), gibt es nichts mehr zu verlassen: dann zurück zu den
   Teams, die es per Snackbar melden (`?weg=1`). */
export function TeamGefahrenzone({
  teamId,
  anzahlMitglieder,
}: {
  teamId: string;
  anzahlMitglieder: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const letzte = anzahlMitglieder <= 1;

  function oeffnen() {
    // Der Dialog bleibt im DOM; jeder Anlauf beginnt ohne die alte Meldung.
    setFehler(null);
    setOffen(true);
  }

  function schliessen() {
    if (!pending) setOffen(false);
  }

  function behandle(res: MitgliedschaftResult) {
    switch (res.status) {
      case "entfernt":
        router.push("/teams");
        return;
      case "team_weg":
        setOffen(false);
        router.push("/teams?weg=1");
        return;
      case "fehler":
        setFehler(res.error);
    }
  }

  function verlassen() {
    startTransition(async () => behandle(await verlasseTeam(teamId)));
  }

  return (
    <Gefahrenzone beschreibung="Du verlierst den Zugang zu Kalender, Spieler:innen und Team-Trainings. Das Team bleibt bestehen, auch wenn du die letzte Person bist.">
      <Button variant="outlined" disabled={pending} onClick={oeffnen}>
        <LogOut size={18} strokeWidth={2} aria-hidden />
        Team verlassen
      </Button>

      <Dialog
        open={offen}
        onClose={schliessen}
        title="Team verlassen?"
        actions={
          <>
            <Button variant="outlined" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={verlassen} disabled={pending}>
              Verlassen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
          <p>
            Du siehst die Trainings und Termine dieses Teams danach nicht mehr. Das Team bleibt bestehen. Deine
            persönlichen Trainings - auch Kopien, die du zu dir übernommen hast - bleiben unberührt.
          </p>
          {letzte && (
            <SectionMessage appearance="warning">
              Du bist die letzte Trainer:in. Das Team bleibt ohne Trainer:in bestehen; neue nimmt die Vereinsverwaltung
              auf, und nur sie kann das Team auflösen.
            </SectionMessage>
          )}
        </div>
      </Dialog>
    </Gefahrenzone>
  );
}
