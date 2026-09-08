"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert, X } from "lucide-react";
import { ChipMenu } from "@/components/ui";

/* Eigene Datei, weil die Styleguide-Seite eine Server-Komponente ist —
   Lucide-Icons sind Funktionen und lassen sich nicht über die Server/Client-
   Grenze reichen.

   Gezeigt wird der Fall, für den der Baustein gebaut ist: eine Reihe von
   Chips, die Nutzertext tragen (Gruppennamen) und deren Menü sie umsortiert
   oder herausnimmt. Nicht anwendbare Einträge fehlen (am ersten Chip kein
   „Nach vorne"), statt ausgegraut dazustehen. */
export function ChipMenuDemo() {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  function eintraege(name: string, erster: boolean, letzter: boolean) {
    return [
      ...(erster
        ? []
        : [
            {
              label: "Nach vorne",
              icon: ChevronLeft,
              onSelect: () => setGewaehlt(`Nach vorne (${name})`),
            },
          ]),
      ...(letzter
        ? []
        : [
            {
              label: "Nach hinten",
              icon: ChevronRight,
              onSelect: () => setGewaehlt(`Nach hinten (${name})`),
            },
          ]),
      {
        label: "Aus dieser Übung nehmen",
        icon: X,
        danger: true,
        onSelect: () => setGewaehlt(`Entfernen (${name})`),
      },
    ];
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="type-label-small mb-2 text-on-surface-variant">
          Sequenz aus Nutzertext — jeder Chip ein Bedienelement, ein Tabstopp
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipMenu
            label="Gruppe 1"
            ariaLabel="Gruppe 1, Wechsel 1 von 3"
            items={eintraege("Gruppe 1", true, false)}
          />
          <ChevronRight
            size={14}
            strokeWidth={2}
            aria-hidden
            className="shrink-0 text-on-surface-variant"
          />
          <ChipMenu
            label="Gruppe 2"
            ariaLabel="Gruppe 2, Wechsel 2 von 3"
            items={eintraege("Gruppe 2", false, false)}
          />
          <ChevronRight
            size={14}
            strokeWidth={2}
            aria-hidden
            className="shrink-0 text-on-surface-variant"
          />
          <ChipMenu
            label="Torhüter"
            ariaLabel="Torhüter, Wechsel 3 von 3"
            items={eintraege("Torhüter", false, true)}
          />
        </div>
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-variant">
          tone=&quot;warning&quot; — Rahmen und Chevron, nie die Fläche
        </p>
        <ChipMenu
          tone="warning"
          label="Gruppe 2"
          ariaLabel="Gruppe 2 — doppelt belegt"
          leading={
            <TriangleAlert
              size={16}
              strokeWidth={2}
              aria-hidden
              className="shrink-0 text-warning"
            />
          }
          items={eintraege("Gruppe 2", false, true)}
        />
      </div>

      <p className="type-label-small text-on-surface-variant">
        {gewaehlt ? `gewählt: ${gewaehlt}` : "klicken oder Enter, dann ↑/↓"}
      </p>
    </div>
  );
}
