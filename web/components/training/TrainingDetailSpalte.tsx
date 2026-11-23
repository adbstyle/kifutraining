import { DetailKopf, TabNav } from "@/components/ui";
import { KontoGrenzenLage } from "@/components/konto/BestandStufe";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { TrainingAktionen } from "@/components/training/TrainingAktionen";
import { TrainingKopfAngaben } from "@/components/training/TrainingKopfAngaben";
import { TrainingEigenschaften } from "@/components/training/TrainingEigenschaften";
import { TrainingTeile } from "@/components/training/TrainingTeile";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { angezeigteVariante, type TrainingAnsicht } from "@/lib/queries/training-ansicht";
import type { DetailAnsicht } from "@/lib/training-auswahl";
import { varianteAus } from "@/lib/varianten";

/* Das ausgewählte Training neben der Trainingsübersicht (#630, Design A2).
   Lesend (Out of Scope 1): kein Bearbeiten an Ort, keine Übung zum Öffnen —
   darum die schlichten Zeilen wie im Reiter «Training» eines Termins.

   Zwei Reiter, «Übungen» und «Eigenschaften» (AK 4, 5): Die Spalte ist zu
   schmal für beides nebeneinander, untereinander stünden die Eigenschaften
   unter einer langen Übungsliste. Die Reiter haben eine Adresse
   (`&ansicht=eigenschaften`), Neuladen und geteilte Links zeigen dasselbe
   (PC 1). Die Rechte des USERs kommen aus `ladeTrainingAnsicht` wie auf der
   Ansichtsseite. */
export function TrainingDetailSpalte({
  ansicht,
  varianteParam,
  offen,
  hrefFuer,
  schliessenHref,
}: {
  ansicht: TrainingAnsicht;
  varianteParam: string | undefined;
  offen: DetailAnsicht;
  /** Dieselbe Übersicht mit diesem Training in einer Variante und Ansicht. */
  hrefFuer: (wahl: { variante?: string; ansicht: DetailAnsicht }) => string;
  /** Die Übersicht ohne Auswahl: Ziel des X und nach dem Löschen. */
  schliessenHref: string;
}) {
  const { training, bearbeitungsziel, teams, mitGrenzen, fehlendeBedingungen } = ansicht;
  // Zu Beginn die vorderste Variante (AK 6); eine unbekannte Angabe ebenso.
  const aktive = varianteAus(varianteParam, training.varianten);
  const { sichtbar, sections, dauerText } = angezeigteVariante(training, aktive);
  // Die Variante steht nur in der Adresse, wenn es etwas zu wählen gibt.
  const variante = training.varianten.length > 1 ? aktive?.id : undefined;

  return (
    <KontoGrenzenLage mitGrenzen={mitGrenzen}>
      <section aria-label={`Training ${training.name}`} className="flex flex-col">
        <DetailKopf
          titel={training.name}
          schliessenHref={schliessenHref}
          aktionen={
            <TrainingAktionen
              ort="uebersicht"
              trainingId={training.id}
              name={training.name}
              visibility={training.visibility}
              teamId={training.team?.id ?? null}
              terminDatum={training.terminDatum}
              terminTraining={training.terminTraining}
              bearbeitungsziel={bearbeitungsziel}
              teams={teams}
              fehlendeBedingungen={fehlendeBedingungen}
              varianten={training.varianten}
              aktiveVarianteId={aktive?.id}
              nachLoeschen={schliessenHref}
            />
          }
        />
        {/* Am fremden Training, von wem es stammt — wie auf der Ansichtsseite;
            anonymisiert entfällt die Zeile (Story 15). */}
        {!bearbeitungsziel && training.urheber && (
          <p className="type-body-medium text-on-surface-mittel">von {training.urheber}</p>
        )}

        <TabNav
          items={[
            { label: "Übungen", href: hrefFuer({ variante, ansicht: "uebungen" }), current: offen === "uebungen" },
            {
              label: "Eigenschaften",
              href: hrefFuer({ variante, ansicht: "eigenschaften" }),
              current: offen === "eigenschaften",
            },
          ]}
          ariaLabel="Bereiche des Trainings"
          scroll={false}
          className="mt-2"
        />

        <div className="mt-4 flex flex-col gap-4">
          {offen === "eigenschaften" ? (
            // Ohne Bearbeitungszeilen und ohne Arbeitshinweise: lesend (OoS 1).
            <TrainingEigenschaften
              training={training}
              sichtbar={sichtbar}
              stufen={training.stufen}
              ziel={training.ziel}
            />
          ) : (
            <>
              <TrainingKopfAngaben
                altersstufe={training.altersstufe}
                stufen={training.stufen}
                dauerText={dauerText}
                ziel={training.ziel}
              />

              <VariantenLinks
                scroll={false}
                varianten={training.varianten}
                aktiv={aktive?.id}
                hrefFuer={(v) => hrefFuer({ variante: v, ansicht: "uebungen" })}
              />

              <TrainingTeile
                sections={sections}
                aktive={aktive}
                varianten={training.varianten}
                zeile={(item, dur) => (
                  // Keine Links in die Übung (OoS 1).
                  <li key={item.id} className="flex items-center gap-3 px-2 py-2">
                    <ExerciseThumb
                      bildUrl={item.bildUrl}
                      diagramm={item.diagramm}
                      bildQuelle={item.bildQuelle}
                      name={item.name}
                    />
                    <span className="min-w-0 flex-1 self-start type-title-small text-on-surface">{item.name}</span>
                    {dur && <span className="shrink-0 type-label-medium text-on-surface-mittel">{dur}</span>}
                  </li>
                )}
              />
            </>
          )}
        </div>
      </section>
    </KontoGrenzenLage>
  );
}
