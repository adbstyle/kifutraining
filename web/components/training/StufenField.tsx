"use client";

import { katPlakette } from "@/components/ui";
import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import { kategorienSlugs, type KategorieSlug } from "@/lib/vocab";

/* Stufen-Auswahl als toggelbare Chips — die Alterskategorien eines Trainings
   (Story #10 AC3, Story #12 AC2). Kontrolliert.

   Wie eine Alterskategorie aussieht, entscheidet EINE Stelle: `katPlakette`
   aus `Chip.tsx`. Hier stand dieselbe Farbtabelle ein zweites Mal — und damit
   die Gefahr, dass Auswahl und Anzeige derselben Kategorie auseinanderlaufen.
   Diese Datei bestimmt nur noch, WAS gewählt ist, nicht wie es aussieht: die
   Gewählten tragen ihre Kategorie-Kontur, die Übrigen die neutrale Kante.

   Angeboten werden nur die Kategorien der Altersstufe des Trainings
   (`kategorien`; Story 5 AK 4) — G bis A stehen nie gemeinsam zur Wahl. Beim
   Anlegen erscheint das Feld deshalb erst nach der Wahl der Altersstufe:
   welche Kategorien es überhaupt gibt, folgt aus ihr. */
export function StufenField({
  value,
  onChange,
  kategorien = kategorienSlugs,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Die wählbaren Alterskategorien; Vorgabe ist das ganze Vokabular. */
  kategorien?: readonly string[];
  className?: string;
}) {
  function toggle(k: KategorieSlug) {
    onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  }
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Stufen">
      {(kategorien as KategorieSlug[]).map((k) => {
        const selected = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            aria-pressed={selected}
            aria-label={kategorieStufe[k]}
            className={cn(
              "state focus-ring inline-flex items-center gap-1.5 rounded-plakette px-3 py-1.5 type-label-large transition-colors",
              selected
                ? katPlakette[k]
                : "kontur border-kante text-on-surface-mittel",
            )}
          >
            <span className="font-mono font-bold">{k}</span>
            <span className="type-label-medium">{kategorieStufe[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
