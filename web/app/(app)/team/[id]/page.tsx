import { redirect } from "next/navigation";
import { CalendarPlus, UserCheck } from "lucide-react";
import { SectionMessage, Leerzustand } from "@/components/ui";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { PlanMenue } from "@/components/team/PlanMenue";
import { NurMeineFilter } from "@/components/team/NurMeineFilter";
import { istUuid } from "@/lib/kennung";
import { getTeam } from "@/lib/queries/teams";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { istVerantwortlich } from "@/lib/queries/termine-fuer";
import { getTeamTrainings, getTrainingPool } from "@/lib/queries/trainings";
import { planHref } from "@/lib/team-ansicht";
import { createClient } from "@/lib/supabase/server";
import { heuteAmTrainingsort } from "@/lib/zeit";

/** #330 PC 8: der Verweis zeigt auf einen Termin, den es nicht mehr gibt. */
const TERMIN_WEG = "Diesen Termin gibt es nicht mehr.";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3) und seine
   einzige: die Liste, ab `lg` mit dem Monat daneben (Epic #401). Geteilt wird
   hier in Kommendes und Vergangenes: Der Schnitt hängt am heutigen Tag am
   Trainingsort und lässt sich nur an einer Stelle bestimmen, wenn Server und
   Browser dieselbe Liste rendern sollen.

   `?meine=1` grenzt auf die Termine ein, für die der USER verantwortlich ist
   (#325 AK 11) — anstehende wie vergangene. Die Basis-Adresse des Teams trägt
   sie nicht.

   Adressen des früheren Monatsüberblicks (`?ansicht=monat&monat=…`) öffnen
   den Trainingsplan wie jede andere; Ansicht und Monat bleiben ohne Wirkung,
   die Eingrenzung gilt (#405 PC 2, 3).

   `?termin=<id>` und `?hinweis=termin_weg` setzt allein der Verweis aus dem
   Kalender-Abo (#330 PC 7, 8) — die Seite /team/[id]/termin/[terminId] leitet
   hierher. Sie gehören nicht zur Ansicht: Der Filter trägt sie nicht weiter.
   `termin` hebt den Termin hervor und klappt dafür den Rückblick auf. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meine?: string; termin?: string; hinweis?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const meine = sp.meine === "1";
  // Nur eine Kennung ist ein Ziel; alles andere bleibt ohne Wirkung.
  const hervorheben = istUuid(sp.termin) ? sp.termin : undefined;
  const terminWeg = sp.hinweis === "termin_weg";
  const heute = heuteAmTrainingsort();

  // Den Zugriff hat der Rahmen geprüft; gebraucht wird die eigene Kennung für
  // die Eingrenzung, das Team (aus dem Request-Cache) für die Mitglieder.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [alleTermine, trainings, persoenliche, team] = await Promise.all([
    getTeamPlan(id),
    getTeamTrainings(id),
    // Die eigenen Trainings, Entwürfe und öffentliche: zuordenbar als Kopie (#328).
    getTrainingPool({ mine: true }),
    getTeam(id),
  ]);
  // Eingegrenzt wird hier statt in der Abfrage: Der Monat braucht auch die
  // Tage, an denen nur Termine anderer liegen (#404 AK 14).
  const termine = meine ? alleTermine.filter((t) => istVerantwortlich(t, user.id)) : alleTermine;
  const eigeneTage = new Set(termine.map((t) => t.datum));
  const belegt = meine ? [...new Set(alleTermine.map((t) => t.datum))].filter((d) => !eigeneTage.has(d)) : [];
  const plan = teilePlan(termine, heute);
  const leer = termine.length === 0;

  return (
    <TerminBereich teamId={id} trainings={trainings} persoenliche={persoenliche} mitglieder={team?.mitglieder ?? []} heute={heute}>
      <section>
        {/* Keine sichtbare Überschrift: «Trainingsplan» steht schon im
            Reiter; für Screenreader bleibt sie, damit unter dem Teamnamen
            keine Ebene fehlt. Links die Eingrenzung; rechts, was man dem Plan
            hinzufügt. */}
        <h2 className="sr-only">Trainingsplan</h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(meine || !leer) && <NurMeineFilter aktiv={meine} href={planHref(id, !meine)} />}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NeuerTerminKnopf />
            {team && <PlanMenue teamId={id} teamName={team.name} />}
          </div>
        </div>
        {terminWeg && <SectionMessage className="mb-4">{TERMIN_WEG}</SectionMessage>}
        <TrainingsPlan
          plan={plan}
          heute={heute}
          ich={user.id}
          hervorheben={hervorheben}
          belegt={belegt}
          meine={meine}
          leer={
            meine ? (
              <Leerzustand icon={UserCheck} titel="Keine Termine für dich" dicht>
                Du bist für keinen Termin verantwortlich. Eintragen kannst du dich, wenn du einen Termin
                änderst.
              </Leerzustand>
            ) : (
              <Leerzustand icon={CalendarPlus} titel="Noch keine Termine" dicht>
                Lege die Trainingszeiten des Teams als Termine fest. Welches Training dort stattfindet,
                ordnest du danach zu.
              </Leerzustand>
            )
          }
        />
      </section>
    </TerminBereich>
  );
}
