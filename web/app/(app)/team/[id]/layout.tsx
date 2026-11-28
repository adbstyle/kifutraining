import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTeam } from "@/lib/queries/teams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team - KiFu", robots: { index: false } };

/* Die Zugehörigkeitsprüfung für alle Seiten eines Teams (Story 17).
 *
 * Ein Team ist ausschliesslich seinen Mitgliedern sichtbar. Ob es nicht
 * existiert oder ob der USER nicht dazugehört, bleibt ununterscheidbar — die
 * Existenz eines fremden Teams ist keine Auskunft wert.
 *
 * Den Rahmen mit Brotkrumen und Aktionen setzt jede Seite selbst
 * (components/team/TeamSeite.tsx, #706): Ein Layout kennt weder den Namen der
 * Seite noch ihre Aktionen. Zwischen den Seiten wechselt die Seitenleiste
 * (Bereich «Team», #581); innerhalb der Seite «Spieler:innen» wechseln die
 * Reiter zwischen deren Sichten (#704, spieler/layout.tsx). */
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
  return <>{children}</>;
}
