"use client";

import { useState } from "react";
import { Switch } from "@/components/ui";

/* Der Schalter an seinem Anwendungsfall: eine Spieler:in an einem Termin
   angemeldet (Ton «ruhig») oder abgemeldet, dazu gesperrt (begonnen), neutral
   (ausgefallen) und ein Schalter, dessen Aus neutral ist (Selbstabholung). */
export function SwitchDemo() {
  const [lena, setLena] = useState(true);
  const [noah, setNoah] = useState(false);
  const [selbst, setSelbst] = useState(false);
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
        <span className="min-w-0 flex-1 type-body-medium text-on-surface-mittel">Begonnen (gesperrt)</span>
        <Switch ton="ruhig" checked readOnly disabled aria-label="Begonnen, angemeldet" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface-mittel">Ausgefallen (neutral)</span>
        <Switch checked={false} readOnly disabled neutral aria-label="Fällt aus" />
      </li>
      <li className="flex items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 type-body-medium text-on-surface-mittel">Selbstabholung (aus neutral)</span>
        <Switch checked={selbst} neutral={!selbst} onChange={(e) => setSelbst(e.target.checked)} aria-label="Selbstabholung" />
      </li>
    </ul>
  );
}
