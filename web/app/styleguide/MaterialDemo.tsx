"use client";

import { useState } from "react";
import {
  MaterialField,
  VorschlagBanner,
  zeilenAus,
} from "@/components/exercise/MaterialField";
import type { MaterialPosten } from "@/lib/material";

/* Eigene Datei, weil die Styleguide-Seite eine Server-Komponente ist — das
   Feld hält seine Zeilen im Zustand des Aufrufers.

   Gezeigt wird der Anlassfall: ein Diagramm mit Pylonen, Minitoren und Bällen,
   dessen Vorschlag noch nicht übernommen ist. */
const vorschlag: MaterialPosten[] = [
  { art: "minitor", farbe: null, menge: 2 },
  { art: "pylone", farbe: "orange", menge: 4 },
  { art: "fussball", farbe: null, menge: 6 },
];

export function MaterialDemo() {
  const [zeilen, setZeilen] = useState(() => zeilenAus([{ art: "pylone", farbe: "blau", menge: 2 }]));
  const [uebernommen, setUebernommen] = useState(false);
  return (
    <div className="max-w-2xl">
      <MaterialField
        zeilen={zeilen}
        onZeilenChange={setZeilen}
        ergaenzung={["Pfeife"]}
        hinweis={
          uebernommen ? undefined : (
            <VorschlagBanner
              vorschlag={vorschlag}
              onUebernehmen={() => {
                setZeilen(zeilenAus(vorschlag));
                setUebernommen(true);
              }}
            />
          )
        }
      />
    </div>
  );
}
