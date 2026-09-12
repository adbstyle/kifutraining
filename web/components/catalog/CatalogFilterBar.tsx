"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FilterChip, MultiSelect, Button, SearchField, TextField } from "@/components/ui";
import { useDebouncedWert } from "@/lib/use-debounce";
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
   statt Sidebar, analog zur Trainings-Filter-Bar. Mehrfach-Dimensionen sind
   MultiSelect-Dropdowns (Placeholder = Empty-State-Beschriftung), Suche und
   „Verfügbare Kinder" sind debounced Felder, Favoriten ein Toggle-Chip.
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
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <DebouncedSuche
        initial={filters.q ?? ""}
        label="Übungen durchsuchen"
        className="w-full sm:w-72"
        onCommit={(v) => setScalar("q", v)}
      />

      <MultiSelect
        label="Trainingsteil"
        options={einordnungFilterOptionen}
        value={filters.teil}
        onChange={(v) => setList("teil", v)}
        searchable={false}
        placeholder="Alle Trainingsteile"
        className="w-full sm:w-56"
      />
      <MultiSelect
        label="Alterskategorie"
        options={stufenOptionen}
        value={filters.kat}
        onChange={(v) => setList("kat", v)}
        searchable={false}
        placeholder="Alle Stufen"
        className="w-full sm:w-52"
      />
      <MultiSelect
        label="Feldtyp"
        options={feldOptionen}
        value={filters.feld}
        onChange={(v) => setList("feld", v)}
        searchable={false}
        placeholder="Alle Feldtypen"
        className="w-full sm:w-48"
      />
      <MultiSelect
        label="Erscheinungsform"
        options={formOptionen}
        value={filters.form}
        onChange={(v) => setList("form", v)}
        searchable={false}
        placeholder="Alle Erscheinungsformen"
        className="w-full sm:w-64"
      />
      <MultiSelect
        label="Übungstyp"
        options={typOptionen}
        value={filters.typ}
        onChange={(v) => setList("typ", v)}
        searchable={false}
        placeholder="Alle Übungstypen"
        className="w-full sm:w-64"
      />

      <DebouncedField
        type="number"
        inputMode="numeric"
        min={1}
        icon={Users}
        initial={filters.kinder?.toString() ?? ""}
        ariaLabel="Verfügbare Kinder"
        title="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        /* Breiter als früher (w-40): Seit das Feld sein Label statt eines
           Platzhalters trägt, muss «Verfügbare Kinder» in der Schrift des
           Werts neben dem Icon hineinpassen, ohne an die rechte Kante zu
           stossen. */
        className="w-full sm:w-52"
        onCommit={(v) => setScalar("kinder", v)}
      />

      {showMine && (
        <FilterChip selected={!!filters.mine} onClick={toggleMine} className="h-12">
          Meine Übungen
        </FilterChip>
      )}

      {canFavorite && (
        <FilterChip selected={!!filters.fav} onClick={toggleFav} className="h-12">
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

/* Feld mit Lead-Icon und verzögerter Übernahme (300 ms) — schreibt erst nach
   der Tipppause in die URL. Die Optik kommt aus dem Kit (`TextField dense`),
   hier bleibt nur die Verzögerung. */
function DebouncedField({
  initial,
  onCommit,
  icon: Icon,
  ariaLabel,
  className,
  ...props
}: {
  initial: string;
  onCommit: (value: string) => void;
  icon: LucideIcon;
  ariaLabel: string;
  className?: string;
  type?: string;
  inputMode?: "numeric";
  min?: number;
  title?: string;
}) {
  const [wert, aendern] = useDebouncedWert(initial, onCommit);

  return (
    <TextField
      dense
      label={ariaLabel}
      leadingIcon={Icon}
      value={wert}
      onChange={(e) => aendern(e.target.value)}
      className={className}
      {...props}
    />
  );
}

/* Dasselbe für die Suche, nur auf dem `SearchField` des Kits: Lupe rechts, nach
   der ersten Eingabe ein Kreuz zum Leeren. Das Kreuz meldet sich über dasselbe
   `onChange` — die Verzögerung greift also auch für es, und die URL verliert
   `?q=` eine Tipppause später. */
function DebouncedSuche({
  initial,
  onCommit,
  label,
  className,
}: {
  initial: string;
  onCommit: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [wert, aendern] = useDebouncedWert(initial, onCommit);

  return (
    <SearchField
      dense
      label={label}
      value={wert}
      onChange={(e) => aendern(e.target.value)}
      className={className}
    />
  );
}
