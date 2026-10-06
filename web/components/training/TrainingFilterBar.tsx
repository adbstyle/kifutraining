"use client";

import { ClipboardList } from "lucide-react";
import { AuswahlFilter, Button, FilterChip, FilterSuche } from "@/components/ui";
import { stufenOptionen } from "@/lib/filter-optionen";
import { useAdressFilter } from "@/lib/use-adress-filter";

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
  const filter = useAdressFilter();

  const anyActive = q.trim().length > 0 || stufen.length > 0 || mine;

  return (
    // Eine durchgehende, umbrechende Zeile: Suchfeld zuerst, dann die Filter
    // direkt dahinter angereiht — alle Elemente 36 px hoch (Epic #363).
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <FilterSuche label="Nach Trainingsnamen suchen" initial={q} onCommit={(v) => filter.setzeWert("q", v)} />

      <AuswahlFilter
        label="Alterskategorie"
        options={stufenOptionen}
        value={stufen}
        onChange={(v) => filter.setzeListe("stufen", v)}
      />
      {showMine && (
        <FilterChip selected={mine} onClick={() => filter.schalte("mine", !mine)} icon={ClipboardList}>
          Meine Trainings
        </FilterChip>
      )}

      {anyActive && (
        <Button variant="text" onClick={filter.zuruecksetzen}>
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
