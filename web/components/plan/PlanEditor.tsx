"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  TriangleAlert,
  Info,
  Clock,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Card,
  KategorieChip,
  Badge,
  Dialog,
  Snackbar,
  Button,
  TextField,
  IconButton,
  Tooltip,
} from "@/components/ui";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import { ExerciseThumb } from "./ExerciseThumb";
import { DurationStepper } from "./DurationStepper";
import { StufenField } from "./StufenField";
import { PlanVisibilityControl } from "./PlanVisibilityControl";
import {
  TRAININGSTEILE,
  ANZAHL_HINWEIS,
  stufenAbgedeckt,
  formatDuration,
} from "@/lib/plan";
import {
  setExerciseDuration,
  movePlanExercise,
  removePlanExercise,
  renamePlan,
  setPlanStufen,
  deletePlan,
} from "@/lib/actions/plans";
import type { TrainingsteilSlug } from "@/lib/vocab";
import type { PlanDetail, PlanExerciseItem } from "@/lib/queries/plans";

const AUTO_PRIVATE_MSG =
  "Plan wurde auf privat gesetzt: ein öffentlicher Plan braucht Einleitung und Hauptteil belegt und mindestens eine Stufe.";

/* Trainingsplan-Editor (Stories #10/#11/#12). Vier feste Trainingsteil-Abschnitte
   mit Übungs-Picker, Dauer-Erfassung, Umsortieren (Hoch/Runter) und Entfernen.
   Kopf: Name bearbeiten, Stufen setzen, Plan löschen. Struktur-Änderungen
   frischen die Serverdaten auf; Dauern werden lokal überlagert. */
