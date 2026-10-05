"use client";

import { MultiSelect } from "@/components/ui";
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
   Story 5 AK 4) — G bis A stehen nie gemeinsam zur Wahl. Beim Anlegen ist
   das Feld deshalb gesperrt, bis die Altersstufe gewählt ist: welche
   Kategorien es überhaupt gibt, folgt aus ihr.

   Weder Suche noch Aktions-Fuss: drei bis vier kurze Werte liest man
   schneller, als man sie filtert. */
export function StufenField({
  value,
  onChange,
  kategorien = kategorienSlugs,
  error,
  info,
  hinweis,
  disabled,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Die wählbaren Alterskategorien; Vorgabe ist das ganze Vokabular. */
  kategorien?: readonly string[];
  error?: string;
  /** Fester Hinweis hinter einem ⓘ. */
  info?: string;
  /** Hinweis unter dem Feld, solange kein Fehler dasteht. */
  hinweis?: string;
  disabled?: boolean;
  /** Ersetzt die Vorgabe `max-w-lg`. */
  className?: string;
}) {
  return (
    <MultiSelect
      label="Alterskategorie"
      className={className ?? "max-w-lg"}
      options={(kategorien as KategorieSlug[]).map((k) => ({
        value: k,
        label: kategorieStufe[k],
      }))}
      value={value}
      onChange={onChange}
      searchable={false}
      actions={false}
      error={!!error}
      supportingText={error ?? hinweis}
      info={info}
      disabled={disabled}
    />
  );
}
