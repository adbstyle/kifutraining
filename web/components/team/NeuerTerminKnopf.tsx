"use client";

import { CalendarPlus, Repeat } from "lucide-react";
import { Button } from "@/components/ui";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender: ein einzelner Termin (#322 AK 1) oder eine
 *  Terminserie (#324 AK 1). */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="tonal" onClick={() => a.neu()}>
        <CalendarPlus size={18} aria-hidden /> Termin festlegen
      </Button>
      <Button variant="outlined" onClick={() => a.neueSerie()}>
        <Repeat size={18} aria-hidden /> Terminserie festlegen
      </Button>
    </div>
  );
}
