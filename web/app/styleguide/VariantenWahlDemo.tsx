"use client";

import { useState } from "react";
import { VariantenWahl } from "@/components/training/VariantenWahl";

/* Eigene Datei, weil die Styleguide-Seite eine Server-Komponente ist — die
   Wahl hält ihren Zustand selbst.

   Gezeigt wird der Anlassfall: Bezeichnungen, die der Trainer selbst vergibt,
   und darunter derselbe Baustein mit nur einer Variante — er rendert dann
   nichts. */
const varianten = [
  { id: "a", name: "Standard" },
  { id: "b", name: "21 Kinder, zwei Trainer" },
  { id: "c", name: "Halle" },
];

export function VariantenWahlDemo() {
  const [aktiv, setAktiv] = useState("a");
  return (
    <div className="space-y-6">
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          drei Varianten — ein Element von n, Pfeiltasten bewegen die Auswahl
        </p>
        <VariantenWahl varianten={varianten} aktiv={aktiv} onWechsel={setAktiv} />
      </div>
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          eine Variante — der Baustein rendert nichts (unten steht nur dieser Satz)
        </p>
        <VariantenWahl
          varianten={[varianten[0]]}
          aktiv={varianten[0].id}
          onWechsel={() => {}}
        />
      </div>
    </div>
  );
}
