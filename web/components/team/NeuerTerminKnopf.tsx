"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender: ein einzelner Termin (#322 AK 1) oder — im
 *  selben Dialog mit «Wiederholender Termin» — eine Terminserie (#324 AK 1). */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <Button variant="tonal" onClick={() => a.neu()}>
      <CalendarPlus size={18} aria-hidden /> Termin festlegen
    </Button>
  );
}
