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
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { getTrainingView } from "@/lib/queries/trainings";
import { getMeineTeams } from "@/lib/queries/teams";
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { createClient } from "@/lib/supabase/server";
import { leseGliederung, formatDuration } from "@/lib/training";
import {
  abschnittMitVariante,
  mitVariante,
  sichtbareZuordnungen,
  varianteAnhang,
  varianteAus,
} from "@/lib/varianten";
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
  searchParams: Promise<{ uebernommen?: string; variante?: string }>;
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

  // Angesehen wird genau eine Variante des Hauptteils, zu Beginn die erste
  // (#203 AK 1/7). Die Wahl steht im Suchparameter und nicht im Zustand: Diese
  // Seite sehen auch Betrachter ohne Konto, und ein Link braucht keine Rechte.
  const aktive = varianteAus(sp.variante, training.varianten);
  const sections = leseGliederung(
    training.altersstufe,
    sichtbareZuordnungen(training.exercises, aktive?.id),
  );
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
          <p className="mt-1 type-body-medium text-on-surface-mittel">
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
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {hasAnyDuration ? formatDuration(total) : "Keine Dauer erfasst"}
          </span>
        </div>

        {/* Weiter geht es in der Variante, die hier offen liegt: Wer sie
            gewählt hat, will sie durchführen, drucken oder bearbeiten — nicht
            wieder die erste (#203 AK 1). `mitVariante` hängt die Angabe nur an,
            wenn es überhaupt etwas zu wählen gibt. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink
            href={mitVariante(
              `/training/${training.id}/durchfuehren`,
              aktive?.id,
              training.varianten,
            )}
            variant="tonal"
            size="sm"
          >
            <Play size={18} strokeWidth={2} aria-hidden />
            Durchführen
          </ButtonLink>
          <ButtonLink
            href={mitVariante(`/training/${training.id}/druck`, aktive?.id, training.varianten)}
            variant="outlined"
            size="sm"
          >
            <Printer size={18} strokeWidth={2} aria-hidden />
            Drucken
          </ButtonLink>
          {/* Bearbeiten am eigenen Training bzw. im eigenen Team — auch wenn es
              öffentlich ist: Veröffentlichen ist ein Zustand, kein Einfrieren. */}
          {darfBearbeiten && (
            <ButtonLink
              href={mitVariante(`/training/${training.id}/edit`, aktive?.id, training.varianten)}
              variant="text"
              size="sm"
            >
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
            <span className="type-label-small text-on-surface-mittel">Ziel: </span>
            {training.ziel}
          </p>
        )}
      </header>

      {/* Über den Trainingsteilen, weil die Variante entscheidet, WAS darunter
          steht (#203 AK 2/7). Links statt Chips: Jede Variante hat eine eigene
          Adresse — so wechselt auch, wer das Training bloss ansehen darf. */}
      <VariantenLinks
        varianten={training.varianten}
        aktiv={aktive?.id}
        hrefFuer={(v) => `/training/${training.id}${varianteAnhang(v)}`}
        className="mb-4"
      />

      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const blocks = s.bloecke;
          return (
            <section
              key={s.key}
              className="rounded-flaeche bg-elev-01 p-4 sm:p-5"
            >
              <h2 className="mb-3 type-title-medium text-on-surface">
                {/* Welche Variante hier steht, gehört an den Hauptteil selbst —
                    nicht nur an die Wahl darüber (#203 AK 5). */}
                {abschnittMitVariante(s.key, s.label, aktive, training.varianten)}
                {s.sum > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-mittel">
                    {formatDuration(s.sum)}
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-4">
                {blocks.map((b) => (
                  <div key={b.key}>
                    {b.label && (
                      <h3 className="mb-2 type-title-small text-on-surface-mittel">
                        {b.label}
                        {b.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-mittel">
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
                            <span className="w-5 shrink-0 text-center type-label-medium text-on-surface-mittel">
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
                              <span className="shrink-0 type-label-medium text-on-surface-mittel">
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
        <div className="mt-8 flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-small text-on-surface-mittel">
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
