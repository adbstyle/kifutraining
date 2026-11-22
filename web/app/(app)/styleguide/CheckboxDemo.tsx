"use client";

import { useState } from "react";
import { Button, Checkbox } from "@/components/ui";

/* Die Checkbox an ihren Anwendungsfällen: die Wiederholung im Termin-Dialog,
   der gesperrte Zustand, «teilweise» beim Zuteilen von Kadern (#452) und die
   Pflicht-Bestätigung beim Gründen eines Vereins (#587). */
export function CheckboxDemo() {
  const [an, setAn] = useState(true);
  const [berechtigt, setBerechtigt] = useState(false);
  const [verantwortlich, setVerantwortlich] = useState(false);
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
      <div className="mt-2 flex max-w-md flex-col gap-1">
        <Checkbox label="Ich bin berechtigt, für diesen Verein zu handeln." checked={berechtigt} onChange={(e) => setBerechtigt(e.target.checked)} />
        <Checkbox
          label="Der Verein ist für die Daten seiner Spieler:innen verantwortlich und Ansprechpartner für sie, ihre Eltern und Vertretungen."
          checked={verantwortlich}
          onChange={(e) => setVerantwortlich(e.target.checked)}
        />
        <Button variant="filled" className="mt-2 self-start" disabled={!(berechtigt && verantwortlich)}>
          Verein gründen
        </Button>
      </div>
    </div>
  );
}
