"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, TriangleAlert, X } from "lucide-react";
import { ChipMenu } from "@/components/ui";

/* Eigene Datei, weil die Styleguide-Seite eine Server-Komponente ist —
   Lucide-Icons sind Funktionen und lassen sich nicht über die Server/Client-
   Grenze reichen.

   Gezeigt wird der Fall, für den der Baustein gebaut ist: eine Reihe von
   Chips, die Nutzertext tragen (Gruppennamen) und deren Menü sie umsortiert
   oder herausnimmt. Nicht anwendbare Einträge fehlen (am ersten Chip kein
   „Nach vorne"), statt ausgegraut dazustehen. Darunter die geteilte Bauform,
   bei der an demselben Wert zwei Aufgaben hängen. */
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

      <GeteilterChipDemo onMeldung={setGewaehlt} />

      <div>
        <p className="type-label-small mb-2 text-on-surface-variant">
          tone=&quot;warning&quot; — Rahmen und Chevron, nie die Fläche; dazu ein
          gedämpfter <code>trailing</code>-Zusatz
        </p>
        <ChipMenu
          tone="warning"
          label="Rot"
          ariaLabel="Rot — doppelt belegt"
          leading={
            <TriangleAlert
              size={16}
              strokeWidth={2}
              aria-hidden
              className="shrink-0 text-warning"
            />
          }
          trailing={<span className="text-on-surface-variant">· 24 min</span>}
          items={eintraege("Rot", false, true)}
        />
      </div>

      <p className="type-body-small text-on-surface-variant">
        {gewaehlt ? `gewählt: ${gewaehlt}` : "klicken oder Enter, dann ↑/↓"}
      </p>
    </div>
  );
}

/* Der geteilte Chip — links wählen, rechts verwalten. Eigene Komponente, weil
   er einen eigenen Zustand hat (welche Variante gerade angezeigt wird), und
   genau das ist der Punkt: Wechseln ist die häufigste Handlung der Leiste und
   kostet EINEN Klick; das Menü daneben trägt alles Seltenere. */
function GeteilterChipDemo({ onMeldung }: { onMeldung: (text: string) => void }) {
  const varianten = ["Standard", "21 Kinder, zwei Trainer", "Halle"];
  const [aktiv, setAktiv] = useState("Standard");

  function eintraege(name: string, erster: boolean, letzter: boolean) {
    return [
      // «Anzeigen» nur, wo es etwas zu wechseln gibt — am angezeigten Chip
      // wäre der Eintrag ein Knopf ohne Wirkung.
      ...(name === aktiv
        ? []
        : [{ label: "Anzeigen", icon: Eye, onSelect: () => setAktiv(name) }]),
      { label: "Bearbeiten", icon: Pencil, onSelect: () => onMeldung(`Bearbeiten (${name})`) },
      ...(erster
        ? []
        : [
            {
              label: "Nach vorne",
              icon: ChevronLeft,
              onSelect: () => onMeldung(`Nach vorne (${name})`),
            },
          ]),
      ...(letzter
        ? []
        : [
            {
              label: "Nach hinten",
              icon: ChevronRight,
              onSelect: () => onMeldung(`Nach hinten (${name})`),
            },
          ]),
      {
        label: "Entfernen",
        icon: X,
        danger: true,
        onSelect: () => onMeldung(`Entfernen (${name})`),
      },
    ];
  }

  return (
    <div>
      <p className="type-label-small mb-2 text-on-surface-variant">
        geteilt — links wählt (<code>aria-pressed</code>), rechts öffnet das Menü
        (44 px)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {varianten.map((name, i) => (
          <ChipMenu
            key={name}
            label={name}
            selected={name === aktiv}
            onSelect={() => setAktiv(name)}
            selectAriaLabel={`Variante ${name} anzeigen`}
            menuAriaLabel={`Menü zu Variante ${name}`}
            items={eintraege(name, i === 0, i === varianten.length - 1)}
          />
        ))}
      </div>
      <p className="type-body-small mt-2 text-on-surface-variant">
        angezeigt: {aktiv}
      </p>
    </div>
  );
}
