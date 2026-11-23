import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { abfrageAus, loginAdresse } from "@/lib/weiterleitung";
import { SearchX, Heart } from "lucide-react";
import { BestandAnzeige, ExerciseCard, ButtonLink, Leerzustand, SectionMessage } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { CatalogFilterBar, type CatalogFilters } from "@/components/catalog/CatalogFilterBar";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { createClient } from "@/lib/supabase/server";
import { getMeineGrenzen } from "@/lib/queries/verein";
import {
  getExercises,
  toCardData,
  type ExerciseFilters,
} from "@/lib/queries/exercises";
import { alsEinordnungsFilter, einordnungNachSpalten } from "@/lib/filter-optionen";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { UEBUNGEN_PFAD } from "@/lib/navigation";
import { liesListe, liesPositiveZahl, mitAnzahl, type AdressParameter } from "@/lib/adresse";

// Server-only Datenzugriff (anon-Key + RLS); kein Prerender ohne DB.
export const dynamic = "force-dynamic";
/* Eigener Titel wie «Trainings - KiFu»: Seit «/» die Startseite ist (#674),
   trug der Katalog sonst den allgemeinen Titel der Wurzel. */
export const metadata: Metadata = {
  title: "Übungen - KiFu",
};

// Der Katalog zeigt die Kacheln seitenweise: Jede Kachel trägt ihr Diagramm als
// serverseitig gezeichnetes SVG, und der ganze Bestand auf einmal kostete pro
// Aufruf rund eine Sekunde Rechenzeit und ~9 MB Seite. «Weitere anzeigen» hebt
// `?anzahl=` um eine Seite an; ein Filterwechsel setzt ihn zurück
// (lib/use-adress-filter.ts).
const SEITE = 24;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<AdressParameter>;
}) {
  const sp = await searchParams;

  // Nur mit Konto (#669): ohne Anmeldung leitet die Middleware vorher auf die Startseite.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginAdresse(UEBUNGEN_PFAD, abfrageAus(sp)));

  const filters: CatalogFilters = {
    // Nur wählbare Einordnungen zählen. Ein Wert aus einem früher geteilten
    // Verweis — namentlich `?teil=hauptteil` — fällt hier weg, statt als
    // unsichtbarer, aber wirksamer Filter stehenzubleiben (Story #129 PC 3).
    // Den früheren `?hkat=`-Parameter liest der Katalog gar nicht mehr: die
    // Hauptteilkategorie wird ausschliesslich über diesen Filter gesteuert.
    teil: alsEinordnungsFilter(liesListe(sp.teil)),
    kat: liesListe(sp.kat),
    feld: liesListe(sp.feld),
    form: liesListe(sp.form),
    typ: liesListe(sp.typ),
    kinder: liesPositiveZahl(sp.kinder),
    q: typeof sp.q === "string" ? sp.q : undefined,
    fav: sp.fav === "1",
    mine: sp.mine === "1",
  };
  // Die Einordnungen wirken untereinander als ODER und stehen in zwei Spalten
  // — der Query-Layer bekommt sie darum als `einordnung`, nicht als `teil`.
  const { teil, ...uebrige } = filters;
  const queryFilters: ExerciseFilters = {
    ...uebrige,
    einordnung: einordnungNachSpalten(teil),
  };

  const anzahl = Math.max(SEITE, liesPositiveZahl(sp.anzahl) ?? 0);

  // Nur in «Meine Übungen» und nur für ein Konto ohne Verein (#588 AK 5, PC 3):
  // der Stand von der Datenebene, nie aus der gezählten Liste (Filter, Seitenschnitt).
  const grenzen = filters.mine ? await getMeineGrenzen() : null;

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
      krumen={filters.mine ? [{ label: "Übungen", href: UEBUNGEN_PFAD }, { label: "Meine Übungen" }] : [{ label: "Übungen" }]}
      aktionen={
        <ButtonLink href="/neu" variant="filled">
          Übung erstellen
        </ButtonLink>
      }
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">{filters.mine ? "Meine Übungen" : "Übungen"}</h1>
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

      {grenzen && <BestandAnzeige art="uebungen" grenze={grenzen.uebungen} className="mb-4" />}

      {rows && (
        <>
          <CatalogFilterBar filters={filters} />

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
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                {rows.slice(0, anzahl).map((row) => (
                  <ExerciseCard
                    key={row.id}
                    ex={toCardData(row)}
                    actionSlot={
                      <FavoriteButton
                        exerciseId={row.id}
                        initial={row.is_favorited}
                        variant="overlay"
                      />
                    }
                  />
                ))}
              </div>
              {rows.length > SEITE && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  {/* Live-Region: Eine Sprachausgabe sagt nach dem Nachladen
                      an, wie viele Kacheln nun zu sehen sind — auch auf der
                      letzten Seite, wo der Knopf wegfällt. */}
                  <p role="status" className="type-label-small text-on-surface-mittel">
                    {Math.min(anzahl, rows.length)} von {rows.length} Übungen
                  </p>
                  {rows.length > anzahl && (
                    <ButtonLink
                      href={mitAnzahl(UEBUNGEN_PFAD, sp, anzahl + SEITE)}
                      scroll={false}
                      variant="outlined"
                    >
                      Weitere anzeigen
                    </ButtonLink>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Seitenrahmen>
  );
}
