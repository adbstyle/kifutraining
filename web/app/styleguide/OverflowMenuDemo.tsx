"use client";

import { useState } from "react";
import { Pencil, Play, Trash2 } from "lucide-react";
import { IconButton, OverflowMenu, Tooltip } from "@/components/ui";

/* Aktionsreihe einer Karte: Icons + ⋮. Eigene Datei, weil die Styleguide-Seite
   eine Server-Komponente ist — Lucide-Icons sind Funktionen und lassen sich
   nicht als Props über die Server/Client-Grenze reichen.

   Zwei Reihen, damit sichtbar wird, was der Fliesstext behauptet: das Öffnen
   des einen ⋮ schliesst das andere. */
function Reihe({
  name,
  onAktion,
}: {
  name: string;
  onAktion: (was: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip label="Durchführen">
        <IconButton
          icon={Play}
          label={`${name} durchführen`}
          size="sm"
          onClick={() => onAktion(`Durchführen (${name})`)}
        />
      </Tooltip>
      <Tooltip label="Termin ändern">
        <IconButton
          icon={Pencil}
          label={`Termin von ${name} ändern`}
          size="sm"
          onClick={() => onAktion(`Ändern (${name})`)}
        />
      </Tooltip>
      <OverflowMenu
        label={`Weitere Aktionen zu ${name}`}
        items={[
          {
            label: "Entfernen",
            icon: Trash2,
            danger: true,
            onSelect: () => onAktion(`Entfernen (${name})`),
          },
        ]}
      />
    </div>
  );
}

export function OverflowMenuDemo() {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Reihe name="Karte A" onAktion={setGewaehlt} />
      <Reihe name="Karte B" onAktion={setGewaehlt} />
      <span className="type-label-small text-on-surface-variant">
        {gewaehlt ? `gewählt: ${gewaehlt}` : "hovern, klicken, ⋮ öffnen"}
      </span>
    </div>
  );
}
