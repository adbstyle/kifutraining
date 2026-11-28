"use client";

import { Button } from "@/components/ui";
import { KopfKnopfText } from "@/components/layout/KopfAktionen";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender: ein einzelner Termin (#322 AK 1) oder — im
 *  selben Dialog mit «Wiederholender Termin» — eine Terminserie (#324 AK 1).
 *  Die Hauptaktion des Trainingsplans in seiner Kopfzeile, schmal kurz
 *  «Erstellen» (#706). */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <Button variant="filled" aria-haspopup="dialog" onClick={() => a.neu()}>
      <KopfKnopfText label="Termin erstellen" kurz="Erstellen" />
    </Button>
  );
}
