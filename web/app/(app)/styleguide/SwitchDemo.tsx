"use client";

import { useState } from "react";
import { Switch } from "@/components/ui";

/* Der Schalter an seinem Anwendungsfall: eine Spieler:in an einem Termin
   angemeldet (Ton «ruhig») oder abgemeldet, eine Trainer:in dabei (Proton),
   der eigene Stand abgesagt oder nicht eingeladen (`leer`, #691), dazu
   gesperrt (begonnen). */
export function SwitchDemo() {
  const [lena, setLena] = useState(true);
  const [noah, setNoah] = useState(false);
  const [dabei, setDabei] = useState(true);
  return (
    <ul className="flex max-w-sm flex-col divide-y divide-linie rounded-flaeche bg-elev-01">
      {[
        { name: "Lena Meier", an: lena, setze: setLena },
        { name: "Noah Keller", an: noah, setze: setNoah },
      ].map((s) => (
        <li key={s.name} className="flex items-center gap-3 px-4 py-2">
          <span className={`min-w-0 flex-1 type-body-medium ${s.an ? "text-on-surface" : "text-on-surface-mittel"}`}>{s.name}</span>
          <Switch ton="ruhig" checked={s.an} onChange={(e) => s.setze(e.target.checked)} aria-label={`${s.name} angemeldet`} />
        </li>
      ))}
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface">Trainer:in dabei (Proton)</span>
        <Switch checked={dabei} onChange={(e) => setDabei(e.target.checked)} aria-label="Trainer:in dabei" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface">Eigener Stand: abgesagt</span>
        <Switch checked={false} readOnly aria-label="Ich bin dabei, abgesagt" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface">Eigener Stand: nicht eingeladen (leer)</span>
        <Switch checked={false} leer readOnly aria-label="Aushelfen, nicht eingeladen" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface-mittel">Eigener Stand begonnen (zeigtStand)</span>
        <Switch checked readOnly disabled zeigtStand aria-label="Ich bin dabei, begonnen" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface-mittel">Begonnen (gesperrt)</span>
        <Switch ton="ruhig" checked readOnly disabled aria-label="Begonnen, angemeldet" />
      </li>
    </ul>
  );
}
