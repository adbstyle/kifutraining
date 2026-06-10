import Link from "next/link";
import { Clock, ListChecks } from "lucide-react";
import { Card, KategorieChip, Badge } from "@/components/ui";
import { formatDuration } from "@/lib/training";
import type { TrainingListRow } from "@/lib/queries/trainings";

/* Trainings-Kachel für die Übersichten (Story #13 eigene / #8 öffentliche Trainings).
   Domänenfrei über `href`: eigene Trainings verlinken in den Editor, öffentliche in
   die Ansicht. `showVisibility` blendet den Sichtbarkeitsstatus ein (nur eigene
   Übersicht — öffentliche Trainings sind per Definition öffentlich). */
export function TrainingCard({
  training,
  href,
  showVisibility = false,
  updatedLabel,
}: {
  training: TrainingListRow;
  href: string;
  showVisibility?: boolean;
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
          {showVisibility && (
            <Badge tone={training.visibility === "public" ? "oeffentlich" : "entwurf"}>
              {training.visibility === "public" ? "Öffentlich" : "✎ Privat"}
            </Badge>
          )}
        </div>

        <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
          {training.name}
        </h3>

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
