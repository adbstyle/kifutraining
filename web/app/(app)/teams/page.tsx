import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Shield } from "lucide-react";
import { ButtonLink, Card, Leerzustand, SectionMessage } from "@/components/ui";
import { getMeineTeams } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import { VEREIN_MELDUNG } from "@/lib/verein";
import { createClient } from "@/lib/supabase/server";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { Flash } from "@/components/Flash";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams - KiFu", robots: { index: false } };

/* Übersicht der eigenen Teams (Story 3, Story 12). Teams sind nur ihren
   Mitgliedern sichtbar — es gibt keine öffentliche Team-Liste. Der Verein
   steht als erste Krume (#577). */
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

  const [teams, verein] = await Promise.all([getMeineTeams(), getMeinVerein()]);

  return (
    <Seitenrahmen
      breite="voll"
      krumen={verein ? [{ label: verein.name }, { label: "Teams" }] : [{ label: "Teams" }]}
      // Den Bereich «Verein» sieht nur die Verwaltung (Story #579); den Bereich-
      // Wechsler bringt Story #581.
      aktionen={
        verein?.istVerwaltung ? (
          <ButtonLink href="/verein/spieler" variant="outlined">
            Spieler:innen des Vereins
          </ButtonLink>
        ) : undefined
      }
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">Teams</h1>
      {/* Ein anderes Mitglied hat das Team aufgelöst, während man es offen hatte (#480 PC 5). */}
      {sp.weg && (
        <Flash message="Dieses Team besteht nicht mehr - ein anderes Mitglied hat es aufgelöst." param="weg" />
      )}
      {/* Teams legt die Vereinsverwaltung an; ein Konto ohne Verein sieht in
          Story #577 denselben Hinweis (der eigene kommt mit Story 11, #587). */}
      <SectionMessage appearance="information" className="mb-4">
        {VEREIN_MELDUNG.TEAM_NUR_VERWALTUNG}
      </SectionMessage>
      {teams.length === 0 ? (
        <Leerzustand icon={Shield} titel="Noch kein Team">
          Du gehörst noch zu keinem Team. Ein Mitglied eines Teams kann dich
          aufnehmen.
        </Leerzustand>
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
