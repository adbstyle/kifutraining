import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, SearchX, Sparkles } from "lucide-react";
import { ButtonLink, Leerzustand } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { TrainingCard } from "@/components/training/TrainingCard";
import { TrainingFilterBar } from "@/components/training/TrainingFilterBar";
import { getTrainingPool } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/training";
import { kategorienSlugs } from "@/lib/vocab";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

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
    <Seitenrahmen
      breite="voll"
      krumen={
        mine ? [{ label: "Trainings", href: "/trainings" }, { label: "Meine Trainings" }] : [{ label: "Trainings" }]
      }
    >
      {sp.deleted && <Flash message="Training gelöscht." param="deleted" />}

      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="type-title-large text-on-surface">Trainings</h1>
          {user && (
            <ButtonLink href="/training/neu" variant="filled" size="sm" className="shrink-0">
              Training erstellen
            </ButtonLink>
          )}
        </div>
      </header>

      <TrainingFilterBar q={q} stufen={stufen} mine={mine} showMine={!!user} />

      {trainings.length === 0 ? (
        <Leerzustand
          icon={filtersActive ? SearchX : ClipboardList}
          titel={
            filtersActive
              ? "Keine Trainings gefunden"
              : mine
                ? "Noch kein eigenes Training"
                : "Noch keine Trainings"
          }
        >
          {filtersActive
            ? "Kein Training entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
            : mine
              ? "Stelle aus dem Übungsbestand dein erstes Training zusammen — es bleibt ein Entwurf, bis du es veröffentlichst."
              : user
                ? "Stelle dein erstes Training zusammen. Veröffentlichst du es, steht es der Community zur Verfügung."
                : "Es wurde noch kein Training veröffentlicht. Schau später wieder vorbei."}
        </Leerzustand>
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-mittel">
            {trainings.length} {trainings.length === 1 ? "Training" : "Trainings"}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
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
    </Seitenrahmen>
  );
}
