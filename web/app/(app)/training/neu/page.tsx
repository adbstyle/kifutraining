import type { Metadata } from "next";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { TrainingCreateForm } from "@/components/training/TrainingCreateForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Neues Training — KiFu",
  robots: { index: false },
};

export default function NeuesTrainingPage() {
  return (
    <Seitenrahmen
      breite="2xl"
      krumen={[
        { label: "Trainings", href: "/trainings" },
        { label: "Neues Training" },
      ]}
    >
      <header className="mb-8">
        <p className="type-label-medium text-primary">Trainings</p>
        <h1 className="type-headline-large mt-1 text-on-surface">
          Neues Training
        </h1>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Gib deinem Training einen Namen und wähle die Altersstufe — sie
          bestimmt Gliederung und Alterskategorien und steht danach fest.
          Anschliessend ordnest du den Trainingsteilen passende Übungen zu.
        </p>
      </header>

      <TrainingCreateForm />
    </Seitenrahmen>
  );
}
