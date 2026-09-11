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
    stufen?: string;
    mine?: string;
    deleted?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // „Meine Trainings" ist nur angemeldet sinnvoll — anonym gibt es keine.
  const mine = !!user && sp.mine === "1";
  const filtersActive = !!q || stufen.length > 0;

  const trainings = await getTrainingPool({ q, stufen, mine });

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
        <p className="type-body-medium mt-2 max-w-2xl text-on-surface-mittel">
          {mine
            ? "Deine eigenen Trainings, Entwürfe eingeschlossen. Team-Trainings findest du im jeweiligen Team."
            : user
              ? "Die öffentlichen Trainings der Community und deine eigenen — zum Stöbern, Durchführen und Übernehmen. Eine Übernahme ist eine eigenständige Kopie, die du frei anpassen kannst."
              : "Öffentliche Trainings der Community — zum Stöbern, Durchführen und Übernehmen. Eine Übernahme ist eine eigenständige Kopie, die du frei anpassen kannst."}
        </p>
      </header>

      <TrainingFilterBar q={q} stufen={stufen} mine={mine} showMine={!!user} />

      {trainings.length === 0 ? (
        <EmptyState
          icon={
            filtersActive ? (
              <SearchX size={40} strokeWidth={1.5} aria-hidden />
            ) : (
              <ClipboardList size={40} strokeWidth={1.5} aria-hidden />
            )
          }
          title={
            filtersActive
              ? "Keine Trainings gefunden"
              : mine
                ? "Noch kein eigenes Training"
                : "Noch keine Trainings"
          }
          text={
            filtersActive
              ? "Kein Training entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
              : mine
                ? "Stelle aus dem Übungsbestand dein erstes Training zusammen — es bleibt ein Entwurf, bis du es veröffentlichst."
                : user
                  ? "Stelle dein erstes Training zusammen. Veröffentlichst du es, steht es der Community zur Verfügung."
                  : "Es wurde noch kein Training veröffentlicht. Schau später wieder vorbei."
          }
        />
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-mittel">
            {trainings.length} {trainings.length === 1 ? "Training" : "Trainings"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trainings.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                // Je Eintrag, nicht je Ansicht: die Übersicht mischt beide
                // Bestände, das eigene Training führt in den Editor, ein
                // fremdes in die Ansicht (Story B AK 5).
                href={
                  training.istEigen
                    ? `/training/${training.id}/edit`
                    : `/training/${training.id}`
                }
                zeigeUrheber={!training.istEigen}
                updatedLabel={formatDate(training.updatedAt)}
              />
            ))}
          </div>
        </>
      )}

      {!user && (
        <div className="mt-8 flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3">
          <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-small text-on-surface-mittel">
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
    <div className="kontur flex flex-col items-center gap-3 rounded-flaeche border-dashed border-kante bg-transparent px-6 py-16 text-center text-on-surface-mittel">
      {icon}
      <p className="type-title-medium text-on-surface">{title}</p>
      <p className="type-body-medium max-w-sm">{text}</p>
    </div>
  );
}
