import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { KategorieChip } from "@/components/ui";
import { PlanNotAvailable } from "@/components/plan/PlanNotAvailable";
import { PlanExerciseDetail } from "@/components/plan/PlanExerciseDetail";
import { PrintButton } from "@/components/plan/PrintButton";
import { getPlanView } from "@/lib/queries/plans";
import { groupByTeil, leseBloecke, formatDuration } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainingsplan drucken — KiFu",
  robots: { index: false },
};

export default async function PlanDruckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlanView(id);
  if (!plan) return <PlanNotAvailable />;

  const sections = groupByTeil(plan.exercises).filter((s) => s.items.length > 0);
  const total = sections.reduce((a, s) => a + s.sum, 0);
  const hasAnyDuration = sections.some((s) => s.sum > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-outline pb-4">
        <h1 className="type-headline-large text-on-surface">{plan.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {plan.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-variant">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {hasAnyDuration ? `Gesamtdauer ${formatDuration(total)}` : "Keine Dauer erfasst"}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {sections.map((s) => {
          const blocks = leseBloecke(s);
          return (
            <section key={s.slug} className="break-inside-avoid">
              <h2 className="mb-4 border-b border-outline-variant pb-1 type-title-medium text-on-surface">
                {s.label}
                {s.sum > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-variant">
                    {formatDuration(s.sum)}
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-6">
                {blocks.map((b) => (
                  <div key={b.key} className="break-inside-avoid">
                    {b.label && (
                      <h3 className="mb-3 type-title-small text-on-surface-variant">
                        {b.label}
                        {b.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-variant">
                            {formatDuration(b.sum)}
                          </span>
                        )}
                      </h3>
                    )}
                    <div className="flex flex-col gap-6">
                      {b.items.map((item) => (
                        <PlanExerciseDetail key={item.id} item={item} showSource />
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
