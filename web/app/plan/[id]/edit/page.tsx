import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs, KategorieChip, Badge } from "@/components/ui";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { getPlanForEdit } from "@/lib/queries/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainingsplan bearbeiten — KiFu",
  robots: { index: false },
};

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlanForEdit(id);
  // Nicht vorhanden oder fremd -> zurück in die eigene Übersicht (kein Schreib-
  // zugriff auf fremde Pläne, Story #12 AC8).
  if (!plan) redirect("/meine-plaene");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Trainingsplaner", href: "/meine-plaene" },
          { label: plan.name },
        ]}
      />

      <header className="mb-8 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-headline-large text-on-surface">{plan.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {plan.stufen.length > 0 ? (
              plan.stufen.map((k) => <KategorieChip key={k} k={k} />)
            ) : (
              <span className="type-label-medium text-on-surface-variant">
                Keine Stufe
              </span>
            )}
            <span className="text-on-surface-variant">·</span>
            <Badge tone={plan.visibility === "public" ? "oeffentlich" : "entwurf"}>
              {plan.visibility === "public" ? "Öffentlich" : "✎ Privat"}
            </Badge>
          </div>
        </div>
      </header>

      <PlanEditor plan={plan} />
    </main>
  );
}
