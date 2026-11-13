import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { TeamAnsichten } from "@/components/team/TeamAnsichten";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team - KiFu", robots: { index: false } };

/* Der Rahmen um alle Ansichten eines Teams (Story 17).
 *
 * Hier steht, was in jeder Ansicht gleich ist: die Zugehörigkeitsprüfung, die
 * Brotkrumen mit dem Namen des Teams und der Umschalter. Damit lädt keine
 * Ansicht diese Dinge selbst, und der Wechsel zwischen ihnen tauscht nur den
 * Inhalt aus.
 *
 * Ein Team ist ausschliesslich seinen Mitgliedern sichtbar. Ob es nicht
 * existiert oder ob der USER nicht dazugehört, bleibt ununterscheidbar — die
 * Existenz eines fremden Teams ist keine Auskunft wert. */
export default async function TeamLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const [team, verein] = await Promise.all([getTeam(id), getMeinVerein()]);
  if (!team) redirect("/teams");

  // Der Verein steht als erste Krume, ohne Link: Einen Bereich «Verein» gibt
  // es erst mit Story #581. Ohne Verein entfällt sie.
  const krumen = [{ label: "Teams", href: "/teams" }, { label: team.name }];
  return (
    <Seitenrahmen breite="voll" krumen={verein ? [{ label: verein.name }, ...krumen] : krumen}>
      {/* Sichtbar nennt die Brotkrume das Team; die Überschrift bleibt für
          Vorlesehilfen, damit die Seite ihre Gliederung behält. Umbenannt
          wird unter „Team". */}
      <h1 className="sr-only">{team.name}</h1>

      <TeamAnsichten teamId={team.id} />

      {children}
    </Seitenrahmen>
  );
}
