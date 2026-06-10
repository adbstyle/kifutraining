import { SearchX, Heart, Plus } from "lucide-react";
import { ExerciseCard, ButtonLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { FilterPanel, type CatalogFilters } from "@/components/catalog/FilterPanel";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { createClient } from "@/lib/supabase/server";
import {
  getExercises,
  toCardData,
  type ExerciseFilters,
} from "@/lib/queries/exercises";

// Server-only Datenzugriff (anon-Key + RLS); kein Prerender ohne DB.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v.join(",") : v).split(",").filter(Boolean);
}

function num(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters: CatalogFilters = {
    teil: list(sp.teil),
    kat: list(sp.kat),
    feld: list(sp.feld),
    form: list(sp.form),
    hkat: list(sp.hkat),
    kinder: num(sp.kinder),
    q: typeof sp.q === "string" ? sp.q : undefined,
    fav: sp.fav === "1",
  };
  const queryFilters: ExerciseFilters = { ...filters };

  // Favoriten-Aktion + -Filter nur für angemeldete USER (AC11).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canFavorite = !!user;

  let rows: Awaited<ReturnType<typeof getExercises>> | null = null;
  let error: string | null = null;

  try {
    rows = await getExercises(queryFilters);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unbekannter Fehler";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {sp.account_deleted && (
        <Flash message="Konto gelöscht. Deine öffentlichen Übungen bleiben anonym erhalten." />
      )}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label-medium text-primary">Übungspool</p>
          <h1 className="type-display-small mt-1 text-on-surface">Übungen finden</h1>
          <p className="type-body-large mt-3 max-w-2xl text-on-surface-variant">
            Der offizielle Kinderfussball-Bestand und Übungen der Community —
            durchsuchbar und filterbar nach Trainingsteil, Alter, Feld und mehr.
          </p>
        </div>
        {user && (
          <ButtonLink href="/neu" variant="filled">
            <Plus size={20} strokeWidth={2.5} aria-hidden />
            Neue Übung
          </ButtonLink>
        )}
      </header>

      {error && (
        <div className="type-body-small rounded-[4px] border border-error/40 bg-error/10 p-4 text-on-surface">
          Datenbank nicht erreichbar oder noch nicht geseedet:{" "}
          <code className="ml-1">{error}</code>
          <div className="mt-1 text-on-surface-variant">
            Lokal: <code>npm run db:start</code> → <code>npm run db:reset</code> →{" "}
            <code>npm run seed</code>.
          </div>
        </div>
      )}

      {rows && (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <FilterPanel filters={filters} canFavorite={canFavorite} />

          <section>
            <p className="type-label-small mb-4 text-on-surface-variant">
              {rows.length} {rows.length === 1 ? "Übung" : "Übungen"}
            </p>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[6px] border border-outline-variant bg-surface-container-low px-6 py-16 text-center">
                {filters.fav ? (
                  <>
                    <Heart size={40} strokeWidth={1.5} className="text-on-surface-variant" aria-hidden />
                    <p className="type-title-medium text-on-surface">Noch keine Favoriten</p>
                    <p className="type-body-medium max-w-sm text-on-surface-variant">
                      Markiere Übungen mit dem Herz-Symbol, um sie hier
                      wiederzufinden. Andere Filter könnten die Auswahl zusätzlich
                      einschränken.
                    </p>
                  </>
                ) : (
                  <>
                    <SearchX size={40} strokeWidth={1.5} className="text-on-surface-variant" aria-hidden />
                    <p className="type-title-medium text-on-surface">Keine Übung gefunden</p>
                    <p className="type-body-medium max-w-sm text-on-surface-variant">
                      Keine Übung erfüllt alle gesetzten Filter. Entferne einzelne
                      Filter oder setze sie zurück.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            )}
          </section>
        </div>
      )}
    </main>
  );
}
