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
      {/* Keine sichtbare Überschrift: «Trainings» steht schon im Reiter;
          für Screenreader bleibt sie, damit unter dem Teamnamen keine Ebene
          fehlt. */}
      <h2 className="sr-only">Trainings</h2>
      {/* Ohne Trainings sagt es der Leerzustand; die Anzahl entfällt dann. */}
      <div className="mb-4 flex items-center justify-end gap-3">
        {trainings.length > 0 && (
          <p className="mr-auto type-body-medium text-on-surface-mittel">
            {trainings.length === 1 ? "1 Training" : `${trainings.length} Trainings`}
          </p>
        )}
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
