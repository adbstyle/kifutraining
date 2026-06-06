"use client";

import { useEffect, useState } from "react";
import { Snackbar } from "@/components/ui";

/** Kurze Erfolgsmeldung (z. B. nach Erstellen/Bearbeiten), liest einen
 *  Query-Param via Prop, blendet sich nach ein paar Sekunden aus. */
export function Flash({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 4500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto">
        <Snackbar open={open} message={message} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
