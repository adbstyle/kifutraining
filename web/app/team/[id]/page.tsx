import { Flash } from "@/components/Flash";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { getTeamPlan } from "@/lib/queries/termine";

/* Der Trainingsplan eines Teams — die Einstiegsansicht (Story 17 AK 3).
 *
 * Sie liegt bewusst auf der Basis-Adresse des Teams: Wer ein Team öffnet, will
 * zuerst wissen, was als Nächstes ansteht, und alle bestehenden Verweise auf
 * den Team-Bereich landen ohne Umleitung am richtigen Ort.
 *
 * `angesetzt` bestätigt eine Einheit, die in der Trainings-Ansicht entstanden
 * ist: Die Meldung muss den Ansichtswechsel überleben und reist deshalb über
 * die Adresse — dasselbe Muster wie nach dem Löschen eines Trainings. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ angesetzt?: string }>;
}) {
  const { id } = await params;
  const { angesetzt } = await searchParams;
  const plan = await getTeamPlan(id);

  return (
    <section>
      {angesetzt && <Flash message="Einheit angesetzt." />}
      <h2 className="mb-4 type-title-large text-on-surface">
        Trainingsplan
        <span className="type-label-small ml-2 text-on-surface-variant">
          {plan.length}
        </span>
      </h2>
      {plan.length === 0 ? (
        <p className="rounded-[6px] border border-outline-variant bg-surface-container-low px-5 py-8 text-center type-body-medium text-on-surface-variant">
          Noch nichts angesetzt. Setze unter „Trainings“ ein Training des Teams
          auf ein Datum an — es erscheint dann hier chronologisch im Plan.
        </p>
      ) : (
        <TrainingsPlan termine={plan} />
      )}
    </section>
  );
}
