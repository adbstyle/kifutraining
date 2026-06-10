"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { MultiSelect, Select } from "@/components/ui";
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

/* Such-/Filterleiste für Plan-Übersichten (Story #13 eigene, #8 öffentliche).
   URL-basierter Zustand wie im Übungskatalog: jede Änderung schreibt in die URL
   und löst eine neue Server-Abfrage aus. Freitext debounced. `showVisibility`
   blendet den Sichtbarkeitsfilter ein (nur eigene Übersicht). */
export function PlanFilterBar({
  q,
  visibility,
  stufen,
  showVisibility = false,
}: {
  q: string;
  visibility?: "public" | "private";
  stufen: string[];
  showVisibility?: boolean;
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

  void searchParams; // an Re-Render bei URL-Wechsel koppeln

  return (
    <div className="mb-6 flex flex-col gap-3">
      <label className="relative block max-w-md">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <input
          type="search"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Nach Plannamen suchen…"
          aria-label="Nach Plannamen suchen"
          className="focus-ring w-full rounded-[4px] border-[1.5px] border-outline bg-surface-container-low py-2.5 pl-10 pr-3 type-body-medium text-on-surface placeholder:text-on-surface-variant"
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        {showVisibility && (
          <Select
            label="Sichtbarkeit"
            options={visOptions}
            value={visibility ?? "all"}
            onChange={setVisibility}
            className="w-full sm:w-44"
          />
        )}
        <MultiSelect
          label="Alterskategorie"
          options={stufenOptions}
          value={stufen}
          onChange={setStufen}
          searchable={false}
          placeholder="Alle Stufen"
          className="w-full sm:w-64"
        />
      </div>
    </div>
  );
}
