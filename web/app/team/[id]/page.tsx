import { CalendarPlus } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { getTeamTrainings } from "@/lib/queries/trainings";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3; #329 PC 1).
   Geteilt wird hier in Kommendes und Vergangenes: Der Schnitt hängt am
   heutigen Tag am Trainingsort und lässt sich nur an einer Stelle bestimmen,
   wenn Server und Browser dieselbe Liste rendern sollen. */
export default async function TeamPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const heute = heuteAmTrainingsort();
  const [termine, trainings] = await Promise.all([getTeamPlan(id), getTeamTrainings(id)]);
  const plan = teilePlan(termine, heute);
  const leer = termine.length === 0;

  return (
    <TerminBereich teamId={id} trainings={trainings} heute={heute}>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-title-large text-on-surface">Trainingsplan</h2>
          <NeuerTerminKnopf />
        </div>
        {leer ? (
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
