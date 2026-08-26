import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { TrainingEditor } from "@/components/training/TrainingEditor";
import { getTrainingForEdit } from "@/lib/queries/trainings";
import { getMeineTeams } from "@/lib/queries/teams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training bearbeiten — KiFu",
  robots: { index: false },
};

export default async function TrainingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const training = await getTrainingForEdit(id);
  // Nicht vorhanden oder fremd -> zurück in die eigene Übersicht (kein Schreib-
  // zugriff auf fremde Trainings, Story #12 AC8).
  if (!training) redirect("/trainings?mine=1");

  const teams = await getMeineTeams();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Trainings", href: "/trainings" },
          { label: training.name },
        ]}
      />
      <div className="mt-4">
        <TrainingEditor training={training} teams={teams} />
      </div>
    </main>
  );
}
