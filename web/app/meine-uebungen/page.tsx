import type { Metadata } from "next";
import { Plus, FolderOpen } from "lucide-react";
import { ExerciseCard, ButtonLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { createClient } from "@/lib/supabase/server";
import { getMyExercises, toCardData } from "@/lib/queries/exercises";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meine Übungen — KiFu", robots: { index: false } };

export default async function MeineUebungenPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const sp = await searchParams;
  const rows = await getMyExercises();

  // Favoriten-Aktion nur für angemeldete USER (AC11) — wie im Katalog abgeleitet.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canFavorite = !!user;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {sp.deleted && <Flash message="Übung gelöscht." />}

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label-medium text-primary">Übungspool</p>
          <h1 className="type-headline-large mt-1 text-on-surface">Meine Übungen</h1>
          <p className="type-body-medium mt-2 text-on-surface-variant">
            Deine eigenen Übungen — öffentliche und private Entwürfe.
          </p>
        </div>
        <ButtonLink href="/neu" variant="filled">
          <Plus size={20} strokeWidth={2.5} aria-hidden />
          Neue Übung
        </ButtonLink>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[6px] border border-outline-variant bg-surface-container-low px-6 py-16 text-center">
          <FolderOpen size={40} strokeWidth={1.5} className="text-on-surface-variant" aria-hidden />
          <p className="type-title-medium text-on-surface">Noch keine eigene Übung</p>
          <p className="type-body-medium max-w-sm text-on-surface-variant">
            Du hast noch keine Übung erstellt. Lege deine erste an — sie bleibt
            privat, bis du sie öffentlich schaltest.
          </p>
          <ButtonLink href="/neu" variant="filled" className="mt-2">
            <Plus size={20} strokeWidth={2.5} aria-hidden />
            Erste Übung erstellen
          </ButtonLink>
        </div>
      ) : (
        <>
          <p className="type-label-small mb-4 text-on-surface-variant">
            {rows.length} {rows.length === 1 ? "Übung" : "Übungen"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <ExerciseCard
                key={row.id}
                ex={toCardData(row)}
                actionSlot={
                  canFavorite ? (
                    <FavoriteButton
                      exerciseId={row.id}
                      initial={row.is_favorited}
                      size="sm"
                      variant="overlay"
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
