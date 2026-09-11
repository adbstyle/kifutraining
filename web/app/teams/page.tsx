import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui";
import { TeamErstellenButton } from "@/components/team/TeamErstellenButton";
import { getMeineTeams } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="type-headline-large text-on-surface">Teams</h1>
          <TeamErstellenButton />
        </div>
        <p className="type-body-medium mt-2 max-w-2xl text-on-surface-mittel">
          Ein Team plant gemeinsam: Trainings gehören dem Team, jedes Mitglied
          darf sie bearbeiten, terminieren und durchführen.
        </p>
      </header>

      {teams.length === 0 ? (
        <div className="kontur flex flex-col items-center gap-3 rounded-flaeche border-dashed border-kante bg-transparent px-6 py-16 text-center text-on-surface-mittel">
          <Users size={40} strokeWidth={1.5} aria-hidden />
          <p className="type-title-medium text-on-surface">Noch kein Team</p>
          <p className="type-body-medium max-w-sm">
            Lege ein Team an und nimm die Trainer:innen dazu, mit denen du
            zusammen planst.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/team/${team.id}`}
              className="focus-ring group rounded-flaeche"
            >
              <Card className="state flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
                  <Users size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-title-medium block truncate text-on-surface">
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
    </main>
  );
}
