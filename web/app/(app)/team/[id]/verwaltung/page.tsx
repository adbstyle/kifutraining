import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { SpielerListe } from "@/components/team/SpielerListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { getTeam } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";
import { ladeSpielerliste, leseAbholung } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { KaderKarte } from "@/components/team/KaderKarte";
import { ProbeKarte } from "@/components/team/ProbeKarte";
import { leseProbetraining } from "@/lib/kern/probe";
import { oeffentlicherOrigin } from "@/lib/origin";
import { abholUrl } from "@/lib/spieler";
import { getMeinVerein } from "@/lib/queries/verein";

/* Die Teamverwaltung: wie das Team heisst und zu welchem Verein es gehört,
 * wer dabei ist — Mitglieder und Spieler:innen (#434) — und wie man wieder
 * herauskommt: in der Gefahrenzone am Ende (Story 17, #581).
 *
 * Den Namen zeigt die Seite nur an: Umbenennen und Auflösen macht die
 * Vereinsverwaltung im Bereich «Verein» (#581 AK 27) — auch dann, wenn die
 * Person zugleich Mitglied des Teams ist; am Team-Ort gibt es für sie keine
 * Verwaltungsaktion.
 *
 * Das Probetraining (#555) und die Kader (#452) stehen unter der
 * Spielerliste: Sie betreffen deren Spieler:innen.
 *
 * Das gehört zusammen, weil es das Team selbst betrifft und nicht die
 * Trainingsarbeit. */
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
  const [team, verein, liste, kader, abholung, origin, probe] = await Promise.all([
    getTeam(id),
    getMeinVerein(),
    ladeSpielerliste(supabase, user.id, { teamId: id }),
    ladeKader(supabase, user.id, { teamId: id }),
    leseAbholung(supabase, user.id, { teamId: id }),
    oeffentlicherOrigin(),
    leseProbetraining(supabase, user.id, { teamId: id }),
  ]);
  if (!team) redirect("/teams");
  if (!liste.ok) throw new Error(liste.meldung);
  if (!kader.ok) throw new Error(kader.meldung);
  if (!probe.ok) throw new Error(probe.meldung);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <h2 className="type-title-medium text-on-surface">Teamangaben</h2>
        <p className="type-body-small text-on-surface-mittel">Legt die Vereinsverwaltung fest</p>
        <dl className="mt-3">
          <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
            <dt className="type-body-medium text-on-surface-mittel">Name</dt>
            <dd className="type-body-medium text-right font-medium text-on-surface">{team.name}</dd>
          </div>
          {verein && (
            <div className="flex items-center justify-between gap-3 border-t border-linie py-2">
              <dt className="type-body-medium text-on-surface-mittel">Verein</dt>
              <dd className="type-body-medium text-right font-medium text-on-surface">{verein.name}</dd>
            </div>
          )}
        </dl>
        <p className="type-body-small mt-1 text-on-surface-mittel">
          Umbenennen und Auflösen macht die Vereinsverwaltung im Bereich «Verein».
        </p>
      </Card>

      <Card className="p-5 sm:p-6">
        <SpielerListe
          teamId={team.id}
          teamName={team.name}
          vereinName={verein?.name ?? null}
          spieler={liste.wert.spieler}
          kader={kader.wert.kader}
          abholung={{
            url: abholung.ok && abholung.wert.token ? abholUrl(origin, abholung.wert.token) : null,
            aktiv: abholung.ok && abholung.wert.aktiv,
          }}
          probeAnzahl={probe.wert.anzahl}
        />
      </Card>

      <Card className="p-5 sm:p-6">
        <ProbeKarte teamId={team.id} probetraining={probe.wert} spieler={liste.wert.spieler} />
      </Card>

      <Card className="p-5 sm:p-6">
        <KaderKarte teamId={team.id} kader={kader.wert.kader} />
      </Card>

      <Card className="p-5 sm:p-6">
        <MitgliederListe
          teamId={team.id}
          mitglieder={team.mitglieder}
          eigeneUserId={user.id}
          vereinName={verein?.name ?? null}
        />
      </Card>

      <TeamGefahrenzone teamId={team.id} anzahlMitglieder={team.mitglieder.length} />
    </div>
  );
}
