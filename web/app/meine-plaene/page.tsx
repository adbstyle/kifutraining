import type { Metadata } from "next";
import { Plus, ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { PlanCard } from "@/components/plan/PlanCard";
import { getMyPlans } from "@/lib/queries/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Meine Trainingspläne — KiFu",
  robots: { index: false },
};

export default async function MeinePlaenePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const sp = await searchParams;
  const plans = await getMyPlans();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {sp.deleted && <Flash message="Trainingsplan gelöscht." />}

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label-medium text-primary">Trainingsplaner</p>
          <h1 className="type-headline-large mt-1 text-on-surface">
            Meine Trainingspläne
          </h1>
          <p className="type-body-medium mt-2 text-on-surface-variant">
            Deine eigenen Trainingspläne — private wie öffentliche.
          </p>
        </div>
        <ButtonLink href="/plan/neu" variant="filled">
          <Plus size={20} strokeWidth={2.5} aria-hidden />
          Neuer Plan
        </ButtonLink>
      </header>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[6px] border border-outline-variant bg-surface-container-low px-6 py-16 text-center">
          <ClipboardList
            size={40}
            strokeWidth={1.5}
            className="text-on-surface-variant"
            aria-hidden
          />
          <p className="type-title-medium text-on-surface">
            Noch kein Trainingsplan
          </p>
          <p className="type-body-medium max-w-sm text-on-surface-variant">
            Stelle dein erstes Training aus dem Übungsbestand zusammen — es bleibt
            privat, bis du es öffentlich schaltest.
          </p>
          <ButtonLink href="/plan/neu" variant="filled" className="mt-2">
            <Plus size={20} strokeWidth={2.5} aria-hidden />
            Ersten Plan anlegen
          </ButtonLink>
        </div>
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-variant">
            {plans.length} {plans.length === 1 ? "Plan" : "Pläne"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                href={`/plan/${plan.id}/edit`}
                showVisibility
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
