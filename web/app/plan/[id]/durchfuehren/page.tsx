import type { Metadata } from "next";
import { getPlanView } from "@/lib/queries/plans";
import { PlanNotAvailable } from "@/components/plan/PlanNotAvailable";
import { PlanDurchfuehren } from "@/components/plan/PlanDurchfuehren";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training durchführen — KiFu",
  robots: { index: false },
};

export default async function PlanDurchfuehrenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlanView(id);
  if (!plan) return <PlanNotAvailable />;
  return <PlanDurchfuehren plan={plan} />;
}
