"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { verfallText } from "@/lib/spieler";

/* Verlegen lässt Abmeldungen verfallen (#437 AK 1, PC 1): Wer sich für den
   alten Zeitpunkt abgemeldet hat, gilt am neuen wieder als angemeldet. Das
   erfährt man vor dem Speichern — für einen einzelnen Termin und beim
   Zurücksetzen der Zeit auf die der Serie. Für die Serie sagt es
   `EntfallendBestaetigung`. */
export function VerfallBestaetigung({
  anzahl,
  pending,
  onClose,
  onBestaetigen,
}: {
  /** `null`: geschlossen. */
  anzahl: number | null;
  pending?: boolean;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  return (
    <Dialog
      open={anzahl !== null}
      onClose={onClose}
      title="Abmeldungen verfallen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={pending} onClick={onBestaetigen}>Trotzdem ändern</Button>
        </>
      }
    >
      <p className="flex items-start gap-2">
        <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />
        <span>{anzahl !== null && verfallText(anzahl)} Wer am neuen Zeitpunkt nicht kann, meldet sich neu ab.</span>
      </p>
    </Dialog>
  );
}
