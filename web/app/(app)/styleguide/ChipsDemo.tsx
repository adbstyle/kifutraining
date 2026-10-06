"use client";

import { useState } from "react";
import { FilterChip, AssistChip } from "@/components/ui";
import { Plus } from "lucide-react";

const FILTERS: [string, string][] = [
  ["hauptteil", "Hauptteil"],
  ["einleitung", "Einleitung"],
  ["auffangen", "Auffangen"],
];

/* Demonstriert Filter-Chip (interaktiv toggelbar) und Assist-Chip. */
export function ChipsDemo() {
  const [filters, setFilters] = useState<Set<string>>(new Set(["hauptteil"]));

  function toggle(k: string) {
    setFilters((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Filter-Chips (toggelbar)
        </p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([k, label]) => (
            <FilterChip key={k} selected={filters.has(k)} onClick={() => toggle(k)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Assist-Chip
        </p>
        <div className="flex flex-wrap gap-2">
          <AssistChip icon={Plus}>Zu Training hinzufügen</AssistChip>
        </div>
      </div>
    </div>
  );
}
