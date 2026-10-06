"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { datumKurz } from "@/lib/zeit";
import type { SerienFolge } from "@/lib/kern/serien";

/* Fallen Termine weg, muss das bestätigt werden (#326 AK 8). Genannt werden
   nur die wegfallenden Termine MIT Training (OoS 2), je mit dem, was ihrem
   Training geschieht: Ein Termin-Training wird mitgelöscht, ein Training aus
   dem Bestand bleibt dort (PO 2026-10-06). Eine Anzahl nennt der Dialog
   nicht (OoS 4).

   `SerienFolge` ist ein reiner Typ: `import type` zieht nichts aus dem
   server-only Fachkern in das Client-Bundle. */
export function EntfallendBestaetigung({
  folge,
  aktion,
  pending,
  onClose,
  onBestaetigen,
}: {
  folge: SerienFolge | null;
  aktion: "aendern" | "entfernen";
  pending?: boolean;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  return (
    <Dialog
      open={folge !== null}
      onClose={onClose}
      title={aktion === "entfernen" ? "Termine entfernen?" : "Termine fallen weg"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="danger" disabled={pending} onClick={onBestaetigen}>
            {aktion === "entfernen" ? "Entfernen" : "Ändern"}
          </Button>
        </>
      }
    >
      <p className="flex items-start gap-2">
        <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-error" />
        Termine der Serie fallen damit weg.
      </p>
      {folge && folge.entfallend.length > 0 && (
        <>
          <p className="mt-3">Diese tragen ein Training:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {folge.entfallend.map((e) => (
              <li key={e.terminId}>
                {datumKurz(e.datum)} - <strong className="text-on-surface">{e.training.name}</strong>
                {e.training.terminTraining ? " wird mitgelöscht" : " bleibt im Team-Bestand"}
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
