import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { getTeam, getTeamAufloesungsInfo } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";


/* Die Teamverwaltung: wer dabei ist und wie man wieder herauskommt (Story 17).
 *
 * Beides gehört zusammen, weil beides die Zusammensetzung des Teams betrifft
 * und nicht die Trainingsarbeit. Die Zahlen für den Auflösen-Dialog werden nur
 * hier geladen — die übrigen Ansichten brauchen sie nicht. */
export default async function TeamVerwaltungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Den Zugriff hat der Rahmen bereits geprüft; gebraucht wird hier allein die
  // eigene Kennung, damit sich niemand selbst aus der Liste entfernt.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Der Rahmen hat das Team bereits geladen und die Zugehörigkeit geprüft;
  // `getTeam` antwortet hier aus dem Request-Cache.
  const [team, aufloesung] = await Promise.all([
    getTeam(id),
    getTeamAufloesungsInfo(id),
  ]);
  if (!team) redirect("/teams");

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <h2 className="type-title-large text-on-surface">
          Mitglieder
          <span className="type-label-small ml-2 text-on-surface-mittel">
            {team.mitglieder.length}
          </span>
        </h2>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Alle Mitglieder sind gleichberechtigt: Jede und jeder darf das Team
          umbenennen, Trainings bearbeiten und weitere Trainer:innen aufnehmen.
        </p>
        <div className="mt-4">
          <MitgliederListe
            teamId={team.id}
            mitglieder={team.mitglieder}
            eigeneUserId={user.id}
          />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="type-title-large text-on-surface">Mitgliedschaft beenden</h2>
        <p className="type-body-medium mt-2 mb-4 text-on-surface-mittel">
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
    </div>
  );
}
