"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { verfallDialogText } from "@/lib/spieler";

/* Verlegen lässt Abmeldungen verfallen (#437 AK 1, PC 1): Wer sich für den
   alten Zeitpunkt abgemeldet hat, gilt am neuen wieder als angemeldet. Das
   erfährt man vor dem Speichern — für einen einzelnen Termin und beim
   Zurücksetzen der Zeit auf die der Serie. Für die Serie sagt es
   `EntfallendBestaetigung`. Dieselbe Rückfrage stellt eine Änderung an
   Kadern, die Spieler:innen aus Terminen nimmt (#453 AK 10) — dann mit dem
   Satz `text`, und mit dem aktuellen Stand, wenn die Zahl inzwischen eine
   andere ist (AK 12). */
export function VerfallBestaetigung({
  anzahl,
  text,
  pending,
  onClose,
  onBestaetigen,
}: {
  /** `null`: geschlossen. */
  anzahl: number | null;
  /** Statt des Satzes zur Verlegung. */
  text?: string;
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
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={pending} onClick={onBestaetigen}>Trotzdem ändern</Button>
        </>
      }
    >
      <p className="flex items-start gap-2">
        <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-icon-warning" />
        <span>{anzahl !== null && (text ?? verfallDialogText(anzahl))}</span>
      </p>
    </Dialog>
  );
}
