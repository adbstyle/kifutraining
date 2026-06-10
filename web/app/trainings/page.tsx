import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ClipboardList, SearchX, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { TrainingCard } from "@/components/training/TrainingCard";
import { TrainingFilterBar } from "@/components/training/TrainingFilterBar";
import { getTrainingPool } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/training";
import { kategorienSlugs } from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainings — KiFu",
};

export default async function TrainingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vis?: string;
    stufen?: string;
    mine?: string;
    deleted?: string;
  }>;
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
  // und keine privaten Trainings zu sehen).
  const mine = !!user && sp.mine === "1";
  const filtersActive = !!q || !!visibility || stufen.length > 0 || mine;

  const trainings = await getTrainingPool({ q, visibility, stufen, mine });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {sp.deleted && <Flash message="Training gelöscht." />}

      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="type-headline-large text-on-surface">Trainings</h1>
          {user && (
            <ButtonLink href="/training/neu" variant="filled" className="shrink-0">
              <Plus size={20} strokeWidth={2.5} aria-hidden />
              Neues Training
            </ButtonLink>
          )}
        </div>
        <p className="type-body-medium mt-2 max-w-2xl text-on-surface-variant">
          Öffentlich geteilte Trainings der Community und deine eigenen — ein Pool
          zum Stöbern, Durchführen und Weiterentwickeln.
        </p>
      </header>

      <TrainingFilterBar
        q={q}
        visibility={visibility}
        stufen={stufen}
        mine={mine}
        showVisibility={!!user}
        showMine={!!user}
      />

      {trainings.length === 0 ? (
        <EmptyState
          icon={
            filtersActive ? (
              <SearchX size={40} strokeWidth={1.5} aria-hidden />
            ) : (
              <ClipboardList size={40} strokeWidth={1.5} aria-hidden />
            )
          }
          title={filtersActive ? "Keine Trainings gefunden" : "Noch keine Trainings"}
          text={
            filtersActive
              ? "Kein Training entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
              : user
                ? "Es wurde noch nichts geteilt. Stelle aus dem Übungsbestand dein erstes Training zusammen — es bleibt privat, bis du es öffentlich schaltest."
                : "Es wurden noch keine Trainings öffentlich geteilt. Schau später wieder vorbei."
          }
        />
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-variant">
            {trainings.length} {trainings.length === 1 ? "Training" : "Trainings"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trainings.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                href={`/training/${training.id}`}
                showVisibility
                updatedLabel={formatDate(training.updatedAt)}
              />
            ))}
          </div>
        </>
      )}

      {!user && (
        <div className="mt-8 flex items-center gap-3 rounded-[4px] border border-outline-variant bg-surface-container-low px-4 py-3">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-small text-on-surface-variant">
            Mit einem Konto kannst du eigene Trainings erstellen und
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
