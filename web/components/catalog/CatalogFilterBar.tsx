"use client";

import { AuswahlFilter, Button, FilterChip, FilterSuche, ZahlFilter } from "@/components/ui";
import {
  einordnungFilterOptionen,
  feldOptionen,
  formOptionen,
  stufenOptionen,
  typOptionen,
} from "@/lib/filter-optionen";
import { useAdressFilter } from "@/lib/use-adress-filter";

export type CatalogFilters = {
  /** Die gewählten Einordnungen: Kinderfussball-Trainingsteile und die drei
   *  Hauptteilkategorien, dazu die Junioren-Blöcke — seit Story #129 EIN
   *  Filter mit EINEM URL-Parameter (`?teil=`). */
  teil: string[];
  kat: string[];
  feld: string[];
  form: string[];
  typ: string[];
  kinder?: number;
  q?: string;
  fav?: boolean;
  mine?: boolean;
};

/* Such-/Filterleiste für den Übungspool — eine durchgehende, umbrechende Zeile
   statt Sidebar, analog zur Trainings-Filter-Bar. Jede Dimension ist ein
   Filterknopf mit Namen und Zahl (Epic #363), «Verfügbare Kinder» einer mit
   einem Zahlenfeld im Panel; Suche und Kinderzahl wirken nach einer
   Tipppause, «Meine Übungen» und Favoriten sind Schalter-Chips.
   URL ist die Quelle der Wahrheit: jede Änderung schreibt in die URL und löst
   eine neue Server-Abfrage aus. */
export function CatalogFilterBar({
  filters,
  canFavorite = false,
  showMine = false,
}: {
  filters: CatalogFilters;
  canFavorite?: boolean;
  showMine?: boolean;
}) {
  const filter = useAdressFilter();

  const anyActive =
    filters.teil.length > 0 ||
    filters.kat.length > 0 ||
    filters.feld.length > 0 ||
    filters.form.length > 0 ||
    filters.typ.length > 0 ||
    filters.kinder !== undefined ||
    (filters.q?.length ?? 0) > 0 ||
    !!filters.fav ||
    !!filters.mine;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <FilterSuche
        label="Übungen durchsuchen"
        initial={filters.q ?? ""}
        onCommit={(v) => filter.setzeWert("q", v)}
      />

      <AuswahlFilter
        label="Trainingsteil"
        options={einordnungFilterOptionen}
        value={filters.teil}
        onChange={(v) => filter.setzeListe("teil", v)}
      />
      <AuswahlFilter
        label="Alterskategorie"
        options={stufenOptionen}
        value={filters.kat}
        onChange={(v) => filter.setzeListe("kat", v)}
      />
      <AuswahlFilter
        label="Feldtyp"
        options={feldOptionen}
        value={filters.feld}
        onChange={(v) => filter.setzeListe("feld", v)}
      />
      <AuswahlFilter
        label="Erscheinungsform"
        options={formOptionen}
        value={filters.form}
        onChange={(v) => filter.setzeListe("form", v)}
      />
      <AuswahlFilter
        label="Übungstyp"
        options={typOptionen}
        value={filters.typ}
        onChange={(v) => filter.setzeListe("typ", v)}
      />

      <ZahlFilter
        label="Verfügbare Kinder"
        feldLabel="Anzahl Kinder"
        einheit="Kinder"
        hinweis="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        gesetzt={filters.kinder}
        onCommit={(v) => filter.setzeWert("kinder", v)}
      />

      {showMine && (
        <FilterChip selected={!!filters.mine} onClick={() => filter.schalte("mine", !filters.mine)}>
          Meine Übungen
        </FilterChip>
      )}

      {canFavorite && (
        <FilterChip selected={!!filters.fav} onClick={() => filter.schalte("fav", !filters.fav)}>
          Favoriten
        </FilterChip>
      )}

      {anyActive && (
        <Button variant="text" onClick={filter.zuruecksetzen}>
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
