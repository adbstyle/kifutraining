import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Sparkles, Play, Printer } from "lucide-react";
import { Badge, Breadcrumbs, KategorieChip, ButtonLink } from "@/components/ui";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { Flash } from "@/components/Flash";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { InBibliothekButton } from "@/components/training/InBibliothekButton";
import { TrainingUebernehmenControl } from "@/components/training/TrainingUebernehmenControl";
import { getTrainingView } from "@/lib/queries/trainings";
import { getMeineTeams } from "@/lib/queries/teams";
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { createClient } from "@/lib/supabase/server";
import { leseGliederung, formatDuration } from "@/lib/training";
import { trainingsKrumen } from "@/lib/brotkrumen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training — KiFu",
  robots: { index: false },
};

export default async function TrainingViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uebernommen?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const darfBearbeiten =
    !!user &&
    !!bearbeitungszielVon(
      {
        owner_id: training.ownerId,
        team_id: training.team?.id ?? null,
      },
      user.id,
    );
  // Übernahme-Ziele: nur bei öffentlichen Trainings und nur angemeldet nötig.
  const teams =
    user && training.visibility === "public" ? await getMeineTeams() : [];

  const sections = leseGliederung(training.altersstufe, training.exercises);
  const total = sections.reduce((a, s) => a + s.sum, 0);
  const hasAnyDuration = sections.some((s) => s.sum > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {sp.uebernommen && (
        <Flash message="Kopie liegt in deinem Bestand — du kannst sie jetzt anpassen." />
      )}
      <Breadcrumbs items={trainingsKrumen(training)} />

      <header className="mb-6 mt-4">
        <h1 className="type-headline-large text-on-surface">{training.name}</h1>
        {/* Urheber: der Anzeigename, nie die E-Mail. Bei anonymisierten
            Trainings (Konto gelöscht) entfällt die Zeile ganz (Story 15). */}
        {training.urheber && (
          <p className="mt-1 type-body-medium text-on-surface-variant">
            von {training.urheber}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Die Altersstufe benennen, nicht nur andeuten (Story 5 AK 3):
              Derselbe neutrale Badge wie im Editor und auf der Trainingskarte.
              Für ein fremdes öffentliches Training ist diese Seite die einzige
              Sicht — dort stünde die Angabe sonst nirgends. */}
          <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
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
          {/* Bearbeiten am eigenen Training bzw. im eigenen Team — auch wenn es
              öffentlich ist: Veröffentlichen ist ein Zustand, kein Einfrieren. */}
          {darfBearbeiten && (
            <ButtonLink href={`/training/${training.id}/edit`} variant="text" size="sm">
              Bearbeiten
            </ButtonLink>
          )}
          {/* Übernehmen (Story 11) — für alle Angemeldeten, auch für den
              Urheber selbst: die Kopie ist ein eigenes Trainingsobjekt. */}
          {user && training.visibility === "public" && (
            <TrainingUebernehmenControl quelleId={training.id} teams={teams} />
          )}
        </div>
        {/* Das Ziel sehen auch Betrachter eines veröffentlichten Trainings:
            feldweises Verbergen kennt das Zugriffsmodell nicht (Story 10
            PC 1). Ohne Ziel bleibt der Bereich weg (PC 2). */}
        {training.ziel && (
          <p className="mt-3 type-body-medium text-on-surface">
            <span className="type-label-small text-on-surface-variant">Ziel: </span>
            {training.ziel}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const blocks = s.bloecke;
          return (
            <section
              key={s.key}
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
                        return (
                          // Die Übung im Training ist eine eigenständige Fassung
                          // und verlinkt bewusst nicht auf einen Bibliotheks-
                          // Eintrag: sie hängt von ihm nicht mehr ab, und ihr
                          // Inhalt kann inzwischen abweichen (Story 6 AK 10).
                          <li key={item.id} className="flex items-center gap-3 px-2 py-2">
                            <span className="w-5 shrink-0 text-center type-label-medium text-on-surface-variant">
                              {i + 1}
                            </span>
                            <ExerciseThumb
                              bildUrl={item.bildUrl}
                              diagramm={item.diagramm}
                              bildQuelle={item.bildQuelle}
                              name={item.name}
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate type-body-medium text-on-surface">
                                {item.name}
                              </span>
                            </span>
                            {dur && (
                              <span className="shrink-0 type-label-medium text-on-surface-variant">
                                {dur}
                              </span>
                            )}
                            {/* Auch aus einem fremden öffentlichen Training
                                kopierbar (Story 7 AK 2) — hier gibt es keinen
                                Editor, darum steht die Aktion in der Ansicht. */}
                            {user && (
                              <InBibliothekButton fassungId={item.id} name={item.name} />
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
