import type { Metadata } from "next";
import { getTrainingView } from "@/lib/queries/trainings";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { TrainingDurchfuehren } from "@/components/training/TrainingDurchfuehren";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training durchführen — KiFu",
  robots: { index: false },
};

export default async function TrainingDurchfuehrenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;
  return <TrainingDurchfuehren training={training} />;
}
