"use client";

import type { ReactNode } from "react";

/* Hinweis oder Fehler unter einem Feld (`Feld`). Er hellt beim Überfahren mit
   dem Feld auf und gehört damit zu ihm — ein Klick darauf wirkt darum wie
   einer auf den Namen (PO 2026-10-31): Er klickt das Label, und das führt ins
   Feld oder öffnet die Auswahl, genau wie dort. Ein eigenes Label ist er
   nicht, sonst läse die Vorlesehilfe ihn als Teil des Namens. Ein eigener
   Baustein, weil `Feld` auch auf dem Server gerendert wird und dort keinen
   Klick tragen kann. */
export function FeldHinweis({
  feldId,
  className,
  children,
  ...props
}: {
  feldId: string;
  className: string;
  children: ReactNode;
  id?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <p {...props} className={className} onClick={() => document.getElementById(`${feldId}-label`)?.click()}>
      {children}
    </p>
  );
}
