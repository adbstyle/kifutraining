import { SearchX, Heart } from "lucide-react";
import { ExerciseCard, ButtonLink, Leerzustand, SectionMessage } from "@/components/ui";
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
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

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
    <Seitenrahmen
      breite="voll"
      krumen={filters.mine ? [{ label: "Übungen", href: "/" }, { label: "Meine Übungen" }] : [{ label: "Übungen" }]}
      aktionen={
        user && (
          <ButtonLink href="/neu" variant="filled">
            Übung erstellen
          </ButtonLink>
        )
      }
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">{filters.mine ? "Meine Übungen" : "Übungen"}</h1>
      {sp.account_deleted && (
        <Flash
          message="Konto gelöscht. Deine öffentlichen Übungen bleiben anonym erhalten."
          param="account_deleted"
        />
      )}
      {sp.deleted && <Flash message="Übung gelöscht." param="deleted" />}
      {error && (
        <SectionMessage appearance="error">
          Datenbank nicht erreichbar oder noch nicht geseedet:{" "}
          <code className="ml-1">{error}</code>
          <div className="mt-1">
            Lokal: <code>npm run db:start</code> → <code>npm run db:reset</code> →{" "}
            <code>npm run seed</code>.
          </div>
        </SectionMessage>
      )}

      {rows && (
        <>
          <CatalogFilterBar filters={filters} canFavorite={canFavorite} showMine={!!user} />

          <p className="type-label-small mb-4 text-on-surface-mittel">
            {rows.length} {rows.length === 1 ? "Übung" : "Übungen"}
          </p>

          {rows.length === 0 ? (
            <Leerzustand
              icon={filters.fav ? Heart : SearchX}
              titel={filters.fav ? "Noch keine Favoriten" : "Keine Übung gefunden"}
            >
              {filters.fav
                ? "Markiere Übungen mit dem Herz-Symbol, um sie hier wiederzufinden. Andere Filter könnten die Auswahl zusätzlich einschränken."
                : "Keine Übung erfüllt alle gesetzten Filter. Entferne einzelne Filter oder setze sie zurück."}
            </Leerzustand>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {rows.map((row) => (
                <ExerciseCard
                  key={row.id}
                  ex={toCardData(row)}
                  actionSlot={
                    canFavorite ? (
                      <FavoriteButton
                        exerciseId={row.id}
                        initial={row.is_favorited}
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
    </Seitenrahmen>
  );
}
