import Link from "next/link";
import { Clock, ListChecks } from "lucide-react";
import { Card, KategorieChip } from "@/components/ui";
import { formatDuration } from "@/lib/training";
import type { TrainingListRow } from "@/lib/queries/trainings";

/* Trainings-Kachel für die Übersichten.
   Domänenfrei über `href`: eigene Trainings verlinken in den Editor, Vorlagen in
   die Ansicht. Einen Sichtbarkeits-Status trägt die Kachel nicht mehr — seit
   dem Kopie-Modell sagt schon die Ansicht, in welchem Bestand man ist:
   Vorlagen sind öffentlich, „Meine Trainings" sind privat. */
export function TrainingCard({
  training,
  href,
  /** In der eigenen Übersicht überflüssig — dort ist der Urheber immer man
   *  selbst. */
  zeigeUrheber = true,
  updatedLabel,
}: {
  training: TrainingListRow;
  href: string;
  zeigeUrheber?: boolean;
  /** Optionaler „Geändert"-Hinweis (eigene Übersicht, Story #13 AC2). */
  updatedLabel?: string;
}) {
  return (
    <Card className="group transition-colors hover:border-on-surface/45">
      <Link
        href={href}
        className="focus-ring-inset block rounded-[4px] p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </div>

        <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
          {training.name}
        </h3>

        {/* Urheber: der Anzeigename, nie die E-Mail. Bei anonymisierten
            Vorlagen (Konto gelöscht) entfällt die Zeile ganz (Story 15). */}
        {zeigeUrheber && training.urheber && (
          <p className="mt-1 type-body-small text-on-surface-variant">
            von {training.urheber}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 type-label-medium text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={15} strokeWidth={2} aria-hidden />
            {training.exerciseCount} {training.exerciseCount === 1 ? "Übung" : "Übungen"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2} aria-hidden />
            {training.hasAnyDuration ? formatDuration(training.totalDuration) : "Keine Dauer"}
          </span>
        </div>

        {updatedLabel && (
          <p className="mt-2 type-label-small text-on-surface-variant">
            Geändert: {updatedLabel}
          </p>
        )}
      </Link>
    </Card>
  );
}
