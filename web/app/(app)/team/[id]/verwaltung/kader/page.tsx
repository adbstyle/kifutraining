import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { KaderKarte } from "@/components/team/KaderKarte";
import { SchnupperKarte } from "@/components/team/SchnupperKarte";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { ladeSpielerliste } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { leseProbetraining } from "@/lib/kern/probe";

/* Bereich «Kader & Schnuppern» der Team-Verwaltung (#656): die Kader (#452)
 * und das Schnuppertraining (#555, #584). Auf breiten Bildschirmen stehen die
 * beiden Karten nebeneinander. Die Spielerliste lädt der Bereich nur, weil
 * die Schnupper-Karte nennt, wer schnuppert. */
export default async function TeamKaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Den Zugriff hat der Rahmen bereits geprüft (team/[id]/layout.tsx).
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [kader, probe, liste] = await Promise.all([
    ladeKader(supabase, user.id, { teamId: id }),
    leseProbetraining(supabase, user.id, { teamId: id }),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
  ]);
  if (!kader.ok) throw new Error(kader.meldung);
  if (!probe.ok) throw new Error(probe.meldung);
  if (!liste.ok) throw new Error(liste.meldung);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <KaderKarte teamId={id} kader={kader.wert.kader} />
      </Card>
      <Card className="p-5 sm:p-6">
        <SchnupperKarte teamId={id} probetraining={probe.wert} spieler={liste.wert.spieler} />
      </Card>
    </div>
  );
}
