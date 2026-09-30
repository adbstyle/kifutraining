import { Leerzustand } from "@/components/ui";
import { TeamTrainingsListe } from "@/components/team/TeamTrainingsListe";
import { TeamTrainingErstellenButton } from "@/components/team/TeamTrainingErstellenButton";
import { getTeamTrainings } from "@/lib/queries/trainings";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { heuteAmTrainingsort } from "@/lib/zeit";


/* Der Trainingsbestand eines Teams (Story 17).
 *
 * Hier liegt das Material, aus dem geplant wird; einem Termin zugeordnet wird
 * von hier aus, das Ergebnis erscheint im Trainingsplan. */
export default async function TeamTrainingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const heute = heuteAmTrainingsort();
  const [trainings, termine] = await Promise.all([getTeamTrainings(id), getTeamPlan(id)]);
  const plan = teilePlan(termine, heute);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="type-title-large text-on-surface">
          Trainings
          <span className="type-label-small ml-2 text-on-surface-mittel">
            {trainings.length}
          </span>
        </h2>
        <TeamTrainingErstellenButton teamId={id} />
      </div>
      {trainings.length === 0 ? (
        <Leerzustand titel="Noch kein Training im Team" dicht>
          Erstelle eines hier oder stelle eine Kopie eines eigenen Trainings ins
          Team.
        </Leerzustand>
      ) : (
        <TeamTrainingsListe
          trainings={trainings}
          termine={[...plan.kommend, ...plan.vergangen]}
          heute={heute}
        />
      )}
    </section>
  );
}