export function PlanEditor({ plan }: { plan: PlanDetail }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openTeil, setOpenTeil] = useState<TrainingsteilSlug | null>(null);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [stufen, setStufen] = useState<string[]>(plan.stufen);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(plan.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ id: string; name: string }[] | null>(null);

  const dur = (item: PlanExerciseItem) =>
    item.id in durations ? durations[item.id] : item.durationMin;

  function changeDuration(item: PlanExerciseItem, next: number | null) {
    setDurations((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      await setExerciseDuration(item.id, next);
    });
  }

  function move(item: PlanExerciseItem, dir: -1 | 1) {
    startTransition(async () => {
      await movePlanExercise(item.id, dir);
      router.refresh();
    });
  }

  function remove(item: PlanExerciseItem) {
    startTransition(async () => {
      const r = await removePlanExercise(item.id);
      router.refresh();
      if (r.becamePrivate) setNotice(AUTO_PRIVATE_MSG);
    });
  }

  function changeStufen(next: string[]) {
    setStufen(next);
    startTransition(async () => {
      const r = await setPlanStufen(plan.id, next);
      router.refresh();
      if (r.becamePrivate) setNotice(AUTO_PRIVATE_MSG);
      if (r.mismatched && r.mismatched.length > 0) setMismatch(r.mismatched);
    });
  }

  function saveName() {
    startTransition(async () => {
      const r = await renamePlan(plan.id, nameInput);
      if (r.ok) {
        setRenameOpen(false);
        router.refresh();
      } else {
        setNameError(r.error);
      }
    });
  }

  function removeMismatched(ids: string[]) {
    startTransition(async () => {
      for (const id of ids) await removePlanExercise(id);
      setMismatch(null);
      router.refresh();
    });
  }

  const byTeil = (slug: TrainingsteilSlug) =>
    plan.exercises.filter((e) => e.trainingsteil === slug);

  const allDur = plan.exercises.map(dur);
  const totalDuration = allDur.reduce<number>((a, d) => a + (d ?? 0), 0);
  const totalMissing = allDur.filter((d) => d == null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf: Name, Stufen, Löschen */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="type-headline-medium truncate text-on-surface">
                {plan.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(plan.name);
                  setNameError(undefined);
                  setRenameOpen(true);
                }}
                aria-label="Namen bearbeiten"
                className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              >
                <Pencil size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <Badge
              tone={plan.visibility === "public" ? "oeffentlich" : "entwurf"}
              className="mt-2"
            >
              {plan.visibility === "public" ? "Öffentlich" : "✎ Privat"}
            </Badge>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <PlanVisibilityControl planId={plan.id} visibility={plan.visibility} />
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 type-label-large text-error transition-colors hover:bg-error/10"
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              Löschen
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 type-label-large text-on-surface">Stufen</p>
          <StufenField value={stufen} onChange={changeStufen} />
        </div>
      </Card>

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
                {teilDur > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-variant">
                    {formatDuration(teilDur)}
                  </span>
                )}
              </h2>
              <Tooltip label="Übung hinzufügen">
                <IconButton
                  icon={Plus}
                  label={`Übung zu ${label} hinzufügen`}
                  size="sm"
                  onClick={() => setOpenTeil(slug)}
                />
              </Tooltip>
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
                    isFirst={i === 0}
                    isLast={i === items.length - 1}
                    planStufen={stufen}
                    duration={dur(item)}
                    onDuration={(next) => changeDuration(item, next)}
                    onMove={(d) => move(item, d)}
                    onRemove={() => remove(item)}
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
                planStufen={stufen}
                addedExerciseIds={items
                  .map((e) => e.exerciseId)
                  .filter((id): id is string => id != null)}
                onAdded={() => router.refresh()}
              />
            )}
          </Card>
        );
      })}

      {/* Namen bearbeiten */}
      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Name bearbeiten"
        actions={
          <>
            <Button variant="text" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={saveName}>
              Speichern
            </Button>
          </>
        }
      >
        <TextField
          label="Name des Trainingsplans"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={!!nameError}
          supportingText={nameError}
          autoFocus
        />
      </Dialog>

      {/* Stufen-Abweichungs-Hinweis */}
      <Dialog
        open={mismatch != null}
        onClose={() => setMismatch(null)}
        title="Übungen ausserhalb der Stufen"
        actions={
          <>
            <Button variant="text" onClick={() => setMismatch(null)}>
              Behalten
            </Button>
            <Button
              variant="danger"
              onClick={() => removeMismatched((mismatch ?? []).map((m) => m.id))}
            >
              Übungen entfernen
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Diese zugeordneten Übungen decken keine der gewählten Stufen ab. Du
          kannst sie im Plan behalten oder entfernen.
        </p>
        <ul className="flex flex-col gap-1">
          {(mismatch ?? []).map((m) => (
            <li key={m.id} className="type-body-medium text-on-surface">
              · {m.name}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Plan löschen */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Trainingsplan löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <form action={deletePlan.bind(null, plan.id)}>
              <Button type="submit" variant="danger">
                Endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        <p>
          Der Plan „{plan.name}" und alle seine Übungszuordnungen werden
          unwiderruflich gelöscht.
        </p>
      </Dialog>

      <Snackbar
        open={notice != null}
        message={notice ?? ""}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

function PlanExerciseRow({
  item,
  index,
  isFirst,
  isLast,
  planStufen,
  duration,
  onDuration,
  onMove,
  onRemove,
}: {
  item: PlanExerciseItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  planStufen: string[];
  duration: number | null;
  onDuration: (next: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const mismatch =
    item.available &&
    item.exercise != null &&
    !stufenAbgedeckt(planStufen, item.exercise.kategorien);

  return (
    <li className="flex items-center gap-2 rounded-[4px] border border-outline-variant bg-surface-container-low px-3 py-2.5 sm:gap-3">
      {/* Hoch/Runter */}
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label="Nach oben"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
        >
          <ChevronUp size={16} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Nach unten"
          onClick={() => onMove(1)}
          disabled={isLast}
          className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
        >
          <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </span>

      <span className="w-4 shrink-0 text-center type-label-medium text-on-surface-variant">
        {index + 1}
      </span>

      <ExerciseThumb
        bildUrl={item.exercise?.bild_url}
        name={item.name}
        className="hidden sm:block"
      />

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

      <span className="ml-0.5 h-6 w-px shrink-0 bg-outline-variant sm:ml-1" aria-hidden />

      <Tooltip label="Übung entfernen">
        <button
          type="button"
          aria-label="Übung entfernen"
          onClick={onRemove}
          className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
        >
          <Trash2 size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </Tooltip>
    </li>
  );
}
