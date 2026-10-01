"use client";

import { useEffect, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import type { Reichweite } from "@/lib/serie";

const TEXT: Record<Reichweite, string> = {
  nur_dieser: "Nur dieser Termin",
  dieser_und_folgende: "Dieser und alle folgenden",
  alle: "Alle Termine der Serie",
};

const REIHENFOLGE: readonly Reichweite[] = ["nur_dieser", "dieser_und_folgende", "alle"];

/* Wie in gängigen Kalendern (PO 16): Für welchen Teil der Serie gilt es?
   Welche Wahl erlaubt ist, entscheidet, was sich ändert — das Datum nur für
   diesen Termin, Wochentage und Zeitraum nur für folgende oder alle
   (#326 AK 1–4, 7; `erlaubteReichweiten` in lib/serie.ts). Bleibt nur eine
   Wahl, ist sie vorgewählt und der Hinweis sagt, warum. */
export function ReichweiteDialog({
  open,
  titel,
  erlaubt,
  hinweis,
  pending,
  onClose,
  onWahl,
}: {
  open: boolean;
  titel: string;
  erlaubt: readonly Reichweite[];
  hinweis?: string;
  pending?: boolean;
  onClose: () => void;
  onWahl: (r: Reichweite) => void;
}) {
  const [wahl, setWahl] = useState<Reichweite | null>(null);
  const schluessel = erlaubt.join();
  // Beim Öffnen zurücksetzen — sonst stünde die Wahl des letzten Aufrufs da.
  useEffect(() => {
    if (open) setWahl(erlaubt.length === 1 ? erlaubt[0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schluessel]);

  const optionen = REIHENFOLGE.filter((r) => erlaubt.includes(r));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={!wahl || pending} onClick={() => wahl && onWahl(wahl)}>Weiter</Button>
        </>
      }
    >
      {hinweis && <p className="mb-3">{hinweis}</p>}
      <ChoiceChipGroup ariaLabel="Gilt für" className="flex-col items-start">
        {optionen.map((r, i) => (
          <ChoiceChip key={r} tabStop={i === 0 && !wahl} selected={wahl === r} onSelect={() => setWahl(r)} look="nutzertext">
            {TEXT[r]}
          </ChoiceChip>
        ))}
      </ChoiceChipGroup>
    </Dialog>
  );
}
