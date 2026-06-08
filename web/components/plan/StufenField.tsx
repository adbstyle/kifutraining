"use client";

import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import { kategorienSlugs, type KategorieSlug } from "@/lib/vocab";

const katColor: Record<KategorieSlug, string> = {
  G: "bg-kat-g text-rasen-950 border-transparent",
  F: "bg-kat-f text-rasen-950 border-transparent",
  E: "bg-kat-e text-rasen-950 border-transparent",
};

/* Stufen-Auswahl (G/F/E) als toggelbare Chips — die Alterskategorien eines
   Plans (Story #10 AC3, Story #12 AC2). Im ausgewählten Zustand in der festen
   Stufen-Farbe, sonst als Outline-Chip. Kontrolliert. */
export function StufenField({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  function toggle(k: KategorieSlug) {
    onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  }
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Stufen">
      {kategorienSlugs.map((k) => {
        const selected = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            aria-pressed={selected}
            aria-label={kategorieStufe[k]}
            className={cn(
              "focus-ring inline-flex items-center gap-1.5 rounded-[4px] border-[1.5px] px-3 py-1.5 type-label-large transition-colors",
              selected
                ? katColor[k]
                : "border-outline text-on-surface hover:bg-on-surface/8",
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
