"use client";

import { useState } from "react";
import { MultiSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const themen: SelectOption[] = [
  { value: "passen", label: "Passen & Annehmen" },
  { value: "dribbling", label: "Dribbling" },
  { value: "torschuss", label: "Torschuss" },
  { value: "1gegen1", label: "1 gegen 1" },
  { value: "spielformen", label: "Spielformen" },
  { value: "koordination", label: "Koordination" },
  { value: "verteidigen", label: "Verteidigen" },
];

export function MultiSelectDemo() {
  const [werte, setWerte] = useState<string[]>(["passen", "dribbling"]);

  return (
    <div className="grid max-w-md gap-6">
      {/* Suchbar + Footer (Default) — kontrolliert, mit Live-Readout. */}
      <div>
        <MultiSelect
          label="Themen (suchbar, mit Aktionen)"
          options={themen}
          value={werte}
          onChange={setWerte}
          placeholder="Themen auswählen …"
          supportingText="Suche im Panel-Kopf · Footer: Zurücksetzen / Alle auswählen."
        />
        <p className="type-label-small mt-2 text-on-surface-variant">
          gewählt: {werte.length ? werte.join(", ") : "—"}
        </p>
      </div>

      {/* Minimal — kurze feste Liste, ohne Suche und ohne Footer. */}
      <MultiSelect
        label="Feldtyp (ohne Suche / Aktionen)"
        searchable={false}
        actions={false}
        defaultValue={["kleinfeld"]}
        options={[
          { value: "kleinfeld", label: "Kleinfeld" },
          { value: "grossfeld", label: "Grossfeld" },
          { value: "freies_feld", label: "Freies Feld" },
        ]}
        supportingText="searchable={false} actions={false}: Trigger treibt die Liste, ↑/↓ + Enter."
      />

      {/* Ohne sichtbares Label — der Placeholder (Empty-State) beschriftet das
          Feld; Label bleibt für Screenreader erhalten (sr-only). Für dichte
          Filterzeilen, in denen Felder Seite an Seite stehen. */}
      <MultiSelect
        label="Alterskategorie"
        hideLabel
        searchable={false}
        options={themen}
        placeholder="Alle Stufen"
        supportingText="hideLabel: Label sr-only, Placeholder dient als Beschriftung."
      />
    </div>
  );
}
