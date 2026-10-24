import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { SpielerListe } from "@/components/team/SpielerListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { TeamNameFeld } from "@/components/team/TeamNameFeld";
import { getTeam, getTeamAufloesungsInfo } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";
import { ladeSpielerliste, leseAbholung } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { KaderKarte } from "@/components/team/KaderKarte";
import { oeffentlicherOrigin } from "@/lib/origin";
import { abholUrl } from "@/lib/spieler";


/* Die Teamverwaltung: wie das Team heisst, wer dabei ist — Mitglieder und
 * Spieler:innen (#434) — und wie man wieder herauskommt: in der Gefahrenzone
 * am Ende (Story 17, #480).
 *
 * Die Kader (#452) stehen unter der Spielerliste: Sie teilen deren
 * Spieler:innen ein.
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
  const [team, aufloesung, liste, kader, abholung, origin] = await Promise.all([
    getTeam(id),
    getTeamAufloesungsInfo(id),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    ladeKader(supabase, user.id, { teamId: id }),
    leseAbholung(supabase, user.id, { teamId: id }),
    oeffentlicherOrigin(),
  ]);
  if (!team) redirect("/teams");
  if (!liste.ok) throw new Error(liste.meldung);
  if (!kader.ok) throw new Error(kader.meldung);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <TeamNameFeld teamId={team.id} name={team.name} />
      </Card>

      <Card className="p-5 sm:p-6">
        <SpielerListe
          teamId={team.id}
          spieler={liste.wert.spieler}
          kader={kader.wert.kader}
          abholung={{
            url: abholung.ok && abholung.wert.token ? abholUrl(origin, abholung.wert.token) : null,
            aktiv: abholung.ok && abholung.wert.aktiv,
          }}
        />
      </Card>

      <Card className="p-5 sm:p-6">
        <KaderKarte teamId={team.id} kader={kader.wert.kader} />
      </Card>

      <Card className="p-5 sm:p-6">
        <MitgliederListe
          teamId={team.id}
          mitglieder={team.mitglieder}
          eigeneUserId={user.id}
        />
      </Card>

      <TeamGefahrenzone
        teamId={team.id}
        teamName={team.name}
        anzahlMitglieder={team.mitglieder.length}
        folgen={{
          ...aufloesung,
          spieler: liste.wert.spieler.length,
          kader: kader.wert.kader.length,
        }}
      />
    </div>
  );
}
