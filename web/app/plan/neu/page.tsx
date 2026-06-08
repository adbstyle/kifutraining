import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui";
import { PlanCreateForm } from "@/components/plan/PlanCreateForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Neuer Trainingsplan — KiFu",
  robots: { index: false },
};

export default function NeuerPlanPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Trainingsplaner", href: "/meine-plaene" },
          { label: "Neuer Plan" },
        ]}
      />
      <header className="mb-8 mt-4">
        <p className="type-label-medium text-primary">Trainingsplaner</p>
        <h1 className="type-headline-large mt-1 text-on-surface">
          Neuer Trainingsplan
        </h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Gib deinem Training einen Namen. Anschliessend ordnest du den vier
          Trainingsteilen passende Übungen zu.
        </p>
      </header>

      <PlanCreateForm />
    </main>
  );
}
