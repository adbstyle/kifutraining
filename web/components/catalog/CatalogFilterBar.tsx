"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuswahlFilter, Button, FilterChip, FilterKnopf, SearchField, TextField } from "@/components/ui";
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
      <DebouncedSuche
        initial={filters.q ?? ""}
        label="Übungen durchsuchen"
        className="w-full sm:w-72"
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

      <KinderFilter
        initial={filters.kinder?.toString() ?? ""}
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

/* «Verfügbare Kinder» als Filterknopf: Der Knopf nennt die übernommene Zahl,
   eingegeben wird sie im Panel — mit Tipppause (300 ms), wie die Suche. Der
   Knopf zeigt den Wert aus der Adresse, nicht den gerade getippten: Er sagt,
   was die Übersicht tatsächlich einschränkt. */
function KinderFilter({
  initial,
  gesetzt,
  onCommit,
}: {
  initial: string;
  gesetzt?: number;
  onCommit: (value: string) => void;
}) {
  const [wert, aendern] = useDebouncedWert(initial, onCommit);
  const aktiv = gesetzt !== undefined;

  return (
    <FilterKnopf
      label="Verfügbare Kinder"
      aktiv={aktiv}
      badge={gesetzt}
      badgeLabel={aktiv ? `${gesetzt} Kinder` : undefined}
      panelClassName="w-64 px-3 py-2"
    >
      <TextField
        label="Anzahl Kinder"
        type="number"
        inputMode="numeric"
        min={1}
        umrandet
        value={wert}
        onChange={(e) => aendern(e.target.value)}
        supportingText="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
      />
    </FilterKnopf>
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
      label={label}
      labelVersteckt
      umrandet
      placeholder={label}
      value={wert}
      onChange={(e) => aendern(e.target.value)}
      className={className}
    />
  );
}
