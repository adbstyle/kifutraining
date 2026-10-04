"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuswahlFilter, Button, FilterChip, FilterSuche, ZahlFilter } from "@/components/ui";
import {
  einordnungFilterOptionen,
  feldOptionen,
  formOptionen,
  stufenOptionen,
  typOptionen,
} from "@/lib/filter-optionen";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Beim Mutieren die LIVE-URL lesen (nicht den evtl. veralteten Hook-Snapshot)
  // — sonst gehen bei schnellen Klicks hintereinander Filter verloren.
  function pushParams(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(window.location.search);
    mutate(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const setList = (key: string, next: string[]) =>
    pushParams((p) => {
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });

  const setScalar = (key: string, value: string) =>
    pushParams((p) => {
      const v = value.trim();
      if (v) p.set(key, v);
      else p.delete(key);
    });

  const toggleFav = () =>
    pushParams((p) => {
      if (filters.fav) p.delete("fav");
      else p.set("fav", "1");
    });

  const toggleMine = () =>
    pushParams((p) => {
      if (filters.mine) p.delete("mine");
      else p.set("mine", "1");
    });

  void searchParams; // an Re-Render bei URL-Wechsel (z. B. Zurück) koppeln

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
        onCommit={(v) => setScalar("q", v)}
      />

      <AuswahlFilter
        label="Trainingsteil"
        options={einordnungFilterOptionen}
        value={filters.teil}
        onChange={(v) => setList("teil", v)}
      />
      <AuswahlFilter
        label="Alterskategorie"
        options={stufenOptionen}
        value={filters.kat}
        onChange={(v) => setList("kat", v)}
      />
      <AuswahlFilter
        label="Feldtyp"
        options={feldOptionen}
        value={filters.feld}
        onChange={(v) => setList("feld", v)}
      />
      <AuswahlFilter
        label="Erscheinungsform"
        options={formOptionen}
        value={filters.form}
        onChange={(v) => setList("form", v)}
      />
      <AuswahlFilter
        label="Übungstyp"
        options={typOptionen}
        value={filters.typ}
        onChange={(v) => setList("typ", v)}
      />

      <ZahlFilter
        label="Verfügbare Kinder"
        feldLabel="Anzahl Kinder"
        einheit="Kinder"
        hinweis="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        gesetzt={filters.kinder}
        onCommit={(v) => setScalar("kinder", v)}
      />

      {showMine && (
        <FilterChip selected={!!filters.mine} onClick={toggleMine}>
          Meine Übungen
        </FilterChip>
      )}

      {canFavorite && (
        <FilterChip selected={!!filters.fav} onClick={toggleFav}>
          Favoriten
        </FilterChip>
      )}

      {anyActive && (
        <Button variant="text" onClick={() => router.push(pathname, { scroll: false })}>
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
