import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
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
      <div className="mt-4">
        <PlanEditor plan={plan} />
      </div>
    </main>
  );
}
