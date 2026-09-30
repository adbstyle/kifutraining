"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender (#322 AK 1). Teil B stellt «Terminserie
 *  festlegen» daneben. */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <Button variant="tonal" onClick={() => a.neu()}>
      <CalendarPlus size={18} aria-hidden /> Termin festlegen
    </Button>
  );
}
