import { redirect } from "next/navigation";
import { Link2 } from "lucide-react";
import { Card } from "@/components/ui";
import { LinkUebersicht } from "@/components/team/LinkUebersicht";
import { Selbstabholung } from "@/components/team/Selbstabholung";
import { TeamInfosKarte } from "@/components/team/TeamInfosKarte";
import { createClient, getUserImRequest } from "@/lib/supabase/server";
import { ladeSpielerliste, leseAbholung } from "@/lib/kern/spieler";
import { leseTeamInfos } from "@/lib/kern/team-infos";
import { oeffentlicherOrigin } from "@/lib/origin";
import { abholUrl } from "@/lib/spieler";

/* Bereich «Privater Link» der Team-Verwaltung (#656): wie der private Link zu
 * den Spieler:innen kommt — die Selbstabholung (#438) — und was dort über das
 * Team steht, die Infos zum Team (#598). Neben der Selbstabholung die
 * Übersicht, wer den Link hat (#658): die Stände über die ganze Spielerliste
 * samt Schnuppernden. Den Link einer einzelnen Spieler:in zeigt der Bereich
 * «Spieler:innen» an ihrer Zeile. */
export default async function TeamLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Den Zugriff hat der Rahmen bereits geprüft (team/[id]/layout.tsx).
  const user = await getUserImRequest();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [liste, abholung, origin, infos] = await Promise.all([
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    leseAbholung(supabase, user.id, { teamId: id }),
    oeffentlicherOrigin(),
    leseTeamInfos(supabase, user.id, { teamId: id }),
  ]);
  if (!liste.ok) throw new Error(liste.meldung);
  if (!infos.ok) throw new Error(infos.meldung);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Link2 size={20} strokeWidth={2} aria-hidden />
          Link verteilen
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Selbstabholung
            teamId={id}
            start={{
              url: abholung.ok && abholung.wert.token ? abholUrl(origin, abholung.wert.token) : null,
              aktiv: abholung.ok && abholung.wert.aktiv,
            }}
          />
          <LinkUebersicht teamId={id} spieler={liste.wert.spieler} />
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <TeamInfosKarte teamId={id} infos={infos.wert} />
      </Card>
    </div>
  );
}
