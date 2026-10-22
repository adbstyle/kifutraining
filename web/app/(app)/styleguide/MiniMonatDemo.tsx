"use client";

import { useState } from "react";
import { MiniMonat, type Marke } from "@/components/ui";

/* Der Mini-Monat mit festen Beispieltagen (Oktober 2026, «heute» der 6.):
   Tage mit Training oder Spiel hell, ein Tag mit nur einem ausgefallenen
   Termin grau, ein Tag mit einem stattfindenden und einem ausgefallenen hell,
   ein belegter Tag und ein Termin in der Randwoche. In der Anwendung sind es
   die Termine des Teams neben dem Trainingsplan (`PlanMonat`). */
const MARKEN: Record<string, Marke[]> = {
  "2026-09-29": [{ id: "a", ausgefallen: false, label: "18:00 Training" }],
  "2026-10-01": [{ id: "b", ausgefallen: false, label: "18:00 Passspiel im Dreieck" }],
  "2026-10-06": [
    { id: "c", ausgefallen: false, label: "17:30 Training" },
    { id: "d", ausgefallen: true, label: "19:30 Training" },
  ],
  "2026-10-10": [{ id: "s", ausgefallen: false, label: "10:00 Spiel Meisterschaft gegen FC Bümpliz" }],
  "2026-10-11": [{ id: "f", ausgefallen: true, label: "14:00 Spiel Freundschaftsspiel FC Breitenrain" }],
  "2026-10-15": [{ id: "g", ausgefallen: false, label: "17:00 Training" }],
};

export function MiniMonatDemo() {
  const [monat, setMonat] = useState("2026-10");
  const [gewaehlt, setGewaehlt] = useState<string>();
  return (
    <div className="w-72">
      <MiniMonat
        monat={monat}
        heute="2026-10-06"
        marken={(tag) => MARKEN[tag] ?? []}
        belegt={(tag) => tag === "2026-10-21"}
        onWahl={setGewaehlt}
        onMonat={setMonat}
        hinweis="Nur deine Termine"
      />
      <p className="mt-2 type-body-small text-on-surface-mittel">Gewählt: {gewaehlt ?? "-"}</p>
    </div>
  );
}
