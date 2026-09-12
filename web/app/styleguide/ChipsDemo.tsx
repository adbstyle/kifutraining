"use client";

import { useState } from "react";
import {
  FilterChip,
  AssistChip,
  SuggestionChip,
  InputChip,
  TextField,
} from "@/components/ui";
import { Plus, BookOpen, User, Search } from "lucide-react";

const FILTERS: [string, string][] = [
  ["hauptteil", "Hauptteil"],
  ["einleitung", "Einleitung"],
  ["auffangen", "Auffangen"],
];

/* Demonstriert die M3-Chip-Typen interaktiv (Filter toggeln, Input entfernen). */
export function ChipsDemo() {
  const [filters, setFilters] = useState<Set<string>>(new Set(["hauptteil"]));
  const [tags, setTags] = useState<string[]>(["Trainer", "Kleinfeld", "G-Junioren"]);

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
          Filter-Chip in der Leiste (<code>groesse=&quot;leiste&quot;</code>)
        </p>
        {/* Neben dem dichten Feld gezeigt, weil sich die Höhe nur im Vergleich
            beurteilen lässt: Der Chip soll mit dem Feld auf einer Linie
            sitzen, nicht daneben schweben. */}
        <div className="flex flex-wrap items-center gap-3">
          <TextField
            dense
            label="Übungen durchsuchen"
            type="search"
            leadingIcon={Search}
            placeholder="Übungen durchsuchen…"
            className="w-full sm:w-64"
          />
          <FilterChip
            selected={filters.has("meine")}
            onClick={() => toggle("meine")}
            groesse="leiste"
          >
            Meine Übungen
          </FilterChip>
        </div>
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Assist · Suggestion · Elevated
        </p>
        <div className="flex flex-wrap gap-2">
          <AssistChip icon={Plus}>Zu Training hinzufügen</AssistChip>
          <AssistChip icon={BookOpen} elevated>
            Im Manual öffnen
          </AssistChip>
          <SuggestionChip>Ähnliche Übungen</SuggestionChip>
        </div>
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Input-Chips (entfernbar)
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && (
            <span className="type-body-small text-on-surface-mittel">
              — alle entfernt —
            </span>
          )}
          {tags.map((t, i) => (
            <InputChip
              key={t}
              icon={i === 0 ? User : undefined}
              onRemove={() => setTags((ts) => ts.filter((x) => x !== t))}
            >
              {t}
            </InputChip>
          ))}
        </div>
      </div>
    </div>
  );
}
