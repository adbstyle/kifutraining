import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { SpielerListe } from "@/components/team/SpielerListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { TeamNameFeld } from "@/components/team/TeamNameFeld";
import { getTeam, getTeamAufloesungsInfo } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";
import { ladeSpielerliste, leseAbholung } from "@/lib/kern/spieler";
import { oeffentlicherOrigin } from "@/lib/origin";
import { abholUrl } from "@/lib/spieler";


/* Die Teamverwaltung: wie das Team heisst, wer dabei ist — Mitglieder und
 * Spieler:innen (#434) — und wie man wieder herauskommt (Story 17).
 *
 * Das gehört zusammen, weil es das Team selbst betrifft und nicht die
 * Trainingsarbeit. Die Zahlen für den Auflösen-Dialog werden nur
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
  const [team, aufloesung, liste, abholung, origin] = await Promise.all([
    getTeam(id),
    getTeamAufloesungsInfo(id),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    leseAbholung(supabase, user.id, { teamId: id }),
    oeffentlicherOrigin(),
  ]);
  if (!team) redirect("/teams");
  if (!liste.ok) throw new Error(liste.meldung);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <TeamNameFeld teamId={team.id} name={team.name} />
      </Card>

      <Card className="p-5 sm:p-6">
        <SpielerListe
          teamId={team.id}
          spieler={liste.wert.spieler}
          abholung={{
            url: abholung.ok && abholung.wert.token ? abholUrl(origin, abholung.wert.token) : null,
            aktiv: abholung.ok && abholung.wert.aktiv,
          }}
        />
      </Card>

      <Card className="p-5 sm:p-6">
        <MitgliederListe
          teamId={team.id}
          mitglieder={team.mitglieder}
          eigeneUserId={user.id}
        />
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
