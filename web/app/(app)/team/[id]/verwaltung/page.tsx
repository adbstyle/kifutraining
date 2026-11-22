import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { SpielerListe } from "@/components/team/SpielerListe";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { ladeSpielerliste } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { leseProbetraining } from "@/lib/kern/probe";

/* Bereich «Spieler:innen» der Team-Verwaltung (#656): die Spielerliste samt
 * Link-Dialog je Spieler:in und Zuteilen zu Kadern (#434, #452).
 *
 * Er liegt auf der bisherigen Adresse der Team-Verwaltung, damit Lesezeichen
 * und Verweise darauf weiter gelten (#656 PC 1). Die übrigen Bereiche:
 * kader/ (Kader und Schnuppertraining), link/ (Selbstabholung und Infos zum
 * Team), trainer/ (Teamangaben, Mitglieder, Gefahrenzone). */
export default async function TeamSpielerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Den Zugriff hat der Rahmen bereits geprüft (team/[id]/layout.tsx).
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // `getTeam` antwortet aus dem Request-Cache des Rahmens.
  const [team, verein, liste, kader, probe] = await Promise.all([
    getTeam(id),
    getMeinVerein(),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    ladeKader(supabase, user.id, { teamId: id }),
    leseProbetraining(supabase, user.id, { teamId: id }),
  ]);
  if (!team) redirect("/teams");
  if (!liste.ok) throw new Error(liste.meldung);
  if (!kader.ok) throw new Error(kader.meldung);
  if (!probe.ok) throw new Error(probe.meldung);

  return (
    <Card className="p-5 sm:p-6">
      <SpielerListe
        teamId={team.id}
        teamName={team.name}
        vereinName={verein?.name ?? null}
        spieler={liste.wert.spieler}
        kader={kader.wert.kader}
        probeAnzahl={probe.wert.anzahl}
      />
    </Card>
  );
}
