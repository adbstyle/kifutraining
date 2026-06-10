"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ClipboardList } from "lucide-react";
import { FilterChip, MultiSelect, Select, Button } from "@/components/ui";
import { kategorieStufe } from "@/lib/labels";
import { kategorienSlugs } from "@/lib/vocab";

// Stufen als Multiselect-Optionen; Sichtbarkeit als Single-Select mit
// „Alle" = kein Filter (mappt auf gelöschten vis-Parameter).
const stufenOptions = kategorienSlugs.map((k) => ({ value: k, label: kategorieStufe[k] }));
const visOptions = [
  { value: "all", label: "Alle" },
  { value: "public", label: "Öffentlich" },
  { value: "private", label: "Privat" },
];

/* Such-/Filterleiste für Trainings-Übersichten (eigene Trainings und Trainings-Pool).
   URL-basierter Zustand wie im Übungskatalog: jede Änderung schreibt in die URL
   und löst eine neue Server-Abfrage aus. Freitext debounced. `showVisibility`
   blendet den Sichtbarkeitsfilter ein, `showMine` den „Nur meine Trainings"-Schalter
   (beide nur angemeldet sinnvoll). */
export function TrainingFilterBar({
  q,
  visibility,
  stufen,
  mine = false,
  showVisibility = false,
  showMine = false,
}: {
  q: string;
  visibility?: "public" | "private";
  stufen: string[];
  mine?: boolean;
  showVisibility?: boolean;
  showMine?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Externe Änderung (z. B. Zurück-Navigation) in das Suchfeld spiegeln.
  useEffect(() => setText(q), [q]);

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(window.location.search);
    mutate(p);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function onSearch(value: string) {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      pushParams((p) => {
        if (value.trim()) p.set("q", value.trim());
        else p.delete("q");
      });
    }, 300);
  }

  function setStufen(next: string[]) {
    pushParams((p) => {
      if (next.length) p.set("stufen", next.join(","));
      else p.delete("stufen");
    });
  }

  function setVisibility(v: string) {
    pushParams((p) => {
      if (v === "all") p.delete("vis");
      else p.set("vis", v);
    });
  }

  function toggleMine() {
    pushParams((p) => {
      if (mine) p.delete("mine");
      else p.set("mine", "1");
    });
  }

  function reset() {
    setText("");
    router.push(pathname, { scroll: false });
  }

  void searchParams; // an Re-Render bei URL-Wechsel koppeln

  const anyActive =
    q.trim().length > 0 || !!visibility || stufen.length > 0 || mine;

  return (
    // Eine durchgehende, umbrechende Zeile: Suchfeld zuerst, dann die Filter
    // direkt dahinter angereiht. Labels sind in die Felder gewandert (Empty-
    // State als Beschriftung), darum alle Elemente auf gleicher Höhe (h-12).
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <label className="relative block w-full sm:w-72">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <input
          type="search"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Nach Trainingsnamen suchen…"
          aria-label="Nach Trainingsnamen suchen"
          className="focus-ring h-12 w-full rounded-[4px] border-[1.5px] border-outline bg-surface-container-low pl-10 pr-3 type-body-medium text-on-surface placeholder:text-on-surface-variant"
        />
      </label>

      {showVisibility && (
        <Select
          label="Sichtbarkeit"
          hideLabel
          options={visOptions}
          value={visibility ?? "all"}
          onChange={setVisibility}
          className="w-full sm:w-44"
        />
      )}
      <MultiSelect
        label="Alterskategorie"
        hideLabel
        options={stufenOptions}
        value={stufen}
        onChange={setStufen}
        searchable={false}
        placeholder="Alle Stufen"
        className="w-full sm:w-64"
      />
      {showMine && (
        <FilterChip
          selected={mine}
          onClick={toggleMine}
          icon={ClipboardList}
          className="h-12"
        >
          Nur meine Trainings
        </FilterChip>
      )}

      {anyActive && (
        <Button variant="text" onClick={reset}>
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
