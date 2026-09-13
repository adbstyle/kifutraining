"use client";

import { MultiSelect } from "@/components/ui";
import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import { kategorienSlugs, type KategorieSlug } from "@/lib/vocab";

/* Die Alterskategorien eines Trainings oder Teams (Story #10 AC3,
   Story #12 AC2). Kontrolliert.

   Eine Mehrfachauswahl (Styleguide 17), wie jede Mehrfachauswahl seit dem
   2026-09-13. Sie war bis dahin eine Reihe toggelbarer Plaketten, die ihre
   Kategoriefarbe trugen — dieselbe Tabelle, die Übungskarte,
   Katalog und Druck benutzen. Diese Farbe entfällt hier (PO-Entscheid
   2026-09-13): Sie sagt, WELCHE Kategorie man vor sich hat, und das ist beim
   Anzeigen die Aussage, beim Auswählen aber steht der Name ohnehin
   ausgeschrieben da. Wo eine Kategorie angezeigt wird, trägt sie ihre Farbe
   unverändert weiter.

   Angeboten werden nur die Kategorien der Altersstufe (`kategorien`;
   Story 5 AK 4) — G bis A stehen nie gemeinsam zur Wahl. Beim Anlegen
   erscheint das Feld deshalb erst nach der Wahl der Altersstufe: welche
   Kategorien es überhaupt gibt, folgt aus ihr.

   Weder Suche noch Aktions-Fuss: drei bis vier kurze Werte liest man
   schneller, als man sie filtert. */
export function StufenField({
  value,
  onChange,
  kategorien = kategorienSlugs,
  error,
  supportingText,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Die wählbaren Alterskategorien; Vorgabe ist das ganze Vokabular. */
  kategorien?: readonly string[];
  error?: string;
  supportingText?: string;
  className?: string;
}) {
  return (
    <MultiSelect
      label="Alterskategorie"
      className={cn("max-w-lg", className)}
      options={(kategorien as KategorieSlug[]).map((k) => ({
        value: k,
        label: kategorieStufe[k],
      }))}
      value={value}
      onChange={onChange}
      searchable={false}
      actions={false}
      placeholder="Kategorien wählen …"
      error={!!error}
      supportingText={error ?? supportingText}
    />
  );
}
