import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
      {/* Die Brotkrumen gehen in den Editor hinein, statt darüber zu stehen:
          Neben ihnen stehen die Aktionen am Training (#249 AK 8), und die
          kennen nur die Laufzeit des Editors — die angezeigte Variante und die
          Snackbar am unteren Rand. Übergeben werden die Krumen als Daten und
          nicht als fertiges Element: Ein Element aus einer Server-Komponente
          in eine Client-Komponente zu reichen, ist ein Umweg, den die Liste
          selbst nicht braucht. */}
      <TrainingEditor
        training={training}
        teams={teams}
        varianteParam={variante}
        brotkrumen={trainingsKrumen(training)}
      />
    </main>
  );
}
