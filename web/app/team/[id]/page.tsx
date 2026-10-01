import { redirect } from "next/navigation";
import { CalendarPlus, UserCheck } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { AnsichtWahl } from "@/components/team/AnsichtWahl";
import { MonatsUeberblick } from "@/components/team/MonatsUeberblick";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { NurMeineFilter } from "@/components/team/NurMeineFilter";
import { getTeam } from "@/lib/queries/teams";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { getTeamTrainings, getTrainingPool } from "@/lib/queries/trainings";
import { istMonat, monatVon } from "@/lib/monat";
import { planHref } from "@/lib/team-ansicht";
import { createClient } from "@/lib/supabase/server";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3; #329 PC 1).
   Er zeigt die Liste, oder mit `?ansicht=monat` den Monatsüberblick (#329);
   `?monat=YYYY-MM` wählt den Monat, ohne ihn gilt der heutige. Beide Ansichten
   zeigen dieselben Termine (PC 3). Geteilt wird hier in Kommendes und
   Vergangenes: Der Schnitt hängt am heutigen Tag am Trainingsort und lässt
   sich nur an einer Stelle bestimmen, wenn Server und Browser dieselbe Liste
   rendern sollen.

   `?meine=1` grenzt auf die Termine ein, für die der USER verantwortlich ist
   (#325 AK 11) — anstehende wie vergangene. Sie reist in der Adresse mit,
   auch beim Wechsel der Ansicht und des Monats (#329 PC 4); die Basis-Adresse
   des Teams trägt sie nicht. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meine?: string; ansicht?: string; monat?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const meine = sp.meine === "1";
  const heute = heuteAmTrainingsort();
  // PC 1: Die Liste bleibt der Start. PC 2: Der aktuelle Monat nach dem Schweizer Kalendertag.
  const ansicht = sp.ansicht === "monat" ? "monat" : "liste";
  const monat = sp.monat && istMonat(sp.monat) ? sp.monat : monatVon(heute);
  const href = (o: { ansicht: "liste" | "monat"; meine: boolean }) => planHref(id, { ...o, monat }, heute);

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
    <TerminBereich teamId={id} trainings={trainings} persoenliche={persoenliche} mitglieder={team?.mitglieder ?? []} heute={heute} termine={termine}>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-title-large text-on-surface">Trainingsplan</h2>
          <NeuerTerminKnopf />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AnsichtWahl
            ansicht={ansicht}
            hrefListe={href({ ansicht: "liste", meine })}
            hrefMonat={href({ ansicht: "monat", meine })}
          />
          {(meine || !leer) && <NurMeineFilter aktiv={meine} href={href({ ansicht, meine: !meine })} />}
        </div>
        {ansicht === "monat" ? (
          <MonatsUeberblick teamId={id} monat={monat} termine={termine} heute={heute} meine={meine} />
        ) : leer && meine ? (
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
