"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FilterChip, TextField, Button } from "@/components/ui";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  kategorienSlugs,
} from "@/lib/vocab";
import { kategorieStufe } from "@/lib/labels";

export type CatalogFilters = {
  teil: string[];
  kat: string[];
  feld: string[];
  form: string[];
  kinder?: number;
  q?: string;
  fav?: boolean;
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
  canFavorite = false,
}: {
  filters: CatalogFilters;
  canFavorite?: boolean;
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

  const setFlag = useCallback(
    (key: string, on: boolean) => {
      const next = new URLSearchParams(window.location.search);
      if (on) next.set(key, "1");
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
    filters.kinder !== undefined ||
    (filters.q?.length ?? 0) > 0 ||
    !!filters.fav;

  return (
    <aside className="flex flex-col gap-6">
      <DebouncedField
        label="Suche"
        type="search"
        initial={filters.q ?? ""}
        leadingIcon={Search}
        onCommit={(v) => setScalar("q", v)}
      />

      {/* Favoriten-Schalter: eigenständiger Ein/Aus-Modus oben, abgesetzt von
          den übrigen Filterdimensionen. Nur für angemeldete USER (AC11). */}
      {canFavorite && (
        <div className="border-b border-outline-variant pb-6">
          <FilterChip
            selected={!!filters.fav}
            onClick={() => setFlag("fav", !filters.fav)}
            icon={Heart}
            className="w-full justify-center"
          >
            Nur meine Favoriten
          </FilterChip>
        </div>
      )}

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
  ...props
}: {
  initial: string;
  onCommit: (value: string) => void;
  label: string;
  type?: string;
  inputMode?: "numeric";
  min?: number;
  supportingText?: string;
  leadingIcon?: LucideIcon;
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
    <TextField
      {...props}
      value={value}
      onChange={(e) => handle(e.target.value)}
    />
  );
}
