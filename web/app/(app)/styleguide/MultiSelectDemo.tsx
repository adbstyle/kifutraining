"use client";

import { useState } from "react";
import { MultiSelect } from "@/components/ui";
import type { MultiSelectOption, SelectOption } from "@/components/ui";

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

// Mit Zusatzzeile — so wählt man die Eingeladenen eines Termins (#425, #519): Der
// Anzeigename allein unterscheidet Gleichnamige und automatische Kennungen
// nicht, die E-Mail-Adresse darunter schon.
const mitglieder: MultiSelectOption[] = [
  { value: "a", label: "Gri Bader", zusatz: "gri.bader@example.ch" },
  { value: "b", label: "Trainer:in 1162", zusatz: "lena.muster@example.ch" },
  { value: "c", label: "Trainer:in cf4b", zusatz: "j.beispiel-mit-sehr-langer-adresse@verein-example.ch" },
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
          supportingText="Suche im Panel-Kopf · Footer: Zurücksetzen / Alle auswählen."
        />
        <p className="type-label-small mt-2 text-on-surface-mittel">
          gewählt: {werte.length ? werte.join(", ") : "-"}
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

      {/* Leerfall — nichts gewählt: Der Name steht gedämpft im Feld; erst
          beim Hineinklicken oder mit einem Wert rückt er darüber. */}
      <MultiSelect
        label="Alterskategorie"
        searchable={false}
        options={themen}
        supportingText="Leer: der Name steht im Feld · gewählt: Name darüber, die Werte umbrechend."
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

      {/* Zusatzzeile — gedämpft unter dem Namen, bricht an jeder Stelle um
          statt zu kürzen. Die Suche findet auch sie, im Feld steht nur der Name. */}
      <MultiSelect
        label="Eingeladen (mit Zusatzzeile)"
        actions={false}
        options={mitglieder}
        supportingText="zusatz: zweite Zeile je Option, etwa die E-Mail-Adresse eines Mitglieds."
      />
    </div>
  );
}
