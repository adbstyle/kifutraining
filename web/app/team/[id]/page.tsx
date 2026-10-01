import { redirect } from "next/navigation";
import { CalendarPlus, UserCheck } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { NurMeineFilter } from "@/components/team/NurMeineFilter";
import { getTeam } from "@/lib/queries/teams";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { getTeamTrainings, getTrainingPool } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3; #329 PC 1).
   Geteilt wird hier in Kommendes und Vergangenes: Der Schnitt hängt am
   heutigen Tag am Trainingsort und lässt sich nur an einer Stelle bestimmen,
   wenn Server und Browser dieselbe Liste rendern sollen.

   `?meine=1` grenzt auf die Termine ein, für die der USER verantwortlich ist
   (#325 AK 11) — anstehende wie vergangene. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meine?: string }>;
}) {
  const { id } = await params;
  const meine = (await searchParams).meine === "1";
  const heute = heuteAmTrainingsort();

  // Den Zugriff hat der Rahmen geprüft; gebraucht wird die eigene Kennung für
  // die Eingrenzung, das Team (aus dem Request-Cache) für die Mitglieder.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [termine, trainings, persoenliche, team] = await Promise.all([
    getTeamPlan(id, { nurMeine: meine ? user.id : undefined }),
    getTeamTrainings(id),
    // Die eigenen Trainings, Entwürfe und öffentliche: zuordenbar als Kopie (#328).
    getTrainingPool({ mine: true }),
    getTeam(id),
  ]);
  const plan = teilePlan(termine, heute);
  const leer = termine.length === 0;

  return (
    <TerminBereich teamId={id} trainings={trainings} persoenliche={persoenliche} mitglieder={team?.mitglieder ?? []} heute={heute}>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-title-large text-on-surface">Trainingsplan</h2>
          <NeuerTerminKnopf />
        </div>
        {(meine || !leer) && (
          <div className="mb-4 flex flex-wrap gap-2">
            <NurMeineFilter aktiv={meine} href={meine ? `/team/${id}` : `/team/${id}?meine=1`} />
          </div>
        )}
        {leer && meine ? (
          <Leerzustand icon={UserCheck} titel="Keine Termine für dich" dicht>
            Du bist für keinen Termin verantwortlich. Eintragen kannst du dich, wenn du einen Termin
            änderst.
          </Leerzustand>
        ) : leer ? (
          <Leerzustand icon={CalendarPlus} titel="Noch keine Termine" dicht>
            Lege die Trainingszeiten des Teams als Termine fest. Welches Training dort stattfindet,
            ordnest du danach zu.
          </Leerzustand>
        ) : (
          <TrainingsPlan plan={plan} heute={heute} />
        )}
      </section>
    </TerminBereich>
  );
}
