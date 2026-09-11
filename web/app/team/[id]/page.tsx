import { Flash } from "@/components/Flash";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Der Trainingsplan eines Teams — die Einstiegsansicht (Story 17 AK 3).
 *
 * Sie liegt bewusst auf der Basis-Adresse des Teams: Wer ein Team öffnet, will
 * zuerst wissen, was als Nächstes ansteht, und alle bestehenden Verweise auf
 * den Team-Bereich landen ohne Umleitung am richtigen Ort.
 *
 * Der Plan wird hier in Kommendes und Vergangenes geteilt (Story 18) und nicht
 * erst in der Ansicht: Der Schnitt hängt am heutigen Tag am Trainingsort, und
 * der lässt sich nur an einer Stelle bestimmen, wenn Server und Browser
 * dieselbe Liste rendern sollen.
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
  const plan = teilePlan(await getTeamPlan(id), heuteAmTrainingsort());
  const leer = plan.kommend.length === 0 && plan.vergangen.length === 0;

  return (
    <section>
      {angesetzt && <Flash message="Einheit angesetzt." />}
      <h2 className="mb-4 type-title-large text-on-surface">Trainingsplan</h2>
      {leer ? (
        <p className="kontur rounded-flaeche border-dashed border-kante bg-transparent px-5 py-8 text-center type-body-medium text-on-surface-mittel">
          Noch nichts angesetzt. Setze unter „Trainings“ ein Training des Teams
          auf ein Datum an — es erscheint dann hier im Plan.
        </p>
      ) : (
        <TrainingsPlan plan={plan} />
      )}
    </section>
  );
}
