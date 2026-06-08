"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, Info } from "lucide-react";
import { Card, KategorieChip, Badge } from "@/components/ui";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import { TRAININGSTEILE, ANZAHL_HINWEIS, stufenAbgedeckt } from "@/lib/plan";
import type { TrainingsteilSlug } from "@/lib/vocab";
import type { PlanDetail, PlanExerciseItem } from "@/lib/queries/plans";

/* Trainingsplan-Editor (Story #10). Vier feste Trainingsteil-Abschnitte; je
   Abschnitt lassen sich passende Übungen über den Picker zuordnen. Zuordnungen
   persistieren sofort — nach jeder Aktion frischt der Editor seine Serverdaten
   auf (router.refresh). */
export function PlanEditor({ plan }: { plan: PlanDetail }) {
  const router = useRouter();
  const [openTeil, setOpenTeil] = useState<TrainingsteilSlug | null>(null);

  const byTeil = (slug: TrainingsteilSlug) =>
    plan.exercises.filter((e) => e.trainingsteil === slug);

  return (
    <div className="flex flex-col gap-4">
      {TRAININGSTEILE.map(({ slug, label }) => {
        const items = byTeil(slug);
        const tooMany = items.length > ANZAHL_HINWEIS[slug];
        return (
          <Card key={slug} className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="type-title-medium text-on-surface">
                {label}
                <span className="ml-2 type-label-medium text-on-surface-variant">
                  {items.length} {items.length === 1 ? "Übung" : "Übungen"}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setOpenTeil(slug)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-[4px] border-[1.5px] border-outline px-3 py-1.5 type-label-large text-on-surface transition-colors hover:bg-on-surface/8"
              >
                <Plus size={18} strokeWidth={2.5} aria-hidden />
                Übung hinzufügen
              </button>
            </div>

            {items.length === 0 ? (
              <p className="type-body-small text-on-surface-variant">
                Noch keine Übung zugeordnet.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {items.map((item, i) => (
                  <PlanExerciseRow
                    key={item.id}
                    item={item}
                    index={i}
                    planStufen={plan.stufen}
                  />
                ))}
              </ol>
            )}

            {tooMany && (
              <p className="mt-3 flex items-center gap-2 type-label-medium text-on-surface-variant">
                <Info size={15} className="shrink-0 text-signal" aria-hidden />
                Ungewöhnlich viele Übungen für diesen Trainingsteil — das ist
                erlaubt, achte nur auf die Gesamtdauer.
              </p>
            )}

            {openTeil === slug && (
              <ExercisePickerDialog
                open
                onClose={() => setOpenTeil(null)}
                planId={plan.id}
                trainingsteil={slug}
                trainingsteilLabel={label}
                planStufen={plan.stufen}
                addedExerciseIds={items
                  .map((e) => e.exerciseId)
                  .filter((id): id is string => id != null)}
                onAdded={() => router.refresh()}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PlanExerciseRow({
  item,
  index,
  planStufen,
}: {
  item: PlanExerciseItem;
  index: number;
  planStufen: string[];
}) {
  const mismatch =
    item.available &&
    item.exercise != null &&
    !stufenAbgedeckt(planStufen, item.exercise.kategorien);

  return (
    <li className="flex items-center gap-3 rounded-[4px] border border-outline-variant bg-surface-container-low px-3 py-2.5">
      <span className="w-5 shrink-0 text-center type-label-medium text-on-surface-variant">
        {index + 1}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate type-body-medium text-on-surface">{item.name}</span>
          {mismatch && (
            <span title="Deckt keine der Plan-Stufen ab">
              <TriangleAlert size={15} className="shrink-0 text-signal" aria-hidden />
            </span>
          )}
        </span>
        {!item.available && (
          <span className="type-label-small text-on-surface-variant">
            Übung nicht mehr verfügbar (Platzhalter)
          </span>
        )}
        {item.available && item.exercise && item.exercise.kategorien.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.exercise.kategorien.map((k) => (
              <KategorieChip key={k} k={k as never} />
            ))}
          </span>
        )}
      </span>
      {!item.available && <Badge tone="neutral">Platzhalter</Badge>}
    </li>
  );
}
