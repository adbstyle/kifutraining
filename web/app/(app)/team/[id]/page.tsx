import { redirect } from "next/navigation";
import { CalendarPlus, UserCheck } from "lucide-react";
import { Banner, Leerzustand } from "@/components/ui";
import { AnsichtWahl } from "@/components/team/AnsichtWahl";
import { MonatsUeberblick } from "@/components/team/MonatsUeberblick";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { PlanMenue } from "@/components/team/PlanMenue";
import { NurMeineFilter } from "@/components/team/NurMeineFilter";
import { istUuid } from "@/lib/kennung";
import { getTeam } from "@/lib/queries/teams";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { getTeamTrainings, getTrainingPool } from "@/lib/queries/trainings";
import { istMonat, monatVon } from "@/lib/monat";
import { planHref, type Ansicht } from "@/lib/team-ansicht";
import { createClient } from "@/lib/supabase/server";
import { heuteAmTrainingsort } from "@/lib/zeit";

/** #330 PC 8: der Verweis zeigt auf einen Termin, den es nicht mehr gibt. */
const TERMIN_WEG = "Diesen Termin gibt es nicht mehr.";

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
   des Teams trägt sie nicht.

   `?termin=<id>` und `?hinweis=termin_weg` setzt allein der Verweis aus dem
   Kalender-Abo (#330 PC 7, 8) — die Seite /team/[id]/termin/[terminId] leitet
   hierher. Sie gehören nicht zur Ansicht: weder `href` noch der Umschalter
   tragen sie weiter. `termin` hebt den Termin in der Liste hervor und
   klappt dafür den Rückblick auf. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meine?: string; ansicht?: string; monat?: string; termin?: string; hinweis?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const meine = sp.meine === "1";
  // Nur eine Kennung ist ein Ziel; alles andere bleibt ohne Wirkung.
  const hervorheben = istUuid(sp.termin) ? sp.termin : undefined;
  const terminWeg = sp.hinweis === "termin_weg";
  const heute = heuteAmTrainingsort();
  // PC 1: Die Liste bleibt der Start. PC 2: Der aktuelle Monat nach dem Schweizer Kalendertag.
  const ansicht: Ansicht = sp.ansicht === "monat" ? "monat" : "liste";
  const monat = sp.monat && istMonat(sp.monat) ? sp.monat : monatVon(heute);
  const href = (o: { ansicht: Ansicht; meine: boolean }) => planHref(id, { ...o, monat }, heute);

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
        {/* Keine sichtbare Überschrift: «Trainingsplan» steht schon im
            Reiter; für Screenreader bleibt sie, damit unter dem Teamnamen
            keine Ebene fehlt. Links, wie man den Plan sieht; rechts, was man
            ihm hinzufügt. */}
        <h2 className="sr-only">Trainingsplan</h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AnsichtWahl
              ansicht={ansicht}
              hrefListe={href({ ansicht: "liste", meine })}
              hrefMonat={href({ ansicht: "monat", meine })}
            />
            {(meine || !leer) && <NurMeineFilter aktiv={meine} href={href({ ansicht, meine: !meine })} />}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NeuerTerminKnopf />
            {team && <PlanMenue teamId={id} teamName={team.name} />}
          </div>
        </div>
        {terminWeg && <Banner tone="hinweis" className="mb-4">{TERMIN_WEG}</Banner>}
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
          <TrainingsPlan plan={plan} heute={heute} hervorheben={hervorheben} />
        )}
      </section>
    </TerminBereich>
  );
}
