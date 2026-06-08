"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, Info, Clock } from "lucide-react";
import { Card, KategorieChip, Badge } from "@/components/ui";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import { DurationStepper } from "./DurationStepper";
import {
  TRAININGSTEILE,
  ANZAHL_HINWEIS,
  stufenAbgedeckt,
  formatDuration,
} from "@/lib/plan";
import { setExerciseDuration } from "@/lib/actions/plans";
import type { TrainingsteilSlug } from "@/lib/vocab";
import type { PlanDetail, PlanExerciseItem } from "@/lib/queries/plans";

/* Trainingsplan-Editor (Stories #10/#11). Vier feste Trainingsteil-Abschnitte;
   je Abschnitt lassen sich passende Übungen über den Picker zuordnen und mit
   einer Dauer versehen. Struktur-Änderungen (Hinzufügen) frischen die
   Serverdaten auf; Dauern werden für sofortige Summen lokal überlagert und im
   Hintergrund persistiert. */
export function PlanEditor({ plan }: { plan: PlanDetail }) {
  const router = useRouter();
  const [openTeil, setOpenTeil] = useState<TrainingsteilSlug | null>(null);
  const [, startTransition] = useTransition();
  // Lokale Dauer-Überlagerung: sofortige Summen ohne Server-Roundtrip. Die
  // Serverdaten (item.durationMin) sind der Fallback für noch nicht editierte
  // Zuordnungen; nach einem Refresh bleibt die Überlagerung bestehen.
  const [durations, setDurations] = useState<Record<string, number | null>>({});

  const dur = (item: PlanExerciseItem) =>
    item.id in durations ? durations[item.id] : item.durationMin;

  function changeDuration(item: PlanExerciseItem, next: number | null) {
    setDurations((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      await setExerciseDuration(item.id, next);
    });
  }

  const byTeil = (slug: TrainingsteilSlug) =>
    plan.exercises.filter((e) => e.trainingsteil === slug);

  // Gesamtdauer + fehlende Dauern über alle Teile.
  const allDur = plan.exercises.map(dur);
  const totalDuration = allDur.reduce<number>((a, d) => a + (d ?? 0), 0);
  const totalMissing = allDur.filter((d) => d == null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summenleiste */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-outline bg-surface-container px-4 py-3">
        <span className="inline-flex items-center gap-2 type-title-medium text-on-surface">
          <Clock size={18} strokeWidth={2} aria-hidden />
          Gesamtdauer: {formatDuration(totalDuration)}
        </span>
        {totalMissing > 0 && (
          <span className="type-label-medium text-on-surface-variant">
            {totalMissing} {totalMissing === 1 ? "Übung ohne" : "Übungen ohne"} Dauer
          </span>
        )}
      </div>

      {TRAININGSTEILE.map(({ slug, label }) => {
        const items = byTeil(slug);
        const tooMany = items.length > ANZAHL_HINWEIS[slug];
        const teilDur = items.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
        const teilMissing = items.filter((it) => dur(it) == null).length;
        return (
          <Card key={slug} className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="type-title-medium text-on-surface">
                {label}
                <span className="ml-2 type-label-medium text-on-surface-variant">
                  {items.length} {items.length === 1 ? "Übung" : "Übungen"}
                  {teilDur > 0 && ` · ${formatDuration(teilDur)}`}
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
                    duration={dur(item)}
                    onDuration={(next) => changeDuration(item, next)}
                  />
                ))}
              </ol>
            )}

            {(tooMany || teilMissing > 0) && (
              <div className="mt-3 flex flex-col gap-1">
                {tooMany && (
                  <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
                    <Info size={15} className="shrink-0 text-signal" aria-hidden />
                    Ungewöhnlich viele Übungen für diesen Trainingsteil — erlaubt,
                    achte nur auf die Gesamtdauer.
                  </p>
                )}
                {teilMissing > 0 && (
                  <p className="type-label-medium text-on-surface-variant">
                    {teilMissing} {teilMissing === 1 ? "Übung" : "Übungen"} ohne erfasste
                    Dauer (zählt nicht zur Summe).
                  </p>
                )}
              </div>
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
  duration,
  onDuration,
}: {
  item: PlanExerciseItem;
  index: number;
  planStufen: string[];
  duration: number | null;
  onDuration: (next: number | null) => void;
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
      <span className="shrink-0">
        <DurationStepper value={duration} onChange={onDuration} />
      </span>
      {!item.available && <Badge tone="neutral">Platzhalter</Badge>}
    </li>
  );
}
