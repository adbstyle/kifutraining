import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { createExercise } from "@/lib/actions/exercises";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Übung — KiFu", robots: { index: false } };

export default async function NeuePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="type-label-medium text-primary">Übungspool</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Neue Übung erstellen</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Erfasse eine eigene Übung mit demselben Feldsatz wie die Manual-Übungen —
          so ist sie gleichwertig durchsuch- und filterbar.
        </p>
      </header>
      <ExerciseForm action={createExercise} submitLabel="Übung speichern" />
    </main>
  );
}
