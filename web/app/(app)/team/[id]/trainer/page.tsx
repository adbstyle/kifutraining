import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { MitgliederListe } from "@/components/team/MitgliederListe";
import { TeamGefahrenzone } from "@/components/team/TeamGefahrenzone";
import { getTeam } from "@/lib/queries/teams";
import { getMeinVerein } from "@/lib/queries/verein";
import { getUserImRequest } from "@/lib/supabase/server";

/* Die Seite «Team» (#704 AK 4): was das Team selbst betrifft, auf einer Seite
 * ohne Reiter — wer im Team ist (Mitglieder), wie das Team heisst und zu
 * welchem Verein es gehört, und wie man wieder herauskommt, in der
 * Gefahrenzone am Ende (Story 17, #581). Die Adresse `/trainer` stammt vom
 * früheren Reiter «Trainer:innen» (#656); die Sichten auf die Spieler:innen
 * stehen unter «Spieler:innen» (spieler/).
 *
 * Den Namen zeigt der Bereich nur an: Umbenennen und Auflösen macht die
 * Vereinsverwaltung im Bereich «Verein» (#581 AK 27) — auch dann, wenn die
 * Person zugleich Mitglied des Teams ist; am Team-Ort gibt es für sie keine
 * Verwaltungsaktion. */
export default async function TeamSeitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Gebraucht wird die eigene Kennung, damit sich niemand selbst aus der
  // Liste entfernt; den Zugriff hat der Rahmen geprüft.
  const user = await getUserImRequest();
  if (!user) redirect("/login");

  // `getTeam` antwortet aus dem Request-Cache des Rahmens.
  const [team, verein] = await Promise.all([getTeam(id), getMeinVerein()]);
  if (!team) redirect("/teams");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="type-title-large text-on-surface">Team</h2>
      <Card className="p-5 sm:p-6">
        <MitgliederListe
          teamId={team.id}
          mitglieder={team.mitglieder}
          eigeneUserId={user.id}
          vereinName={verein?.name ?? null}
        />
      </Card>

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

      <TeamGefahrenzone teamId={team.id} anzahlMitglieder={team.mitglieder.length} />
    </div>
  );
}
