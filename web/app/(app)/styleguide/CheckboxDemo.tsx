"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui";

/* Die Checkbox an ihren Anwendungsfällen: die Wiederholung im Termin-Dialog,
   der gesperrte Zustand und «teilweise» beim Zuteilen von Kadern (#452). */
export function CheckboxDemo() {
  const [an, setAn] = useState(true);
  const [kader, setKader] = useState<"teil" | "alle" | "keine">("teil");
  return (
    <div className="flex flex-col items-start gap-4">
      <Checkbox label="Wiederholender Termin" checked={an} onChange={(e) => setAn(e.target.checked)} />
      <Checkbox label="Foto entfernen" disabled />
      <Checkbox
        label="Aushilfe"
        checked={kader === "alle"}
        teilweise={kader === "teil"}
        onChange={() => setKader((k) => (k === "alle" ? "keine" : "alle"))}
      />
    </div>
  );
}
