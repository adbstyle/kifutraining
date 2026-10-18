"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AuswahlLeiste, Button, Checkbox, IconButton, Tabelle, TabellenZeile } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

const ZEILEN = [
  { id: "mia", name: "Mia Muster", jahrgang: "2016" },
  { id: "leo", name: "Leo Beispiel", jahrgang: "2016" },
  { id: "ana", name: "Ana Probe", jahrgang: "2015" },
];

/* Tabelle mit Mehrfachauswahl (Spielerliste, #452 AK 6): ein Kästchen vorne
   in jeder Zeile; sobald etwas gewählt ist, schwebt unten die Auswahlleiste
   mit den Handlungen für die Gewählten. Ihre Handlung meldet hier eine
   Snackbar — sie steht dann über der Leiste. */
export function TabelleAuswahlDemo() {
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const melde = useSnackbar();

  return (
    <>
      <Tabelle
        spalten="sm:grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_3rem]"
        kopf={["", "Name", "Jahrgang", ""]}
      >
        {ZEILEN.map((z) => (
          <TabellenZeile key={z.id}>
            <Checkbox
              label={<span className="sr-only">{`${z.name} auswählen`}</span>}
              checked={auswahl.includes(z.id)}
              onChange={(e) => {
                const an = e.target.checked;
                setAuswahl((a) => (an ? [...a, z.id] : a.filter((id) => id !== z.id)));
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="type-body-medium block truncate text-on-surface">{z.name}</span>
              <span className="type-body-small block text-on-surface-mittel sm:hidden">{z.jahrgang}</span>
            </span>
            <span className="type-body-medium hidden text-on-surface-mittel sm:block">{z.jahrgang}</span>
            <span className="flex justify-end">
              <IconButton icon={X} label={`${z.name} entfernen`} />
            </span>
          </TabellenZeile>
        ))}
      </Tabelle>
      <AuswahlLeiste offen={auswahl.length > 0} titel={`${auswahl.length} ausgewählt`} onAufheben={() => setAuswahl([])}>
        <Button
          variant="filled"
          onClick={() => {
            melde(`${auswahl.length === 1 ? "1 Spieler:in" : `${auswahl.length} Spieler:innen`} zugeteilt.`);
          }}
        >
          Kader zuteilen
        </Button>
      </AuswahlLeiste>
    </>
  );
}
