import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs, Card } from "@/components/ui";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { TeamTrainingsListe } from "@/components/team/TeamTrainingsListe";
import { TeamTrainingErstellenButton } from "@/components/team/TeamTrainingErstellenButton";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { getTeam, getTeamAufloesungsInfo } from "@/lib/queries/teams";
import { getTeamTrainings } from "@/lib/queries/trainings";
import { getTeamPlan } from "@/lib/queries/termine";
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

  const [aufloesung, trainings, plan] = await Promise.all([
    getTeamAufloesungsInfo(team.id),
    getTeamTrainings(team.id),
    getTeamPlan(team.id),
  ]);

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

      <section className="mb-8">
        <h2 className="mb-4 type-title-large text-on-surface">
          Trainingsplan
          <span className="type-label-small ml-2 text-on-surface-variant">
            {plan.length}
          </span>
        </h2>
        {plan.length === 0 ? (
          <p className="rounded-[6px] border border-outline-variant bg-surface-container-low px-5 py-8 text-center type-body-medium text-on-surface-variant">
            Noch nichts angesetzt. Setze ein Training des Teams auf ein Datum an
            — es erscheint dann hier chronologisch im Plan.
          </p>
        ) : (
          <TrainingsPlan termine={plan} />
        )}
      </section>

      <section className="mb-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="type-title-large text-on-surface">
            Trainings
            <span className="type-label-small ml-2 text-on-surface-variant">
              {trainings.length}
            </span>
          </h2>
          <TeamTrainingErstellenButton teamId={team.id} />
        </div>
        {trainings.length === 0 ? (
          <p className="rounded-[6px] border border-outline-variant bg-surface-container-low px-5 py-8 text-center type-body-medium text-on-surface-variant">
            Noch kein Training im Team. Erstelle eines hier oder stelle eine
            Kopie eines eigenen Trainings ins Team.
          </p>
        ) : (
          <TeamTrainingsListe trainings={trainings} />
        )}
      </section>

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

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="type-title-large text-on-surface">Mitgliedschaft beenden</h2>
        <p className="type-body-medium mt-2 mb-4 text-on-surface-variant">
          Verlassen betrifft nur dich; Auflösen löscht das Team samt seinen
          Trainings und Terminen für alle.
        </p>
        <TeamGefahrenzone
          teamId={team.id}
          anzahlMitglieder={team.mitglieder.length}
          anzahlTrainings={aufloesung.trainings}
          anzahlTermine={aufloesung.termine}
        />
      </Card>
    </main>
  );
}
