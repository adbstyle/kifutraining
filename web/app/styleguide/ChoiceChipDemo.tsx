"use client";

import { useState } from "react";
import { ChoiceChip, ChoiceChipGroup } from "@/components/ui";
import { JUNIOREN_TEILE } from "@/lib/junioren";

/* Zeigt die ChoiceChipGroup an ihrem Anlassfall: den Blöcken des
   Junioren-Hauptteils, deren längster Name in keine Segmentleiste passt. */
const bloecke = JUNIOREN_TEILE.flatMap((t) => t.bloecke);

export function ChoiceChipDemo() {
  const [wert, setWert] = useState<string>("jun-spielformen");
  return (
    <ChoiceChipGroup ariaLabel="Block des Junioren-Trainingsschemas">
      {bloecke.map((b, i) => (
        <ChoiceChip
          key={b.slug}
          selected={wert === b.slug}
          tabStop={i === 0 && !bloecke.some((x) => x.slug === wert)}
          onSelect={() => setWert(b.slug)}
        >
          {b.label}
        </ChoiceChip>
      ))}
    </ChoiceChipGroup>
  );
}
