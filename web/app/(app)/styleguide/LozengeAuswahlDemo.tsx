"use client";

import { useState } from "react";
import { LozengeAuswahl } from "@/components/ui";
import { MELDE_STATUS } from "@/lib/termin-status";

/* Die LozengeAuswahl wie im Reiter «Spieler:innen» eines Spiels: eine Zeile
   ohne Meldung mit ihren möglichen Wechseln, «Nicht aufbieten» nach dem
   Trenner. Der Wechsel wirkt hier nur auf die Demo. */
export function LozengeAuswahlDemo() {
  const [status, setStatus] = useState<keyof typeof MELDE_STATUS>("ohne");
  const s = MELDE_STATUS[status];
  const ziele = (["angemeldet", "abgemeldet"] as const).filter((z) => z !== status);
  return (
    <div className="flex max-w-md items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block type-body-medium text-on-surface">Mia Keller</span>
        <span className="block type-body-small text-on-surface-mittel">noch keine Meldung</span>
      </span>
      <LozengeAuswahl
        wort={s.wort}
        appearance={s.appearance}
        ariaLabel={`Status Mia Keller: ${s.wort}`}
        wechsel={
          status === "nichtAufgeboten"
            ? [{ handlung: "Aufbieten", ziel: MELDE_STATUS.ohne, onSelect: () => setStatus("ohne") }]
            : [
                ...ziele.map((z) => ({
                  handlung: z === "angemeldet" ? "Anmelden" : "Abmelden",
                  ziel: MELDE_STATUS[z],
                  onSelect: () => setStatus(z),
                })),
                { handlung: "Nicht aufbieten", ziel: MELDE_STATUS.nichtAufgeboten, trenner: true, onSelect: () => setStatus("nichtAufgeboten") },
              ]
        }
      />
    </div>
  );
}
