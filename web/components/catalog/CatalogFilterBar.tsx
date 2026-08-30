"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FilterChip, MultiSelect, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  erscheinungsform_junioren as formJuniorenLabels,
  hauptteilkategorie as hkatLabels,
  uebungstyp as uebungstypLabels,
  junioren_block as juniorenBlockLabels,
  kategorienSlugs,
} from "@/lib/vocab";
import { kategorieStufe } from "@/lib/labels";

export type CatalogFilters = {
  teil: string[];
  kat: string[];
  feld: string[];
  form: string[];
  hkat: string[];
  typ: string[];
  kinder?: number;
  q?: string;
  fav?: boolean;
  mine?: boolean;
};

// Optionen aus dem Vokabular (Slug → Label). Reihenfolge = Definitionsreihenfolge.
const toOptions = (rec: Record<string, string>) =>
  Object.entries(rec).map(([value, label]) => ({ value, label }));
// Trainingsteil-Filter über beide Welten: die vier Trainingsteile des Manuals
// Fussball Kinder und die sechs Blöcke des Manuals Fussball Jugendliche, in
// zwei beschrifteten Gruppen. Der Katalog filtert bewusst über BEIDE
// Altersstufen (Story 2 Out of Scope 2) — er ist der eine Ort, an dem der
// ganze sichtbare Bestand nebeneinandersteht.
const teilOptions: { value: string; label: string; group: string }[] = [
  ...Object.entries(teilLabels).map(([value, label]) => ({
    value,
    label: label as string,
    group: "Kinderfussball",
  })),
  ...Object.entries(juniorenBlockLabels).map(([value, label]) => ({
    value,
    label: label as string,
    group: "Juniorenfussball",
  })),
];
const feldOptions = toOptions(feldLabels);
// Beide Erscheinungsform-Vokabulare als EINE Dimension: gewählte Werte wirken
// untereinander als ODER, gleich aus welcher Quelle (Story 12 PC 1). Flach und
// ohne Spielphasen-Gruppierung (Out of Scope 2).
const formOptions = [...toOptions(formLabels), ...toOptions(formJuniorenLabels)];
const hkatOptions = toOptions(hkatLabels);
const typOptions = toOptions(uebungstypLabels);
const stufenOptions = kategorienSlugs.map((k) => ({ value: k, label: kategorieStufe[k] }));

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
    filters.hkat.length > 0 ||
    filters.typ.length > 0 ||
    filters.kinder !== undefined ||
    (filters.q?.length ?? 0) > 0 ||
    !!filters.fav ||
    !!filters.mine;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <DebouncedField
        type="search"
        icon={Search}
        initial={filters.q ?? ""}
        placeholder="Übungen durchsuchen…"
        ariaLabel="Übungen durchsuchen"
        className="w-full sm:w-72"
        onCommit={(v) => setScalar("q", v)}
      />

      <MultiSelect
        label="Trainingsteil"
        hideLabel
        options={teilOptions}
        value={filters.teil}
        onChange={(v) => setList("teil", v)}
        searchable={false}
        placeholder="Alle Trainingsteile"
        className="w-full sm:w-56"
      />
      <MultiSelect
        label="Alterskategorie"
        hideLabel
        options={stufenOptions}
        value={filters.kat}
        onChange={(v) => setList("kat", v)}
        searchable={false}
        placeholder="Alle Stufen"
        className="w-full sm:w-52"
      />
      <MultiSelect
        label="Feldtyp"
        hideLabel
        options={feldOptions}
        value={filters.feld}
        onChange={(v) => setList("feld", v)}
        searchable={false}
        placeholder="Alle Feldtypen"
        className="w-full sm:w-48"
      />
      <MultiSelect
        label="Erscheinungsform"
        hideLabel
        options={formOptions}
        value={filters.form}
        onChange={(v) => setList("form", v)}
        searchable={false}
        placeholder="Alle Erscheinungsformen"
        className="w-full sm:w-64"
      />
      <MultiSelect
        label="Hauptteilkategorie"
        hideLabel
        options={hkatOptions}
        value={filters.hkat}
        onChange={(v) => setList("hkat", v)}
        searchable={false}
        placeholder="Alle Hauptteilkategorien"
        className="w-full sm:w-64"
      />
      <MultiSelect
        label="Übungstyp"
        hideLabel
        options={typOptions}
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
        placeholder="Kinder"
        ariaLabel="Verfügbare Kinder"
        title="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        className="w-full sm:w-40"
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

/* Natives Eingabefeld mit Lead-Icon und Debounce (300 ms) — schreibt erst nach
   Tipppause in die URL. Stil identisch zur Trainings-Filter-Bar (h-12, Feld-Kontrakt). */
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
  placeholder?: string;
  title?: string;
}) {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Externe URL-Änderungen (z. B. Reset, Zurück-Navigation) spiegeln.
  useEffect(() => setValue(initial), [initial]);

  function handle(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(v), 300);
  }

  return (
    <label className={cn("relative block", className)}>
      <Icon
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        aria-hidden
      />
      <input
        {...props}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => handle(e.target.value)}
        className="focus-ring h-12 w-full rounded-[4px] border-[1.5px] border-outline bg-surface-container-low pl-10 pr-3 type-body-medium text-on-surface placeholder:text-on-surface-variant"
      />
    </label>
  );
}
