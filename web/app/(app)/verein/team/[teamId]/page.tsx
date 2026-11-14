import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { VereinTeamVerwaltung } from "@/components/verein/VereinTeamVerwaltung";
import { ladeVereinTeamAnsicht } from "@/lib/kern/verein";
import { getMeinVereinOderWurf } from "@/lib/queries/verein";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team im Verein - KiFu", robots: { index: false } };

/* Ein Team aus Sicht der Vereinsverwaltung (Epic Vereine #575, Story #581):
   Name, Trainerteam, Spieler:innen, Auflösen. Nur für die Verwaltung; wer sie
   nicht ist, wer das Team nicht sehen darf oder wessen Team aufgelöst wurde,
   geht ununterscheidbar zur Übersicht zurück (AP §4.4).

   Die Daten kommen aus `verein_team_ansicht`, nicht aus `getTeam`: Die RLS
   lässt die Verwaltung nur in eigene Teams, und die Ansicht zeigt bewusst
   nicht mehr, als die Verwaltung wissen darf (AK 10). Die Sperre ist die
   Datenebene, die Weiterleitung hier nur der Weg. */
export default async function VereinTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const verein = await getMeinVereinOderWurf();
  if (!verein) redirect("/teams");
  if (!verein.istVerwaltung) redirect("/verein");

  const r = await ladeVereinTeamAnsicht(supabase, user.id, { teamId });
  if (!r.ok) {
    if (r.art === "nicht_gefunden") redirect("/verein");
    throw new Error(r.meldung);
  }

  return (
    <Seitenrahmen
      breite="5xl"
      krumen={[{ label: verein.name }, { label: "Teams", href: "/verein" }, { label: r.wert.name }]}
    >
      <h1 className="sr-only">{r.wert.name}</h1>
      <VereinTeamVerwaltung vereinId={verein.id} vereinName={verein.name} team={r.wert} />
    </Seitenrahmen>
  );
}
