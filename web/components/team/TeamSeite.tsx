import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";

/* Der Rahmen jeder Seite eines Teams (#706): Brotkrumen bis zum Team und als
   letzte die Seite (`TEAM_SEITEN`: «Trainingsplan», «Spieler:innen»,
   «Trainings», «Team»), rechts daneben die Aktionen der Seite
   (`KopfAktionen`). Eine weitere sichtbare Überschrift gibt es nicht; für
   Vorlesehilfen trägt der Rahmen den Teamnamen als Überschrift, die Seite
   ihre eigene unsichtbar darunter (NFR 2).

   Er steht je Seite statt im Team-Layout, weil ein Layout weder den Namen der
   Seite noch ihre Aktionen kennt — so stehen beide im ersten HTML. Team und
   Verein kommen aus dem Request-Cache; den Zugriff prüft das Team-Layout. */
export async function TeamSeite({
  teamId,
  seite,
  aktionen,
  children,
}: {
  teamId: string;
  seite: string;
  aktionen?: ReactNode;
  children: ReactNode;
}) {
  const [team, verein] = await Promise.all([getTeam(teamId), getMeinVerein()]);
  if (!team) redirect("/teams");

  // Der Verein steht als erste Krume und führt in den Bereich «Verein»; ohne
  // Verein entfällt sie. Der Teamname führt auf den Trainingsplan.
  const krumen = [
    ...(verein ? [{ label: verein.name, href: "/verein" }] : []),
    { label: "Teams", href: "/teams" },
    { label: team.name, href: `/team/${team.id}` },
    { label: seite },
  ];
  return (
    <Seitenrahmen breite="voll" krumen={krumen} aktionen={aktionen}>
      <h1 className="sr-only">{team.name}</h1>
      {children}
    </Seitenrahmen>
  );
}
