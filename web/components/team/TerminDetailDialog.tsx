"use client";

import { Button, Dialog } from "@/components/ui";
import { TerminKarte } from "./TrainingsPlan";
import type { TerminZeile } from "@/lib/queries/termine";

/* Ein Termin aus dem Monatsüberblick geöffnet (#329 AK 8): dieselbe Karte wie
   in der Liste, also dieselben Angaben und Aktionen. Jede Aktion der Karte
   schliesst diesen Dialog zuerst (`TerminBereich`), damit nie zwei Dialoge
   übereinander liegen.

   Das Panel der Karte (OverflowMenu) schwebt über den Dialogrand hinaus;
   darum `overflow-visible` statt dem Scrollen, das <dialog> von Haus aus hat. */
export function TerminDetailDialog({ termin, heute, onClose }: { termin: TerminZeile | null; heute: string; onClose: () => void }) {
  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title="Termin"
      className="overflow-visible"
      actions={<Button variant="text" onClick={onClose}>Schliessen</Button>}
    >
      {termin && <ul><TerminKarte t={termin} heute={heute} ebene="h3" /></ul>}
    </Dialog>
  );
}
