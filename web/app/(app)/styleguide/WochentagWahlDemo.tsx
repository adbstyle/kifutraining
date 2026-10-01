"use client";

import { useState } from "react";
import { WochentagWahl } from "@/components/ui";
import type { Wochentag } from "@/lib/serie";

/* Die Wochentagwahl an ihrem Anwendungsfall: die Tage einer Terminserie.
   Vorbelegt Di und Do, dazu der Fehlerzustand einer leeren Wahl. */
export function WochentagWahlDemo() {
  const [wert, setWert] = useState<Wochentag[]>([2, 4]);
  return (
    <div className="flex max-w-md flex-col gap-6">
      <WochentagWahl wert={wert} onChange={setWert} error={wert.length === 0 ? "Bitte mindestens einen Wochentag wählen." : undefined} />
    </div>
  );
}
