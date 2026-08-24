"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, CornerDownRight, Download, ListChecks, Trash2 } from "lucide-react";
import { Button, Card, Dialog, KategorieChip, Snackbar } from "@/components/ui";
import { entferneTeamTraining, uebernimmZuMir } from "@/lib/actions/team-trainings";
import { formatDuration } from "@/lib/training";
import type { TeamTrainingRow } from "@/lib/queries/trainings";

function datumKurz(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* Der Trainingsbestand eines Teams (Story 5).
   Je Eintrag: die Herkunft der Kopie, „Zu mir übernehmen" (erzeugt eine
   persönliche Kopie) und „Entfernen" (nimmt es dem ganzen Team weg). */
export function TeamTrainingsListe({ trainings }: { trainings: TeamTrainingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entfernen, setEntfernen] = useState<TeamTrainingRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function uebernehmen(t: TeamTrainingRow) {
    startTransition(async () => {
      const res = await uebernimmZuMir(t.id);
      setNotice(
        res.ok
          ? `„${t.name}" liegt jetzt als eigene Kopie bei dir.`
          : res.error,
      );
    });
  }

  function entfernenAusfuehren(t: TeamTrainingRow) {
    startTransition(async () => {
      const res = await entferneTeamTraining(t.id);
      setEntfernen(null);
      if (res.ok) {
        router.refresh();
        setNotice(`„${t.name}" wurde aus dem Team entfernt.`);
      } else {
        setNotice(res.error ?? "Entfernen fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {trainings.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {t.stufen.map((k) => (
                    <KategorieChip key={k} k={k} />
                  ))}
                </div>
                <h3 className="type-title-medium text-on-surface">
                  <Link href={`/training/${t.id}/edit`} className="focus-ring hover:text-primary">
                    {t.name}
                  </Link>
                </h3>
                {t.herkunft && (
                  <p className="mt-1 flex items-start gap-1.5 type-body-small text-on-surface-variant">
                    <CornerDownRight
                      size={14}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>
                      basiert auf{" "}
                      <span className="text-on-surface">{t.herkunft.name}</span>, seit{" "}
                      {datumKurz(t.herkunft.datum)} im Team
                    </span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-label-medium text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks size={15} strokeWidth={2} aria-hidden />
                    {t.exerciseCount} {t.exerciseCount === 1 ? "Übung" : "Übungen"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} strokeWidth={2} aria-hidden />
                    {t.hasAnyDuration ? formatDuration(t.totalDuration) : "Keine Dauer"}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="text"
                  size="sm"
                  disabled={pending}
                  onClick={() => uebernehmen(t)}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  Zu mir übernehmen
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  disabled={pending}
                  onClick={() => setEntfernen(t)}
                >
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                  Entfernen
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title="Aus dem Team entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => entfernen && entfernenAusfuehren(entfernen)}
              disabled={pending}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          <strong className="text-on-surface">{entfernen?.name}</strong> wird für
          das ganze Team gelöscht. Ein angesetzter Termin entfällt dabei.
        </p>
        <p className="mt-3">
          Persönliche Kopien, die jemand zu sich übernommen hat, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
