"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { deleteAccount } from "@/lib/actions/auth";

/* Konto-Löschung mit ausdrücklicher Bestätigung und Konsequenz-Hinweis
   (Story 9 EK2/EK3). */
export function KontoClient() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 size={18} strokeWidth={2} aria-hidden />
        Konto löschen
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Konto wirklich löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <form action={deleteAccount}>
              <Button type="submit" variant="danger">
                Konto endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2">
            <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-error" aria-hidden />
            <span>Diese Aktion kann nicht rückgängig gemacht werden.</span>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Deine <strong>öffentlichen</strong> Übungen bleiben anonymisiert erhalten und werden unveränderlich.</li>
            <li>Deine <strong>privaten</strong> Übungen werden samt Feld-Diagramm gelöscht.</li>
            <li>Du wirst abgemeldet und dein Konto entfernt.</li>
          </ul>
        </div>
      </Dialog>
    </>
  );
}
