"use client";

import { useState } from "react";
import { AuswahlListe } from "@/components/ui";

/* Die Auswahlliste an ihrem Anwendungsfall: ein Training für einen Termin
   wählen. Die Einträge sind erfunden. */
const eintraege = [
  { id: "a", titel: "Passspiel im Dreieck", untertitel: "Noch nicht eingeplant" },
  { id: "b", titel: "Dribbling und 1 gegen 1", untertitel: "Noch nicht eingeplant" },
  { id: "c", titel: "Spiel auf zwei Tore", untertitel: "Eingeplant · Sa., 10.10.2026", gedaempft: true },
];

export function AuswahlListeDemo() {
  const [wert, setWert] = useState<string | null>(null);
  return <AuswahlListe ariaLabel="Trainings des Teams" items={eintraege} wert={wert} onWahl={setWert} className="max-w-md" />;
}
