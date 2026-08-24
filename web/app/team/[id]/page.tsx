import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs, Card } from "@/components/ui";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { getTeam } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team — KiFu", robots: { index: false } };

/* Team-Bereich: Kopf mit Umbenennen und die Mitgliederliste (Stories 3, 4).
   Trainings und Termine des Teams kommen in den folgenden Teilen dazu. */
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const team = await getTeam(id);
  // Nicht vorhanden oder kein Mitglied — beides führt zurück in die Übersicht
  // (ununterscheidbar: die Existenz eines fremden Teams ist keine Auskunft wert).
  if (!team) redirect("/teams");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Teams", href: "/teams" }, { label: team.name }]} />

      <header className="mt-4 mb-8">
        <TeamKopf teamId={team.id} name={team.name} />
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Alle Mitglieder sind gleichberechtigt: Jede und jeder darf das Team
          umbenennen, Trainings bearbeiten und weitere Trainer:innen aufnehmen.
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <h2 className="type-title-large text-on-surface">
          Mitglieder
          <span className="type-label-small ml-2 text-on-surface-variant">
            {team.mitglieder.length}
          </span>
        </h2>
        <div className="mt-4">
          <MitgliederListe
            teamId={team.id}
            mitglieder={team.mitglieder}
            eigeneUserId={user.id}
          />
        </div>
      </Card>
    </main>
  );
}
