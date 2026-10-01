"use client";

import { useState } from "react";
import { ChoiceChip, ChoiceChipGroup } from "@/components/ui";

/* Zeigt die ChoiceChipGroup an ihrem Anwendungsfall: den Varianten eines
   Hauptteils (24). Die Bezeichnungen sind Nutzertext und dürfen bis vierzig
   Zeichen lang sein — genau die Werte, die in einer Reihe umbrechen müssen,
   statt seitlich aus dem Bild zu scrollen. Die Werte hier sind erfunden;
   echte stehen im Training. */
const varianten = [
  "Grundfassung",
  "21 Kinder, zwei Trainer",
  "Halle bei Regen",
  "Kleine Gruppe",
];

export function ChoiceChipDemo() {
  const [wert, setWert] = useState<string>(varianten[0]);
  return (
    <ChoiceChipGroup ariaLabel="Variante des Hauptteils">
      {varianten.map((v, i) => (
        <ChoiceChip
          key={v}
          selected={wert === v}
          tabStop={i === 0 && !varianten.includes(wert)}
          onSelect={() => setWert(v)}
        >
          {v}
        </ChoiceChip>
      ))}
    </ChoiceChipGroup>
  );
}
