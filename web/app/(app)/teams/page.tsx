import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { Card, Leerzustand } from "@/components/ui";
import { TeamErstellenButton } from "@/components/team/TeamErstellenButton";
import { getMeineTeams } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams — KiFu", robots: { index: false } };

/* Übersicht der eigenen Teams (Story 3, Story 12). Teams sind nur ihren
   Mitgliedern sichtbar — es gibt keine öffentliche Team-Liste. */
export default async function TeamsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teams = await getMeineTeams();

  return (
    <Seitenrahmen breite="6xl" krumen={[{ label: "Teams" }]}>
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="type-title-large text-on-surface">Teams</h1>
          <TeamErstellenButton />
        </div>
      </header>

      {teams.length === 0 ? (
        <Leerzustand icon={Users} titel="Noch kein Team">
          Lege ein Team an und nimm die Trainer:innen dazu, mit denen du
          zusammen planst.
        </Leerzustand>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            /* Zustands-Ebene auf dem Link, nicht auf der Karte darin: Er
               deckt die ganze Zeile, und nur er meldet Fokus und Druck. */
            <Link
              key={team.id}
              href={`/team/${team.id}`}
              className="state focus-ring group block rounded-flaeche"
            >
              <Card className="flex h-full items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
                  <Users size={22} strokeWidth={2} aria-hidden />
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
