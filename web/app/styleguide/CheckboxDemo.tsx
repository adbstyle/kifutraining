"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui";

/* Die Checkbox an ihren Anwendungsfällen: die Wiederholung im Termin-Dialog,
   dazu der gesperrte Zustand. */
export function CheckboxDemo() {
  const [an, setAn] = useState(true);
  return (
    <div className="flex flex-col items-start gap-4">
      <Checkbox label="Wiederholender Termin" checked={an} onChange={(e) => setAn(e.target.checked)} />
      <Checkbox label="Foto entfernen" disabled />
    </div>
  );
}
