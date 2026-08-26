import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { TeamKopf } from "@/components/team/TeamKopf";
import { TeamAnsichten } from "@/components/team/TeamAnsichten";
import { getTeam } from "@/lib/queries/teams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team — KiFu", robots: { index: false } };

/* Der Rahmen um alle Ansichten eines Teams (Story 17).
 *
 * Hier steht, was in jeder Ansicht gleich ist: die Zugehörigkeitsprüfung, der
 * Name des Teams und der Umschalter. Damit lädt keine Ansicht diese Dinge
 * selbst, und der Wechsel zwischen ihnen tauscht nur den Inhalt aus.
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
  const team = await getTeam(id);
  if (!team) redirect("/teams");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Teams", href: "/teams" }, { label: team.name }]} />

      <header className="mt-4 mb-6">
        <TeamKopf teamId={team.id} name={team.name} />
      </header>

      <TeamAnsichten teamId={team.id} />

      {children}
    </main>
  );
}
