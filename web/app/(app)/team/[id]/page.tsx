import { redirect } from "next/navigation";
import { CalendarPlus, UserCheck } from "lucide-react";
import { SectionMessage, Leerzustand } from "@/components/ui";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { PlanMenue } from "@/components/team/PlanMenue";
import { EingrenzungFilter } from "@/components/team/EingrenzungFilter";
import { istUuid } from "@/lib/kennung";
import { getTeam } from "@/lib/queries/teams";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { imFilter } from "@/lib/trainer";
import { getTeamTrainings, getTrainingPool } from "@/lib/queries/trainings";
import { TERMIN_REITER, eingrenzungAus, type TerminReiter } from "@/lib/team-ansicht";
import { TerminSpalte } from "@/components/team/TerminSpalte";
import { createClient } from "@/lib/supabase/server";
import { anzahlSpieler } from "@/lib/kern/spieler";
import { ladeKader } from "@/lib/kern/kader";
import { heuteAmTrainingsort, jetztAmTrainingsort } from "@/lib/zeit";

/** #330 PC 8: der Verweis zeigt auf einen Termin, den es nicht mehr gibt. */
const TERMIN_WEG = "Diesen Termin gibt es nicht mehr.";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3) und seine
   einzige: die Liste, ab `lg` mit dem Monat daneben (Epic #401). Geteilt wird
   hier in Kommendes und Vergangenes: Der Schnitt hängt am heutigen Tag am
   Trainingsort und lässt sich nur an einer Stelle bestimmen, wenn Server und
   Browser dieselbe Liste rendern sollen.

   `?meine=1` grenzt auf die Termine ein, an denen der USER dabei ist,
   `?eingeladen=1` auf die, zu denen er eingeladen ist (#518 PO 12) —
   anstehende wie vergangene. Die Basis-Adresse des Teams trägt sie nicht.

   Adressen des früheren Monatsüberblicks (`?ansicht=monat&monat=…`) öffnen
   den Trainingsplan wie jede andere; Ansicht und Monat bleiben ohne Wirkung,
   die Eingrenzung gilt (#405 PC 2, 3).

   `?termin=<id>` öffnet den Termin daneben (#435), im Reiter aus `?tab=`
   (Termin, Training, Spieler:innen), hebt ihn in der Liste hervor und klappt
   dafür den Rückblick auf. Auch der Verweis aus dem Kalender-Abo zielt so auf
   einen Termin (#330 PC 7, 8) — die Seite /team/[id]/termin/[terminId] leitet
   hierher; `?hinweis=termin_weg`, wenn es ihn nicht mehr gibt. Beides gehört
   nicht zur Ansicht: Der Filter trägt es nicht weiter. */
export default async function TeamPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meine?: string; eingeladen?: string; termin?: string; tab?: string; hinweis?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const eingrenzung = eingrenzungAus(sp);
  // Nur eine Kennung ist ein Ziel; alles andere bleibt ohne Wirkung.
  const hervorheben = istUuid(sp.termin) ? sp.termin : undefined;
  const terminWeg = sp.hinweis === "termin_weg";
  const heute = heuteAmTrainingsort();
  // Der Stand beim Laden: Wechsel an Meldefrist und Anpfiff zeigt erst das
  // nächste Laden (Epic #490, Out of Scope 6).
  const jetzt = jetztAmTrainingsort();

  // Den Zugriff hat der Rahmen geprüft; gebraucht wird die eigene Kennung für
  // die Eingrenzung, das Team (aus dem Request-Cache) für die Mitglieder.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [alleTermine, trainings, persoenliche, team, spielerGesamt, kader] = await Promise.all([
    getTeamPlan(id),
    getTeamTrainings(id),
    // Die eigenen Trainings, Entwürfe und öffentliche: zuordenbar als Kopie (#328).
    getTrainingPool({ mine: true }),
    getTeam(id),
    // #434: Führt das Team eine Spielerliste, entfällt die erwartete Zahl.
    anzahlSpieler(supabase, id),
    // #453: Für welche Kader ein Termin gilt, wählt man im Termin-Dialog.
    ladeKader(supabase, user.id, { teamId: id }),
  ]);
  const fuehrtListe = spielerGesamt > 0;
  const teamKader = kader.ok ? kader.wert.kader : [];
  // Eingegrenzt wird hier statt in der Abfrage: Der Monat braucht auch die
  // Tage, an denen nur Termine anderer liegen (#404 AK 14).
  const termine = eingrenzung ? alleTermine.filter((t) => imFilter(t.trainer, user.id, eingrenzung)) : alleTermine;
  const eigeneTage = new Set(termine.map((t) => t.datum));
  const belegt = eingrenzung ? [...new Set(alleTermine.map((t) => t.datum))].filter((d) => !eigeneTage.has(d)) : [];
  const plan = teilePlan(termine, heute);
  const leer = termine.length === 0;
  // #435: Der Termin aus `?termin=` steht offen daneben, im Reiter aus `?tab=`.
  const offen = hervorheben ? alleTermine.find((t) => t.id === hervorheben) : undefined;
  const reiter: TerminReiter = TERMIN_REITER.includes(sp.tab as TerminReiter) ? (sp.tab as TerminReiter) : "termin";

  return (
    <TerminBereich
      teamId={id}
      trainings={trainings}
      persoenliche={persoenliche}
      mitglieder={team?.mitglieder ?? []}
      ich={user.id}
      heute={heute}
      fuehrtListe={fuehrtListe}
      kader={teamKader}
      spielerGesamt={spielerGesamt}
    >
      <section>
        {/* Keine sichtbare Überschrift: «Trainingsplan» steht schon im
            Reiter; für Screenreader bleibt sie, damit unter dem Teamnamen
            keine Ebene fehlt. Links die Eingrenzung; rechts, was man dem Plan
            hinzufügt. */}
        <h2 className="sr-only">Trainingsplan</h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(eingrenzung || !leer) && <EingrenzungFilter teamId={id} aktiv={eingrenzung} />}
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
          jetzt={jetzt}
          ich={user.id}
          hervorheben={hervorheben}
          belegt={belegt}
          eingrenzung={eingrenzung}
          spalte={
            offen && (
              <TerminSpalte
                t={offen}
                reiter={reiter}
                eingrenzung={eingrenzung}
                ich={user.id}
                mitglieder={team?.mitglieder ?? []}
                mitKadern={teamKader.length > 0}
              />
            )
          }
          leer={
            eingrenzung ? (
              <Leerzustand icon={UserCheck} titel="Keine Termine für dich" dicht>
                {eingrenzung === "dabei" ? "Du bist bei keinem Termin dabei." : "Du bist zu keinem Termin eingeladen."}{" "}
                Einladen kannst du dich an jedem Termin unter «Trainer:innen».
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
