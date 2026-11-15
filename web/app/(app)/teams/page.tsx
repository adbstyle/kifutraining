import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Shield } from "lucide-react";
import { ButtonLink, Card, Leerzustand, SectionMessage } from "@/components/ui";
import { getMeineTeams } from "@/lib/queries/teams";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { OhneVereinStart } from "@/components/verein/OhneVereinStart";
import { TEAM_NUR_VERWALTUNG } from "@/lib/verein";
import { createClient } from "@/lib/supabase/server";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { Flash } from "@/components/Flash";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams - KiFu", robots: { index: false } };

/* Übersicht der eigenen Teams (Story 3, Story 12). Teams sind nur ihren
   Mitgliedern sichtbar — es gibt keine öffentliche Team-Liste. Der Verein
   steht als erste Krume und führt in seinen Bereich (#577, #581). Die
   Vereinsverwaltung legt Teams dort an und nimmt sich dort selbst in eines
   auf; ohne eigenes Team zeigt diese Seite darum den Weg dorthin. Ein Konto
   ohne Verein findet hier den Einstieg: Verein gründen oder sich aufnehmen
   lassen (#587). */
export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ weg?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Wirft bei einem Datenbankfehler, statt «kein Verein» zu behaupten: Einem
  // Mitglied darf nie «Verein gründen» angeboten werden, nur weil das Lesen
  // gescheitert ist.
  const [teams, verein] = await Promise.all([getMeineTeams(), getMeinVereinOderWurf()]);

  if (!verein)
    return (
      <Seitenrahmen breite="5xl" krumen={[{ label: "Teams" }]}>
        <OhneVereinStart email={user.email ?? null} />
      </Seitenrahmen>
    );

  return (
    <Seitenrahmen
      breite="voll"
      krumen={[{ label: verein.name, href: "/verein" }, { label: "Teams" }]}
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">Teams</h1>
      {/* Die Vereinsverwaltung hat das Team aufgelöst, während man es offen hatte (#480 PC 5). */}
      {sp.weg && (
        <Flash message="Dieses Team besteht nicht mehr - die Vereinsverwaltung hat es aufgelöst." param="weg" />
      )}
      {/* Teams legt die Vereinsverwaltung an. Der Verwaltung selbst sagt der
          Hinweis nichts Neues. */}
      {!verein.istVerwaltung && (
        <SectionMessage appearance="information" className="mb-4">
          {TEAM_NUR_VERWALTUNG}
        </SectionMessage>
      )}
      {teams.length === 0 ? (
        verein.istVerwaltung ? (
          <Leerzustand
            icon={Shield}
            titel="Noch kein Team"
            aktion={
              <ButtonLink href="/verein" variant="outlined">
                Zum Verein
              </ButtonLink>
            }
          >
            Als Vereinsverwaltung nimmst du dich im Bereich «Verein» selbst in ein Team auf.
          </Leerzustand>
        ) : (
          <Leerzustand icon={Shield} titel="Noch kein Team">
            Du gehörst noch zu keinem Team. Ein Mitglied eines Teams kann dich
            aufnehmen.
          </Leerzustand>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
          {teams.map((team) => (
            /* Zustands-Ebene auf dem Link, nicht auf der Karte darin: Er
               deckt die ganze Zeile, und nur er meldet Fokus und Druck. */
            <Link
              key={team.id}
              href={`/team/${team.id}`}
              className="state focus-ring group block rounded-flaeche"
            >
              <Card className="flex h-full items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full betont text-on-surface">
                  <Shield size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-title-large block truncate text-on-surface">
                    {team.name}
                  </span>
                  <span className="type-body-small block text-on-surface-mittel">
                    {team.mitgliederAnzahl}{" "}
                    {team.mitgliederAnzahl === 1 ? "Mitglied" : "Mitglieder"}
                  </span>
                </span>
                <ChevronRight
                  size={20}
                  strokeWidth={2}
                  className="shrink-0 text-on-surface-mittel transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Seitenrahmen>
  );
}
