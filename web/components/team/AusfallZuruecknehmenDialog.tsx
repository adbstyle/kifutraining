"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, SectionMessage } from "@/components/ui";
import { AUSFALL_ZURUECKNEHMEN_TEXT } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";
import { BenachrichtigenFeld } from "./BenachrichtigenFeld";

/* Den Ausfall eines Termins von heute oder später zurücknehmen (#327 AK 6)
   und dabei entscheiden, ob die Spielervertretungen erfahren, dass er doch
   stattfindet (#643 AK 1; vorbelegt an). Bei einem vergangenen Termin gibt es
   nichts zu entscheiden: Dort bleibt das Zurücknehmen ein Klick ohne Dialog
   (TerminBereich). Ob der Ausfall mit Benachrichtigung gespeichert wurde,
   zeigt der Dialog nicht (OoS 5). */
export function AusfallZuruecknehmenDialog({
  termin,
  pending,
  fehler,
  onClose,
  onZuruecknehmen,
}: {
  termin: TerminZeile | null;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  onClose: () => void;
  onZuruecknehmen: (benachrichtigen: boolean) => void;
}) {
  const [benachrichtigen, setBenachrichtigen] = useState(true);
  useEffect(() => {
    setBenachrichtigen(true);
  }, [termin]);

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={AUSFALL_ZURUECKNEHMEN_TEXT.titel}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={pending} onClick={() => onZuruecknehmen(benachrichtigen)}>
            {AUSFALL_ZURUECKNEHMEN_TEXT.knopf}
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      <p className="mb-4">{termin ? datumKurz(termin.datum) : ""}</p>
      <div className="border-t border-linie pt-4">
        <BenachrichtigenFeld vorgang="ruecknahme" className="px-3.5" checked={benachrichtigen} onChange={setBenachrichtigen} disabled={pending} />
      </div>
    </Dialog>
  );
}
