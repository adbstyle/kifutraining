import { TeamTrainingsListe } from "@/components/team/TeamTrainingsListe";
import { TeamTrainingErstellenButton } from "@/components/team/TeamTrainingErstellenButton";
import { getTeamTrainings } from "@/lib/queries/trainings";


/* Der Trainingsbestand eines Teams (Story 17).
 *
 * Hier liegt das Material, aus dem geplant wird; angesetzt wird von hier aus,
 * das Ergebnis erscheint im Trainingsplan. */
export default async function TeamTrainingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainings = await getTeamTrainings(id);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="type-title-large text-on-surface">
          Trainings
          <span className="type-label-small ml-2 text-on-surface-variant">
            {trainings.length}
          </span>
        </h2>
        <TeamTrainingErstellenButton teamId={id} />
      </div>
      {trainings.length === 0 ? (
        <p className="rounded-[6px] border border-outline-variant bg-surface-container-low px-5 py-8 text-center type-body-medium text-on-surface-variant">
          Noch kein Training im Team. Erstelle eines hier oder stelle eine Kopie
          eines eigenen Trainings ins Team.
        </p>
      ) : (
        <TeamTrainingsListe teamId={id} trainings={trainings} />
      )}
    </section>
  );
}
