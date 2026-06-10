import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ChevronRight, Sparkles, Play, Printer } from "lucide-react";
import { Breadcrumbs, KategorieChip, ButtonLink } from "@/components/ui";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { getTrainingView } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { groupByTeil, leseBloecke, formatDuration } from "@/lib/training";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training — KiFu",
  robots: { index: false },
};

export default async function TrainingViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && training.ownerId === user.id;

  const sections = groupByTeil(training.exercises).filter((s) => s.items.length > 0);
  const total = sections.reduce((a, s) => a + s.sum, 0);
  const hasAnyDuration = sections.some((s) => s.sum > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Trainings", href: "/trainings" },
          { label: training.name },
        ]}
      />

      <header className="mb-6 mt-4">
        <h1 className="type-headline-large text-on-surface">{training.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-variant">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {hasAnyDuration ? formatDuration(total) : "Keine Dauer erfasst"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/training/${training.id}/durchfuehren`} variant="tonal" size="sm">
            <Play size={18} strokeWidth={2} aria-hidden />
            Durchführen
          </ButtonLink>
          <ButtonLink href={`/training/${training.id}/druck`} variant="outlined" size="sm">
            <Printer size={18} strokeWidth={2} aria-hidden />
            Drucken
          </ButtonLink>
          {isOwner && (
            <ButtonLink href={`/training/${training.id}/edit`} variant="text" size="sm">
              Bearbeiten
            </ButtonLink>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const blocks = leseBloecke(s);
          return (
            <section
              key={s.slug}
              className="rounded-[4px] border-[1.5px] border-outline bg-surface-container-low p-4 sm:p-5"
            >
              <h2 className="mb-3 type-title-medium text-on-surface">
                {s.label}
                {s.sum > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-variant">
                    {formatDuration(s.sum)}
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-4">
                {blocks.map((b) => (
                  <div key={b.key}>
                    {b.label && (
                      <h3 className="mb-2 type-title-small text-on-surface-variant">
                        {b.label}
                        {b.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-variant">
                            {formatDuration(b.sum)}
                          </span>
                        )}
                      </h3>
                    )}
                    <ol className="flex flex-col gap-2">
                      {b.items.map((item, i) => {
                        const dur =
                          s.traegtDauer && item.durationMin != null
                            ? formatDuration(item.durationMin)
                            : null;
                        const inner = (
                          <>
                            <span className="w-5 shrink-0 text-center type-label-medium text-on-surface-variant">
                              {i + 1}
                            </span>
                            <ExerciseThumb
                              bildUrl={item.exercise?.bild_url}
                              name={item.name}
                            />
                            <span className="min-w-0 flex-1 truncate type-body-medium text-on-surface">
                              {item.name}
                            </span>
                            {dur && (
                              <span className="shrink-0 type-label-medium text-on-surface-variant">
                                {dur}
                              </span>
                            )}
                          </>
                        );
                        return (
                          <li key={item.id}>
                            {item.available && item.exercise ? (
                              <Link
                                href={`/uebung/${item.exercise.slug}`}
                                className="focus-ring group flex items-center gap-3 rounded-[4px] px-2 py-2 transition-colors hover:bg-on-surface/8"
                              >
                                {inner}
                                <ChevronRight
                                  size={16}
                                  className="shrink-0 text-on-surface-variant transition-colors group-hover:text-primary"
                                  aria-hidden
                                />
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3 px-2 py-2">
                                {inner}
                                <span className="shrink-0 type-label-small text-on-surface-variant">
                                  nicht verfügbar
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {!user && (
        <div className="mt-8 flex items-center gap-3 rounded-[4px] border border-outline-variant bg-surface-container-low px-4 py-3">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-small text-on-surface-variant">
            Mit einem Konto kannst du eigene Trainings erstellen und
            verwalten.{" "}
            <Link href="/login" className="text-primary underline">
              Anmelden
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
