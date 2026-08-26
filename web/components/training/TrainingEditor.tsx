"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  TriangleAlert,
  Info,
  Clock,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  Users,
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
import { InBibliothekButton } from "./InBibliothekButton";
import { DurationStepper } from "./DurationStepper";
import { StufenField } from "./StufenField";
import { VorlagenControl } from "./VorlagenControl";
import { InTeamStellenControl } from "./InTeamStellenControl";
import {
  TRAININGSTEILE,
  HAUPTTEILKATEGORIEN,
  ANZAHL_HINWEIS,
  stufenAbgedeckt,
  teilTraegtDauer,
  groupHauptteil,
  formatDuration,
} from "@/lib/training";
import {
  setExerciseDuration,
  moveTrainingExercise,
  removeTrainingExercise,
  renameTraining,
  setTrainingStufen,
  deleteTraining,
} from "@/lib/actions/trainings";
import type { TrainingsteilSlug, HauptteilkategorieSlug } from "@/lib/vocab";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/* Trainings-Editor (Stories #10/#11/#12). Vier feste Trainingsteil-Abschnitte
   mit Übungs-Picker, Dauer-Erfassung, Umsortieren (Hoch/Runter) und Entfernen.
   Kopf: Name bearbeiten, Stufen setzen, Training löschen. Struktur-Änderungen
   frischen die Serverdaten auf; Dauern werden lokal überlagert. */
