import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, SearchX, Sparkles } from "lucide-react";
import { PlanCard } from "@/components/plan/PlanCard";
import { PlanFilterBar } from "@/components/plan/PlanFilterBar";
import { getPublicPlans } from "@/lib/queries/plans";
import { createClient } from "@/lib/supabase/server";
import { kategorienSlugs } from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainingspläne entdecken — KiFu",
};

export default async function PlaenePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stufen?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));
  const filtersActive = !!q || stufen.length > 0;

  const plans = await getPublicPlans({ q, stufen });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="type-label-medium text-primary">Trainingsplaner</p>
        <h1 className="type-headline-large mt-1 text-on-surface">
          Trainingspläne entdecken
        </h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Öffentlich geteilte Trainingspläne anderer Trainer als Inspiration.
        </p>
      </header>

      <PlanFilterBar q={q} stufen={stufen} />

      {plans.length === 0 ? (
        <EmptyState
          icon={
            filtersActive ? (
              <SearchX size={40} strokeWidth={1.5} aria-hidden />
            ) : (
              <ClipboardList size={40} strokeWidth={1.5} aria-hidden />
            )
          }
          title={filtersActive ? "Keine Pläne gefunden" : "Noch keine öffentlichen Pläne"}
          text={
            filtersActive
              ? "Kein öffentlicher Plan entspricht der aktiven Suche oder dem Filter. Passe die Kriterien an."
              : "Es wurden noch keine Trainingspläne öffentlich geteilt. Schau später wieder vorbei."
          }
        />
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-variant">
            {plans.length} {plans.length === 1 ? "Plan" : "Pläne"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} href={`/plan/${plan.id}`} />
            ))}
          </div>
        </>
      )}

      {!user && (
        <div className="mt-8 flex items-center gap-3 rounded-[4px] border border-outline-variant bg-surface-container-low px-4 py-3">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-small text-on-surface-variant">
            Mit einem Konto kannst du eigene Trainingspläne erstellen und
            verwalten.{" "}
            <Link href="/login" className="text-primary underline">
              Anmelden
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[6px] border border-outline-variant bg-surface-container-low px-6 py-16 text-center text-on-surface-variant">
      {icon}
      <p className="type-title-medium text-on-surface">{title}</p>
      <p className="type-body-medium max-w-sm">{text}</p>
    </div>
  );
}
