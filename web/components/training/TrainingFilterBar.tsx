"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { FilterChip, MultiSelect, Button, SearchField } from "@/components/ui";
import { useDebouncedWert } from "@/lib/use-debounce";
import { stufenOptionen } from "@/lib/filter-optionen";

/* Such-/Filterleiste für die Trainings-Übersicht.
   URL-basierter Zustand wie im Übungskatalog: jede Änderung schreibt in die URL
   und löst eine neue Server-Abfrage aus. Freitext debounced.

   Der Schalter „Meine Trainings" grenzt die Übersicht ein, statt zwischen zwei
   Beständen zu wechseln: standardmässig stehen die öffentlichen Trainings der
   Community und die eigenen gemeinsam da, genau wie im Übungsbestand
   (Story B). */
export function TrainingFilterBar({
  q,
  stufen,
  mine = false,
  showMine = false,
}: {
  q: string;
  stufen: string[];
  mine?: boolean;
  showMine?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(window.location.search);
    mutate(p);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  // Freitext erst nach der Tipppause in die URL schreiben.
  const [text, onSearch] = useDebouncedWert(q, (value) =>
    pushParams((p) => {
      if (value.trim()) p.set("q", value.trim());
      else p.delete("q");
    }),
  );

  function setStufen(next: string[]) {
    pushParams((p) => {
      if (next.length) p.set("stufen", next.join(","));
      else p.delete("stufen");
    });
  }

  function toggleMine() {
    pushParams((p) => {
      if (mine) p.delete("mine");
      else p.set("mine", "1");
    });
  }

  function reset() {
    // Das Suchfeld folgt über den `q`-Prop — wie im Übungskatalog.
    router.push(pathname, { scroll: false });
  }

  void searchParams; // an Re-Render bei URL-Wechsel koppeln

  const anyActive = q.trim().length > 0 || stufen.length > 0 || mine;

  return (
    // Eine durchgehende, umbrechende Zeile: Suchfeld zuerst, dann die Filter
    // direkt dahinter angereiht. Alle Elemente auf gleicher Höhe (h-12) — die
    // dichte Bauform der Felder fluchtet mit Select-Triggern und Chips.
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <SearchField
        dense
        label="Nach Trainingsnamen suchen"
        value={text}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full sm:w-72"
      />

      <MultiSelect
        label="Alterskategorie"
        hideLabel
        options={stufenOptionen}
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
          Meine Trainings
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