export function TrainingEditor({
  training,
  /** Die Teams des USERS — Ziele für „Ins Team stellen" (Team-Epic Story 5). */
  teams = [],
}: {
  training: TrainingDetail;
  teams?: TeamUebersicht[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Offener Picker: Trainingsteil und — im Hauptteil — die Unterkategorie.
  const [open, setOpen] = useState<{
    teil: TrainingsteilSlug;
    hkat?: HauptteilkategorieSlug;
  } | null>(null);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [stufen, setStufen] = useState<string[]>(training.stufen);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(training.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ id: string; name: string }[] | null>(null);

  const dur = (item: TrainingExerciseItem) =>
    item.id in durations ? durations[item.id] : item.durationMin;

  function changeDuration(item: TrainingExerciseItem, next: number | null) {
    setDurations((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      await setExerciseDuration(item.id, next);
    });
  }

  function move(item: TrainingExerciseItem, dir: -1 | 1) {
    startTransition(async () => {
      await moveTrainingExercise(item.id, dir);
      router.refresh();
    });
  }

  function remove(item: TrainingExerciseItem) {
    startTransition(async () => {
      await removeTrainingExercise(item.id);
      router.refresh();
    });
  }

  function changeStufen(next: string[]) {
    setStufen(next);
    startTransition(async () => {
      const r = await setTrainingStufen(training.id, next);
      router.refresh();
      if (r.mismatched && r.mismatched.length > 0) setMismatch(r.mismatched);
    });
  }

  function saveName() {
    startTransition(async () => {
      const r = await renameTraining(training.id, nameInput);
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
      for (const id of ids) await removeTrainingExercise(id);
      setMismatch(null);
      router.refresh();
    });
  }

  const byTeil = (slug: TrainingsteilSlug) =>
    training.exercises.filter((e) => e.trainingsteil === slug);

  // Auffangen trägt keine Dauer und zählt weder zur Summe noch zum
  // „ohne Dauer"-Hinweis.
  // Was zum Veröffentlichen fehlt: so erscheint die Tragweite-Bestätigung nur
  // für ein veröffentlichbares Training. Die Action prüft es serverseitig
  // erneut.
  const fehlendeVoraussetzungen = [
    stufen.length === 0 ? "stufe" : null,
    training.exercises.some((e) => e.trainingsteil === "einleitung") ? null : "einleitung",
    training.exercises.some((e) => e.trainingsteil === "hauptteil") ? null : "hauptteil",
  ].filter((x): x is string => x !== null);

  const dauerItems = training.exercises.filter((e) => teilTraegtDauer(e.trainingsteil));
  const totalDuration = dauerItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
  const totalMissing = dauerItems.filter((it) => dur(it) == null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf: Name, Stufen, Löschen */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="type-headline-medium truncate text-on-surface">
                {training.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(training.name);
                  setNameError(undefined);
                  setRenameOpen(true);
                }}
                aria-label="Namen bearbeiten"
                className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              >
                <Pencil size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            {/* Team-Training oder persönliches? Die Marke sagt, wem es gehört —
                und bei persönlichen zusätzlich, ob es davon eine öffentliche
                Vorlage gibt. */}
            {training.team ? (
              <Link
                href={`/team/${training.team.id}`}
                className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-[4px] type-label-medium text-on-surface-variant hover:text-primary"
              >
                <Users size={16} strokeWidth={2} aria-hidden />
                Team-Training von {training.team.name}
              </Link>
            ) : (
              <Badge tone={training.vorlageId ? "oeffentlich" : "entwurf"} className="mt-2">
                {training.vorlageId ? "Vorlage aktiv" : "✎ Privat"}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* Veröffentlichen und Ins-Team-Stellen gibt es nur für das eigene
                Training: ein Team-Training gehört dem Team, nicht einer Person. */}
            {!training.team && (
              <>
                <VorlagenControl
                  trainingId={training.id}
                  vorlageId={training.vorlageId}
                  fehlend={fehlendeVoraussetzungen}
                />
                <InTeamStellenControl trainingId={training.id} teams={teams} />
              </>
            )}
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
        const traegtDauer = teilTraegtDauer(slug);
        const teilItems = byTeil(slug);

        // Hauptteil: in die drei Unterkategorien gegliedert (Story #23). Stets
        // alle drei sichtbar, je eigener Picker/Liste/Reihenfolge.
        if (slug === "hauptteil") {
          const subgroups = groupHauptteil(teilItems);
          const teilDur = teilItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
          const tooMany = teilItems.length > ANZAHL_HINWEIS[slug];
          const teilMissing = teilItems.filter((it) => dur(it) == null).length;
          const spielLeer =
            subgroups.find((g) => g.slug === "fussball-spielen")?.items.length === 0;
          return (
            <Card key={slug} className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <h2 className="type-title-medium text-on-surface">{label}</h2>
                {teilDur > 0 && (
                  <span className="type-label-medium text-on-surface-variant">
                    {formatDuration(teilDur)}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-5">
                {subgroups.map((g) => (
                  <div key={g.slug}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="type-title-small text-on-surface">
                        {g.label}
                        {g.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-variant">
                            {formatDuration(g.sum)}
                          </span>
                        )}
                      </h3>
                      <Tooltip label="Übung hinzufügen">
                        <IconButton
                          icon={Plus}
                          label={`Übung zu ${g.label} hinzufügen`}
                          size="sm"
                          onClick={() => setOpen({ teil: slug, hkat: g.slug })}
                        />
                      </Tooltip>
                    </div>
                    <ExerciseList
                      items={g.items}
                      trainingId={training.id}
                      trainingStufen={stufen}
                      showDuration={traegtDauer}
                      dur={dur}
                      onDuration={changeDuration}
                      onMove={move}
                      onRemove={remove}
                    />
                  </div>
                ))}
              </div>

              {(spielLeer || tooMany || teilMissing > 0) && (
                <div className="mt-3 flex flex-col gap-1">
                  {spielLeer && (
                    <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
                      <Info size={15} className="shrink-0 text-signal" aria-hidden />
                      Das freie Spiel («Fussball spielen») ist noch leer — im
                      Kinderfussball gehört es in jedes Training.
                    </p>
                  )}
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
            </Card>
          );
        }

        // Übrige Trainingsteile (Auffangen, Einleitung, Ausklang).
        const tooMany = teilItems.length > ANZAHL_HINWEIS[slug];
        const teilDur = traegtDauer
          ? teilItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0)
          : 0;
        const teilMissing = traegtDauer
          ? teilItems.filter((it) => dur(it) == null).length
          : 0;
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
                  onClick={() => setOpen({ teil: slug })}
                />
              </Tooltip>
            </div>

            <ExerciseList
              items={teilItems}
              trainingId={training.id}
              trainingStufen={stufen}
              showDuration={traegtDauer}
              dur={dur}
              onDuration={changeDuration}
              onMove={move}
              onRemove={remove}
            />

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
          </Card>
        );
      })}

      {/* Ein Picker, gesteuert über `open` (Trainingsteil + ggf. Unterkategorie). */}
      {open &&
        (() => {
          const teilLabel =
            TRAININGSTEILE.find((t) => t.slug === open.teil)?.label ?? open.teil;
          const sub = open.hkat
            ? HAUPTTEILKATEGORIEN.find((h) => h.slug === open.hkat)
            : undefined;
          const openItems = training.exercises.filter(
            (e) =>
              e.trainingsteil === open.teil &&
              (!open.hkat || e.hauptteilkategorie === open.hkat),
          );
          return (
            <ExercisePickerDialog
              open
              onClose={() => setOpen(null)}
              trainingId={training.id}
              trainingsteil={open.teil}
              trainingsteilLabel={teilLabel}
              hauptteilkategorie={sub?.slug}
              hauptteilkategorieLabel={sub?.label}
              trainingStufen={stufen}
              onAdded={() => router.refresh()}
            />
          );
        })()}

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
          label="Name des Trainings"
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
          kannst sie im Training behalten oder entfernen.
        </p>
        <ul className="flex flex-col gap-1">
          {(mismatch ?? []).map((m) => (
            <li key={m.id} className="type-body-medium text-on-surface">
              · {m.name}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Training löschen */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Training löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <form action={deleteTraining.bind(null, training.id)}>
              <Button type="submit" variant="danger">
                Endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        <p>
          Das Training „{training.name}" und alle seine Übungszuordnungen werden
          unwiderruflich gelöscht.
        </p>
        {/* Die Vorlage lässt sich nur über dieses Training zurückziehen —
            bliebe sie stehen, käme niemand mehr an sie heran. */}
        {training.vorlageId && (
          <p className="mt-3">
            Die veröffentlichte Vorlage wird dabei zurückgezogen. Kopien, die
            andere bereits übernommen haben, bleiben bestehen.
          </p>
        )}
      </Dialog>

      <Snackbar
        open={notice != null}
        message={notice ?? ""}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

/** Geordnete Übungsliste eines (Unter-)Abschnitts: leerer Zustand oder die
 *  Zuordnungen als umsortierbare Zeilen. Wird vom Trainingsteil und von jeder
 *  Hauptteil-Unterkategorie gleichermassen genutzt. */
function ExerciseList({
  items,
  trainingId,
  trainingStufen,
  showDuration,
  dur,
  onDuration,
  onMove,
  onRemove,
}: {
  items: TrainingExerciseItem[];
  trainingId: string;
  trainingStufen: string[];
  showDuration: boolean;
  dur: (item: TrainingExerciseItem) => number | null;
  onDuration: (item: TrainingExerciseItem, next: number | null) => void;
  onMove: (item: TrainingExerciseItem, dir: -1 | 1) => void;
  onRemove: (item: TrainingExerciseItem) => void;
}) {
  if (items.length === 0)
    return (
      <p className="type-body-small text-on-surface-variant">
        Noch keine Übung zugeordnet.
      </p>
    );
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <TrainingExerciseRow
          key={item.id}
          item={item}
          index={i}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          trainingId={trainingId}
          trainingStufen={trainingStufen}
          showDuration={showDuration}
          duration={dur(item)}
          onDuration={(next) => onDuration(item, next)}
          onMove={(d) => onMove(item, d)}
          onRemove={() => onRemove(item)}
        />
      ))}
    </ol>
  );
}

function TrainingExerciseRow({
  item,
  index,
  isFirst,
  isLast,
  trainingId,
  trainingStufen,
  showDuration,
  duration,
  onDuration,
  onMove,
  onRemove,
}: {
  item: TrainingExerciseItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  trainingId: string;
  trainingStufen: string[];
  showDuration: boolean;
  duration: number | null;
  onDuration: (next: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  // Ohne Kategorien gibt es nichts abzudecken (z. B. eine inhaltsleere Fassung
  // aus der Bestand-Überführung) — dieselbe Regel wie in setTrainingStufen,
  // sonst stünde ein Warndreieck, das keine Stufenwahl je entfernt.
  const mismatch =
    item.kategorien.length > 0 && !stufenAbgedeckt(trainingStufen, item.kategorien);

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
        bildUrl={item.bildUrl}
        diagramm={item.diagramm}
        bildQuelle={item.bildQuelle}
        name={item.name}
        className="hidden sm:block"
      />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate type-body-medium text-on-surface">{item.name}</span>
          {mismatch && (
            <span title="Deckt keine der Trainings-Stufen ab">
              <TriangleAlert size={15} className="shrink-0 text-signal" aria-hidden />
            </span>
          )}
        </span>
        {item.kategorien.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.kategorien.map((k) => (
              <KategorieChip key={k} k={k as never} />
            ))}
          </span>
        )}
      </span>

      {showDuration && (
        <>
          <span className="shrink-0">
            <DurationStepper value={duration} onChange={onDuration} />
          </span>
          <span
            className="ml-0.5 h-6 w-px shrink-0 bg-outline-variant sm:ml-1"
            aria-hidden
          />
        </>
      )}

      <InBibliothekButton fassungId={item.id} name={item.name} />

      <Tooltip label="Übung bearbeiten">
        <Link
          href={`/training/${trainingId}/uebung/${item.id}/edit`}
          aria-label={`${item.name} bearbeiten`}
          className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-primary"
        >
          <Pencil size={16} strokeWidth={2.5} aria-hidden />
        </Link>
      </Tooltip>

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
