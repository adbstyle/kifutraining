import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { KategorieChip, PrintButton } from "@/components/ui";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { TrainingExerciseDetail } from "@/components/training/TrainingExerciseDetail";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { getTrainingView } from "@/lib/queries/trainings";
import { leseGliederung, formatDuration } from "@/lib/training";
import {
  abschnittMitVariante,
  sichtbareZuordnungen,
  varianteAnhang,
  varianteAus,
} from "@/lib/varianten";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training drucken — KiFu",
  robots: { index: false },
};

export default async function TrainingDruckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variante?: string }>;
}) {
  const { id } = await params;
  const { variante: varianteParam } = await searchParams;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  // Ein Ausdruck zeigt GENAU EINE Variante des Hauptteils — zu Beginn die
  // erste (#203 AK 3, Out of Scope 1). Je Variante entsteht damit ein eigener
  // Ausdruck unter eigener Adresse.
  const aktive = varianteAus(varianteParam, training.varianten);
  const sections = leseGliederung(
    training.altersstufe,
    sichtbareZuordnungen(training.exercises, aktive?.id),
  );
  const total = sections.reduce((a, s) => a + s.sum, 0);
  const hasAnyDuration = sections.some((s) => s.sum > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      {/* Die Variantenwahl gehört zur Bedienung der Seite, nicht aufs Papier —
          darum steht sie neben dem Druckknopf und teilt dessen `print:hidden`
          (#203 AK 4). Auf dem Blatt nennen die Hauptteil-Überschrift und der
          Kopfbereich, welche Variante gedruckt wurde. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <VariantenLinks
          varianten={training.varianten}
          aktiv={aktive?.id}
          hrefFuer={(v) => `/training/${training.id}/druck${varianteAnhang(v)}`}
        />
        {/* `ml-auto` hält den Knopf rechts, auch wenn die Variantenwahl gar
            nichts rendert (genau eine Variante) — `justify-between` allein
            liesse ihn dann nach links rutschen. */}
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <header className="mb-6 border-b border-kante pb-4">
        <h1 className="type-headline-large text-on-surface">{training.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {hasAnyDuration ? `Gesamtdauer ${formatDuration(total)}` : "Keine Dauer erfasst"}
          </span>
        </div>
        {training.ziel && (
          <p className="mt-2 type-body-medium text-on-surface">
            <span className="type-label-small text-on-surface-mittel">Ziel: </span>
            {training.ziel}
          </p>
        )}
        {/* Die Bezeichnung gehört ZUSÄTZLICH in den Kopf, weil die Überschrift
            des Hauptteils sie nicht immer trägt: Ist der Hauptteil dieser
            Variante leer, fällt sein Abschnitt ganz weg (`leseGliederung`
            überspringt leere) — und auf dem Blatt stünde nirgends, welche der
            Varianten gedruckt wurde. Zwei Ausdrucke wären dann nicht mehr
            auseinanderzuhalten. Druckbar, also ohne `print:hidden`; kleiner
            Label-Stil wie beim Ziel. */}
        {training.varianten.length > 1 && aktive && (
          <p className="mt-2 type-body-medium text-on-surface">
            <span className="type-label-small text-on-surface-mittel">
              Variante des Hauptteils:{" "}
            </span>
            „{aktive.name}"
          </p>
        )}
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
          const blocks = s.bloecke;
          return (
            <section key={s.key}>
              <h2 className="mb-4 break-after-avoid border-b border-linie pb-1 type-title-medium text-on-surface">
                {/* Auf dem Ausdruck ist die Überschrift der einzige Ort, an dem
                    die Variante noch steht — die Wahl darüber ist weg
                    (#203 AK 5). */}
                {abschnittMitVariante(s.key, s.label, aktive, training.varianten)}
                {s.sum > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-mittel">
                    {formatDuration(s.sum)}
                  </span>
                )}
              </h2>
              <div className="space-y-6">
                {blocks.map((b) => (
                  <div key={b.key}>
                    {b.label && (
                      <h3 className="mb-3 break-after-avoid type-title-small text-on-surface-mittel">
                        {b.label}
                        {b.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-mittel">
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
