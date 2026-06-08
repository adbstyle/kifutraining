"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { FilterChip } from "@/components/ui";
import { kategorieStufe } from "@/lib/labels";
import { kategorienSlugs } from "@/lib/vocab";

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

  function toggleStufe(k: string) {
    pushParams((p) => {
      const cur = (p.get("stufen") ?? "").split(",").filter(Boolean);
      const next = cur.includes(k) ? cur.filter((v) => v !== k) : [...cur, k];
      if (next.length) p.set("stufen", next.join(","));
      else p.delete("stufen");
    });
  }

  function setVisibility(v: "public" | "private") {
    pushParams((p) => {
      if (visibility === v) p.delete("vis");
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

      <div className="flex flex-wrap items-center gap-2">
        {showVisibility && (
          <>
            <FilterChip
              selected={visibility === "public"}
              onClick={() => setVisibility("public")}
            >
              Öffentlich
            </FilterChip>
            <FilterChip
              selected={visibility === "private"}
              onClick={() => setVisibility("private")}
            >
              Privat
            </FilterChip>
            <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden />
          </>
        )}
        {kategorienSlugs.map((k) => (
          <FilterChip key={k} selected={stufen.includes(k)} onClick={() => toggleStufe(k)}>
            {kategorieStufe[k]}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
