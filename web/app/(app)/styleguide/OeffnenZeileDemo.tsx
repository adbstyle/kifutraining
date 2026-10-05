"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui";
import { UebungsName } from "@/components/training/UebungsName";
import { cn } from "@/lib/cn";

/** Zeilen, die ihr Detail daneben öffnen (Abschnitt 30) — breit hellt die
 *  ganze Zeile auf und öffnet, die geöffnete ist markiert; der Knopf rechts
 *  bleibt eigenständig bedienbar. Schmal steht der Name als Text. */
export function OeffnenZeileDemo() {
  const [offen, setOffen] = useState<string | null>("b");
  const zeilen = [
    { id: "a", name: "Autorennen" },
    { id: "b", name: "Berge und Seen" },
  ];
  return (
    <ol className="flex max-w-xl flex-col gap-2">
      {zeilen.map((z, i) => (
        <li
          key={z.id}
          className={cn(
            "relative flex items-center gap-3 rounded-flaeche border border-linie bg-elev-01 px-3 py-2.5 xl:state",
            offen === z.id && "xl:border-primary",
          )}
        >
          <span className="w-4 shrink-0 text-center type-label-medium text-on-surface-mittel">
            {i + 1}
          </span>
          <span className="flex min-w-0 flex-1">
            <UebungsName
              name={z.name}
              offen={offen === z.id}
              onOeffnen={() => setOffen(offen === z.id ? null : z.id)}
            />
          </span>
          <Tooltip label="Kopieren">
            <IconButton icon={Copy} label={`${z.name} kopieren`} onClick={() => {}} />
          </Tooltip>
        </li>
      ))}
    </ol>
  );
}
