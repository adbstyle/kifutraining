import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { KategorieChip, PrintButton } from "@/components/ui";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { TrainingExerciseDetail } from "@/components/training/TrainingExerciseDetail";
import { getTrainingView } from "@/lib/queries/trainings";
import { groupByTeil, leseBloecke, formatDuration } from "@/lib/training";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training drucken — KiFu",
  robots: { index: false },
};

export default async function TrainingDruckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  const sections = groupByTeil(training.exercises).filter((s) => s.items.length > 0);
  const total = sections.reduce((a, s) => a + s.sum, 0);
  const hasAnyDuration = sections.some((s) => s.sum > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-outline pb-4">
        <h1 className="type-headline-large text-on-surface">{training.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-variant">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {hasAnyDuration ? `Gesamtdauer ${formatDuration(total)}` : "Keine Dauer erfasst"}
          </span>
        </div>
      </header>

      {/* Seitenumbruch im Druck: zusammengehalten wird nur die einzelne Übung
          (`break-inside-avoid` am <article>), denn nur sie passt auf eine Seite.
          Abschnitte und Blöcke sind regelmässig mehrere Seiten hoch — hielten
          sie sich zusammen, schob Chrome den ganzen Abschnitt auf eine frische
          Seite, wo die erste Übung erneut nicht mehr hinpasste: die Seite blieb
          bis auf die Überschrift leer. Überschriften bleiben stattdessen per
          `break-after-avoid` an ihrem Inhalt — überschreiten Überschrift und
          erste Übung zusammen eine Seite, wiegt das die Sperre an der <article>
          auf und die Übung bricht um. Gestapelt wird mit Margins statt
          Flex-Gaps, weil Chrome innerhalb von Flex-Containern nicht zuverlässig
          umbricht. */}
      <div className="space-y-8">
        {sections.map((s) => {
          const blocks = leseBloecke(s);
          return (
            <section key={s.slug}>
              <h2 className="mb-4 break-after-avoid border-b border-outline-variant pb-1 type-title-medium text-on-surface">
                {s.label}
                {s.sum > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-variant">
                    {formatDuration(s.sum)}
                  </span>
                )}
              </h2>
              <div className="space-y-6">
                {blocks.map((b) => (
                  <div key={b.key}>
                    {b.label && (
                      <h3 className="mb-3 break-after-avoid type-title-small text-on-surface-variant">
                        {b.label}
                        {b.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-variant">
                            {formatDuration(b.sum)}
                          </span>
                        )}
                      </h3>
                    )}
                    <div className="space-y-6">
                      {b.items.map((item) => (
                        <TrainingExerciseDetail key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
