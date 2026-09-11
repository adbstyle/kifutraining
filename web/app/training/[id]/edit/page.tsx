import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { TrainingEditor } from "@/components/training/editor/TrainingEditor";
import { getTrainingForEdit } from "@/lib/queries/trainings";
import { getMeineTeams } from "@/lib/queries/teams";
import { trainingsKrumen } from "@/lib/brotkrumen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training bearbeiten — KiFu",
  robots: { index: false },
};

export default async function TrainingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `variante`: welche Variante des Hauptteils zu zeigen ist (#201 AK 6/7) —
   *  fehlt sie oder meint sie eine entfernte, gilt die erste. `bearbeitet`
   *  stammt vom Rückweg aus der Fassungs-Bearbeitung und wird hier nicht
   *  ausgewertet; er steht in der Signatur, damit sichtbar ist, womit diese
   *  Seite aufgerufen wird. */
  searchParams: Promise<{ variante?: string; bearbeitet?: string }>;
}) {
  const { id } = await params;
  const { variante } = await searchParams;
  const training = await getTrainingForEdit(id);
  // Nicht vorhanden oder fremd -> zurück in die eigene Übersicht (kein Schreib-
  // zugriff auf fremde Trainings, Story #12 AC8).
  if (!training) redirect("/trainings?mine=1");

  const teams = await getMeineTeams();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={trainingsKrumen(training)} />
      <div className="mt-4">
        {/* Die Variante kommt als Prop von der Server-Seite, nicht über
            `useSearchParams`: Der Editor wechselt sie ohne Navigation (nur
            `history.replaceState`), und ein Hook, der die Adresse liest,
            machte aus der Adresse die Quelle der Anzeige — dann rechnete jeder
            Wechsel die ganze Seite neu. */}
        <TrainingEditor training={training} teams={teams} varianteParam={variante} />
      </div>
    </main>
  );
}
