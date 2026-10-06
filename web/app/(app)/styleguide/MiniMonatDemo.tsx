"use client";

import { useState } from "react";
import { MiniMonat, type Marke } from "@/components/ui";

/* Der Mini-Monat mit festen Beispieltagen (Oktober 2026, «heute» der 6.):
   alle vier Zustände, ein Tag mit drei Terminen («+2»), ein belegter Tag und
   eine Marke in der Randwoche. In der Anwendung sind es die Termine des
   Teams neben dem Trainingsplan (`PlanMonat`). */
const MARKEN: Record<string, Marke[]> = {
  "2026-09-29": [{ id: "a", zustand: "ohne", label: "29. September, vergangen ohne Training" }],
  "2026-10-01": [{ id: "b", zustand: "training", label: "1. Oktober, Training" }],
  "2026-10-06": [
    { id: "c", zustand: "training", label: "6. Oktober, 17:30, Training" },
    { id: "d", zustand: "noch-nicht", label: "6. Oktober, 19:30, noch kein Training" },
  ],
  "2026-10-08": [{ id: "e", zustand: "noch-nicht", label: "8. Oktober, noch kein Training" }],
  "2026-10-11": [{ id: "f", zustand: "ausgefallen", label: "11. Oktober, ausgefallen" }],
  "2026-10-15": [
    { id: "g", zustand: "training", label: "15. Oktober, 17:00, Training" },
    { id: "h", zustand: "noch-nicht", label: "15. Oktober, 18:00, noch kein Training" },
    { id: "i", zustand: "noch-nicht", label: "15. Oktober, 19:00, noch kein Training" },
  ],
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
