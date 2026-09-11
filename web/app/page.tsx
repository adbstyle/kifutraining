import { SearchX, Heart, Plus } from "lucide-react";
import { ExerciseCard, ButtonLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { CatalogFilterBar, type CatalogFilters } from "@/components/catalog/CatalogFilterBar";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { createClient } from "@/lib/supabase/server";
import {
  getExercises,
  toCardData,
  type ExerciseFilters,
} from "@/lib/queries/exercises";
import { alsEinordnungsFilter, einordnungNachSpalten } from "@/lib/filter-optionen";

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

  // Favoriten- und „Meine Übungen"-Filter sind nur für angemeldete USER
  // wirksam (AC11; anonym gibt es keine eigenen/privaten Übungen zu sehen).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canFavorite = !!user;

  const filters: CatalogFilters = {
    // Nur wählbare Einordnungen zählen. Ein Wert aus einem früher geteilten
    // Verweis — namentlich `?teil=hauptteil` — fällt hier weg, statt als
    // unsichtbarer, aber wirksamer Filter stehenzubleiben (Story #129 PC 3).
    // Den früheren `?hkat=`-Parameter liest der Katalog gar nicht mehr: die
    // Hauptteilkategorie wird ausschliesslich über diesen Filter gesteuert.
    teil: alsEinordnungsFilter(list(sp.teil)),
    kat: list(sp.kat),
    feld: list(sp.feld),
    form: list(sp.form),
    typ: list(sp.typ),
    kinder: num(sp.kinder),
    q: typeof sp.q === "string" ? sp.q : undefined,
    fav: sp.fav === "1",
    mine: !!user && sp.mine === "1",
  };
  // Die Einordnungen wirken untereinander als ODER und stehen in zwei Spalten
  // — der Query-Layer bekommt sie darum als `einordnung`, nicht als `teil`.
  const { teil, ...uebrige } = filters;
  const queryFilters: ExerciseFilters = {
    ...uebrige,
    einordnung: einordnungNachSpalten(teil),
  };

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
      {sp.deleted && <Flash message="Übung gelöscht." />}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="type-display-small text-on-surface">Übungen</h1>
          {user && (
            <ButtonLink href="/neu" variant="filled" className="shrink-0">
              <Plus size={20} strokeWidth={2.5} aria-hidden />
              Neue Übung
            </ButtonLink>
          )}
        </div>
        <p className="type-body-large mt-3 max-w-2xl text-on-surface-mittel">
          Der offizielle Kinderfussball-Bestand und Übungen der Community —
          durchsuchbar und filterbar nach Trainingsteil, Alter, Feld und mehr.
          Trainings stellst du nach dem Schema des Kinderfussballs oder des
          Juniorenfussballs zusammen, von der Stufe G bis A.
        </p>
      </header>

      {error && (
        <div className="type-body-small kontur rounded-flaeche border-error bg-transparent p-4 text-error">
          Datenbank nicht erreichbar oder noch nicht geseedet:{" "}
          <code className="ml-1">{error}</code>
          <div className="mt-1">
            Lokal: <code>npm run db:start</code> → <code>npm run db:reset</code> →{" "}
            <code>npm run seed</code>.
          </div>
        </div>
      )}

      {rows && (
        <>
          <CatalogFilterBar filters={filters} canFavorite={canFavorite} showMine={!!user} />

          <p className="type-label-small mb-4 text-on-surface-mittel">
            {rows.length} {rows.length === 1 ? "Übung" : "Übungen"}
          </p>

          {rows.length === 0 ? (
            <div className="kontur flex flex-col items-center gap-3 rounded-flaeche border-dashed border-kante bg-transparent px-6 py-16 text-center">
              {filters.fav ? (
                <>
                  <Heart size={40} strokeWidth={1.5} className="text-on-surface-mittel" aria-hidden />
                  <p className="type-title-medium text-on-surface">Noch keine Favoriten</p>
                  <p className="type-body-medium max-w-sm text-on-surface-mittel">
                    Markiere Übungen mit dem Herz-Symbol, um sie hier
                    wiederzufinden. Andere Filter könnten die Auswahl zusätzlich
                    einschränken.
                  </p>
                </>
              ) : (
                <>
                  <SearchX size={40} strokeWidth={1.5} className="text-on-surface-mittel" aria-hidden />
                  <p className="type-title-medium text-on-surface">Keine Übung gefunden</p>
                  <p className="type-body-medium max-w-sm text-on-surface-mittel">
                    Keine Übung erfüllt alle gesetzten Filter. Entferne einzelne
                    Filter oder setze sie zurück.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        </>
      )}
    </main>
  );
}
