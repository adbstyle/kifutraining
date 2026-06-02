"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw } from "lucide-react";
import { FilterChip, TextField, Button } from "@/components/ui";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  kategorienSlugs,
} from "@/lib/vocab";
import { kategorieStufe } from "@/lib/labels";

type ThemaOption = { id: string; name: string };

export type CatalogFilters = {
  teil: string[];
  kat: string[];
  feld: string[];
  form: string[];
  thema: string[];
  kinder?: number;
  q?: string;
};

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="type-label-small mb-2 text-on-surface-variant">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function FilterPanel({
  filters,
  themen,
}: {
  filters: CatalogFilters;
  themen: ThemaOption[];
}) {
  const router = useRouter();

  // URL ist die Quelle der Wahrheit. Beim Mutieren die LIVE-URL lesen
  // (nicht den evtl. veralteten Hook-Snapshot) — sonst gehen bei schnellen
  // Klicks hintereinander Filter verloren.
  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(window.location.search);
      const current = (next.get(key)?.split(",") ?? []).filter(Boolean);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length) next.set(key, updated.join(","));
      else next.delete(key);
      pushParams(next);
    },
    [pushParams],
  );

  const setScalar = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(window.location.search);
      if (value.trim()) next.set(key, value.trim());
      else next.delete(key);
      pushParams(next);
    },
    [pushParams],
  );

  const isOn = (key: string, value: string) =>
    (filters[key as keyof CatalogFilters] as string[] | undefined)?.includes(value) ??
    false;

  const anyActive =
    filters.teil.length ||
    filters.kat.length ||
    filters.feld.length ||
    filters.form.length ||
    filters.thema.length ||
    filters.kinder !== undefined ||
    (filters.q?.length ?? 0) > 0;

  return (
    <aside className="flex flex-col gap-6">
      <DebouncedField
        label="Suche"
        type="search"
        initial={filters.q ?? ""}
        icon
        onCommit={(v) => setScalar("q", v)}
      />

      <FilterGroup title="Trainingsteil">
        {(Object.keys(teilLabels) as (keyof typeof teilLabels)[]).map((t) => (
          <FilterChip key={t} selected={isOn("teil", t)} onClick={() => toggle("teil", t)}>
            {teilLabels[t]}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup title="Alterskategorie">
        {kategorienSlugs.map((k) => (
          <FilterChip
            key={k}
            selected={isOn("kat", k)}
            onClick={() => toggle("kat", k)}
            className="min-w-0"
          >
            <span title={kategorieStufe[k]}>{k}</span>
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup title="Feldtyp">
        {(Object.keys(feldLabels) as (keyof typeof feldLabels)[]).map((t) => (
          <FilterChip key={t} selected={isOn("feld", t)} onClick={() => toggle("feld", t)}>
            {feldLabels[t]}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup title="Erscheinungsform">
        {(Object.keys(formLabels) as (keyof typeof formLabels)[]).map((t) => (
          <FilterChip key={t} selected={isOn("form", t)} onClick={() => toggle("form", t)}>
            {formLabels[t]}
          </FilterChip>
        ))}
      </FilterGroup>

      {themen.length > 0 && (
        <FilterGroup title="Thema">
          {themen.map((th) => (
            <FilterChip
              key={th.id}
              selected={isOn("thema", th.id)}
              onClick={() => toggle("thema", th.id)}
            >
              {th.name}
            </FilterChip>
          ))}
        </FilterGroup>
      )}

      <DebouncedField
        label="Verfügbare Kinder"
        type="number"
        inputMode="numeric"
        min={1}
        initial={filters.kinder?.toString() ?? ""}
        supportingText="Zeigt Übungen, die mit so vielen Kindern durchführbar sind."
        onCommit={(v) => setScalar("kinder", v)}
      />

      {anyActive ? (
        <Button variant="outlined" onClick={() => router.push("/", { scroll: false })}>
          <RotateCcw size={18} strokeWidth={2} aria-hidden />
          Filter zurücksetzen
        </Button>
      ) : null}
    </aside>
  );
}

/** TextField mit Debounce (350 ms) — schreibt erst nach Tipppause in die URL. */
function DebouncedField({
  initial,
  onCommit,
  icon = false,
  ...props
}: {
  initial: string;
  onCommit: (value: string) => void;
  icon?: boolean;
  label: string;
  type?: string;
  inputMode?: "numeric";
  min?: number;
  supportingText?: string;
}) {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Externe URL-Änderungen (z. B. Reset) spiegeln.
  useEffect(() => setValue(initial), [initial]);

  function handle(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(v), 350);
  }

  return (
    <div className="relative">
      <TextField
        {...props}
        value={value}
        onChange={(e) => handle(e.target.value)}
        className={icon ? "[&_input]:pl-10" : undefined}
      />
      {icon && (
        <Search
          size={18}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute left-3 top-[18px] text-on-surface-variant"
        />
      )}
    </div>
  );
}
