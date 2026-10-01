"use client";

import { Button } from "@/components/ui";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender: ein einzelner Termin (#322 AK 1) oder — im
 *  selben Dialog mit «Wiederholender Termin» — eine Terminserie (#324 AK 1). */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <Button variant="filled" size="sm" onClick={() => a.neu()}>
      Termin erstellen
    </Button>
  );
}
