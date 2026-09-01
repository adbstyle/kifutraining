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

// Zwei Gruppen, gruppensortiert — so liegen die Filterwerte der Applikation
// vor (lib/filter-optionen.ts): jede Dimension zeigt, zu welcher Altersstufe
// ihre Werte gehören.
const stufen: SelectOption[] = [
  { value: "G", label: "G-Junior:innen", group: "Kinderfussball" },
  { value: "F", label: "F-Junior:innen", group: "Kinderfussball" },
  { value: "E", label: "E-Junior:innen", group: "Kinderfussball" },
  { value: "D", label: "D-Junior:innen", group: "Juniorenfussball" },
  { value: "C", label: "C-Junior:innen", group: "Juniorenfussball" },
  { value: "B", label: "B-Junior:innen", group: "Juniorenfussball" },
  { value: "A", label: "A-Junior:innen", group: "Juniorenfussball" },
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

      {/* Gruppiert — Optionen aus zwei Welten unter je einer nicht wählbaren
          Kopfzeile. Die Optionen MÜSSEN gruppensortiert übergeben werden: die
          Kopfzeile entsteht positional, sobald `group` wechselt. */}
      <MultiSelect
        label="Alterskategorie (gruppiert)"
        searchable={false}
        actions={false}
        defaultValue={["F"]}
        options={stufen}
        supportingText="group: nicht wählbare Kopfzeile je Gruppe. Werte beider Gruppen bleiben gemeinsam wählbar."
      />
    </div>
  );
}
