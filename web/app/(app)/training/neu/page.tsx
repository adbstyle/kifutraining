import type { Metadata } from "next";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { TrainingCreateForm } from "@/components/training/TrainingCreateForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Neues Training - KiFu",
  robots: { index: false },
};

export default function NeuesTrainingPage() {
  return (
    <Seitenrahmen
      breite="4xl"
      krumen={[
        { label: "Trainings", href: "/trainings" },
        { label: "Neues Training" },
      ]}
    >
      {/* Kopf wie bei «Neue Übung»: Brotkrumen, darunter der Name als
          Kopf-Feld der Maske. Die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">Neues Training</h1>
      <TrainingCreateForm />
    </Seitenrahmen>
  );
}
