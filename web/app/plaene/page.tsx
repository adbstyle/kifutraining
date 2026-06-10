import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ClipboardList, SearchX, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { PlanCard } from "@/components/plan/PlanCard";
import { PlanFilterBar } from "@/components/plan/PlanFilterBar";
import { getPlanPool } from "@/lib/queries/plans";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/plan";
import { kategorienSlugs } from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainingspläne — KiFu",
};

export default async function PlaenePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vis?: string; stufen?: string; mine?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const visibility = sp.vis === "public" || sp.vis === "private" ? sp.vis : undefined;
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Eingrenzungen sind nur angemeldet sinnvoll (anonym gibt es keine eigenen
  // und keine privaten Pläne zu sehen).
  const mine = !!user && sp.mine === "1";
  const filtersActive = !!q || !!visibility || stufen.length > 0 || mine;

  const plans = await getPlanPool({ q, visibility, stufen, mine });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label-medium text-primary">Trainingsplaner</p>
          <h1 className="type-headline-large mt-1 text-on-surface">
            Trainingspläne
          </h1>
          <p className="type-body-medium mt-2 max-w-2xl text-on-surface-variant">
            Öffentlich geteilte Pläne der Community und deine eigenen — ein Pool
            zum Stöbern, Durchführen und Weiterentwickeln.
          </p>
        </div>
        {user && (
          <ButtonLink href="/plan/neu" variant="filled">
            <Plus size={20} strokeWidth={2.5} aria-hidden />
            Neuer Plan
          </ButtonLink>
        )}
      </header>

      <PlanFilterBar
        q={q}
        visibility={visibility}
        stufen={stufen}
        mine={mine}
        showVisibility={!!user}
        showMine={!!user}
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={
            filtersActive ? (
              <SearchX size={40} strokeWidth={1.5} aria-hidden />
            ) : (
              <ClipboardList size={40} strokeWidth={1.5} aria-hidden />
            )
          }
          title={filtersActive ? "Keine Pläne gefunden" : "Noch keine Trainingspläne"}
          text={
            filtersActive
              ? "Kein Plan entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
              : user
                ? "Es wurde noch nichts geteilt. Stelle aus dem Übungsbestand deinen ersten Plan zusammen — er bleibt privat, bis du ihn öffentlich schaltest."
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
              <PlanCard
                key={plan.id}
                plan={plan}
                href={`/plan/${plan.id}`}
                showVisibility
                updatedLabel={formatDate(plan.updatedAt)}
              />
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
