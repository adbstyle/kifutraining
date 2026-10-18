import { CalendarOff, Clock, X } from "lucide-react";
import { IconButtonLink, KategorieLozenge, Lozenge, SectionMessage, TabNav } from "@/components/ui";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { TrainingTeile } from "@/components/training/TrainingTeile";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { tagOhneJahr } from "@/lib/monat";
import { zeitText } from "@/lib/termin";
import { formatDuration, gesamtDauer, leseGliederung } from "@/lib/training";
import { sichtbareZuordnungen, varianteAus } from "@/lib/varianten";
import { planHref, terminHref, type TerminReiter } from "@/lib/team-ansicht";
import { getTrainingView } from "@/lib/queries/trainings";
import { terminSpieler } from "@/lib/kern/abmeldungen";
import { createClient } from "@/lib/supabase/server";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { TerminEigenschaften } from "./TerminEigenschaften";
import { TerminKnoepfe, TrainingKnoepfe } from "./TerminSpalteKnoepfe";
import { SpielerReiter } from "./SpielerReiter";

/* Ein geöffneter Termin neben dem Trainingsplan (Epic #433, #435): drei
   Reiter — der Termin selbst, sein Training und wer kommt. Die Reiter sind
   Adressen (`?termin=…&tab=…`) wie jede Ansicht im Team; ein Wechsel bleibt an
   der Stelle (`scroll={false}`). Geladen wird nur, was der offene Reiter
   braucht. Der Reiter «Training» zeigt dieselbe Leseansicht wie die
   Trainingsseite (`TrainingTeile`), ohne Bearbeiten. */
export async function TerminSpalte({
  t,
  reiter,
  meine,
  ich,
  mitKadern = false,
}: {
  t: TerminZeile;
  reiter: TerminReiter;
  meine: boolean;
  ich: string;
  /** Das Team führt Kader (#453 AK 5). */
  mitKadern?: boolean;
}) {
  const reiterItems = [
    { label: "Termin", href: terminHref(t.teamId, meine, t.id, "termin"), current: reiter === "termin" },
    { label: "Training", href: terminHref(t.teamId, meine, t.id, "training"), current: reiter === "training" },
    { label: "Spieler:innen", href: terminHref(t.teamId, meine, t.id, "spieler"), current: reiter === "spieler" },
  ];
  return (
    <section aria-label={`Termin ${tagOhneJahr(t.datum)}`} className="flex flex-col">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="type-title-large text-on-surface">{tagOhneJahr(t.datum)}</h3>
          <p className="type-body-medium text-on-surface-mittel">
            {zeitText(t.beginn, t.ende)} Uhr{t.ort ? ` · ${t.ort}` : ""}
          </p>
        </div>
        <IconButtonLink href={planHref(t.teamId, meine)} scroll={false} icon={X} label="Termin schliessen" />
      </div>
      <TabNav items={reiterItems} ariaLabel="Bereiche des Termins" scroll={false} className="mt-2" />
      <div className="mt-4 flex flex-col gap-4">
        {reiter === "termin" && (
          <>
            <TerminKnoepfe t={t} />
            {t.ausgefallen && (
              <SectionMessage icon={CalendarOff}>
                Der Termin fällt aus{t.ausfallGrund ? `: ${t.ausfallGrund}` : "."}
              </SectionMessage>
            )}
            <div className="rounded-flaeche bg-elev-01 p-4">
              <h4 className="type-title-small text-on-surface">Eckdaten</h4>
              <TerminEigenschaften t={t} ich={ich} mitKadern={mitKadern} className="mt-3" />
            </div>
          </>
        )}
        {reiter === "training" && <TrainingReiter t={t} />}
        {reiter === "spieler" && <SpielerReiterLaden t={t} ich={ich} />}
      </div>
    </section>
  );
}

async function TrainingReiter({ t }: { t: TerminZeile }) {
  const training = t.training ? await getTrainingView(t.training.id) : null;
  if (!training)
    return (
      <>
        <TrainingKnoepfe t={t} />
        <p className="type-body-medium text-on-surface-mittel">
          {t.ausgefallen ? "Der Termin fällt aus und trägt kein Training." : "Dieser Termin trägt noch kein Training."}
        </p>
      </>
    );
  // Wie die Trainingsansicht zu Beginn: die erste Variante des Hauptteils.
  const aktive = varianteAus(undefined, training.varianten);
  const sichtbar = sichtbareZuordnungen(training.exercises, aktive?.id);
  const dauer = gesamtDauer(sichtbar);
  return (
    <>
      <TrainingKnoepfe t={t} />
      {t.ausgefallen && <SectionMessage icon={CalendarOff}>Der Termin fällt aus; das Training ruht an ihm.</SectionMessage>}
      <header>
        <h4 className="type-headline-small text-on-surface">{training.name}</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Lozenge>{altersstufeLabels[training.altersstufe]}</Lozenge>
          {training.stufen.map((k) => (
            <KategorieLozenge key={k} k={k} />
          ))}
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {dauer.erfasst ? formatDuration(dauer.summe) : "Keine Dauer erfasst"}
          </span>
        </div>
        {training.ziel && (
          <p className="mt-2 type-body-medium text-on-surface">
            <span className="type-label-small text-on-surface-mittel">Ziel: </span>
            {training.ziel}
          </p>
        )}
      </header>
      <TrainingTeile
        sections={leseGliederung(training.altersstufe, sichtbar)}
        aktive={aktive}
        varianten={training.varianten}
        zeile={(item, dur) => (
          <li key={item.id} className="flex items-center gap-3 px-2 py-2">
            <ExerciseThumb bildUrl={item.bildUrl} diagramm={item.diagramm} bildQuelle={item.bildQuelle} name={item.name} />
            <span className="min-w-0 flex-1 self-start type-title-small text-on-surface">{item.name}</span>
            {dur && <span className="shrink-0 type-label-medium text-on-surface-mittel">{dur}</span>}
          </li>
        )}
      />
    </>
  );
}

async function SpielerReiterLaden({ t, ich }: { t: TerminZeile; ich: string }) {
  const r = await terminSpieler(await createClient(), ich, { terminId: t.id });
  if (!r.ok) return <SectionMessage appearance="error">{r.meldung}</SectionMessage>;
  return <SpielerReiter teamId={t.teamId} daten={r.wert} />;
}
