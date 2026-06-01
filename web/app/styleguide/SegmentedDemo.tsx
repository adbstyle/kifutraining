"use client";

import { useState } from "react";
import { SegmentedControl, FilterChip } from "@/components/ui";
import { trainingsteil, erscheinungsform } from "@/lib/vocab";
import type { TrainingsteilSlug, ErscheinungsformSlug } from "@/lib/vocab";

const teilOptions = (
  Object.entries(trainingsteil) as [TrainingsteilSlug, string][]
).map(([value, label]) => ({ value, label }));

/* Demonstriert die freie Filterung des Übungspools: jede Dimension ist
   unabhängig und immer sichtbar (AND über Dimensionen, OR innerhalb). Sinnlose
   Kombinationen liefern schlicht eine leere Ergebnismenge — kein Ein-/Ausblenden. */
export function SegmentedDemo() {
  const [teil, setTeil] = useState<TrainingsteilSlug>("hauptteil");
  const [forms, setForms] = useState<Set<ErscheinungsformSlug>>(new Set());

  function toggle(f: ErscheinungsformSlug) {
    setForms((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-chalk-faint">
          Trainingsteil <span className="text-signal">· eine Auswahl</span>
        </p>
        <SegmentedControl
          ariaLabel="Trainingsteil"
          options={teilOptions}
          value={teil}
          onChange={setTeil}
        />
      </div>

      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-chalk-faint">
          Erscheinungsform <span className="text-signal">· mehrere (ODER)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            Object.entries(erscheinungsform) as [ErscheinungsformSlug, string][]
          ).map(([slug, label]) => (
            <FilterChip
              key={slug}
              selected={forms.has(slug)}
              onClick={() => toggle(slug)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>
    </div>
  );
}
