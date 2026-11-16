import { Clock } from "lucide-react";
import { DetailKopf, KategorieLozenge, Lozenge, TabNav } from "@/components/ui";
import { KontoGrenzenLage } from "@/components/konto/BestandStufe";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { TrainingAktionen } from "@/components/training/TrainingAktionen";
import { TrainingEigenschaften } from "@/components/training/TrainingEigenschaften";
import { TrainingTeile } from "@/components/training/TrainingTeile";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { angezeigteVariante, type TrainingAnsicht } from "@/lib/queries/training-ansicht";
import type { DetailAnsicht } from "@/lib/training-auswahl";
import { varianteAus } from "@/lib/varianten";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";

/* Das ausgewählte Training neben der Trainingsübersicht (#630, Design A2).
   Lesend (Out of Scope 1): kein Bearbeiten an Ort, keine Übung zum Öffnen —
   darum die schlichten Zeilen wie im Reiter «Training» eines Termins, nicht
   die Bausteine der Ansichtsseite (`AnsichtFlaeche`).

   Zwei Reiter, «Übungen» und «Eigenschaften» (AK 4, 5): Die Spalte ist zu
   schmal für Übungen und Eigenschaften nebeneinander, wie sie die
   Ansichtsseite breit zeigt, und untereinander stünden die Eigenschaften
   unter einer langen Übungsliste, wo man sie nicht sucht. Als Reiter mit
   Adresse (`&ansicht=eigenschaften`) zeigt Neuladen und ein geteilter Link
   dieselben Angaben (PC 1), wie die Reiter eines Termins im Team.

   Was der USER mit dem Training tun darf, kommt aus derselben
   Zusammenstellung wie auf der Ansichtsseite (`ladeTrainingAnsicht`) und
   steht im Kopf (`DetailKopf`, AK 7, 8). */
export function TrainingDetailSpalte({
  ansicht,
  varianteParam,
  offen,
  hrefFuer,
  schliessenHref,
  nachLoeschen,
}: {
  ansicht: TrainingAnsicht;
  varianteParam: string | undefined;
  offen: DetailAnsicht;
  /** Dieselbe Übersicht mit diesem Training in einer Variante und Ansicht. */
  hrefFuer: (wahl: { variante?: string; ansicht: DetailAnsicht }) => string;
  schliessenHref: string;
  nachLoeschen: string;
}) {
  const { training, angemeldet, bearbeitungsziel, teams, mitGrenzen, fehlendeBedingungen } = ansicht;
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
              angemeldet={angemeldet}
              bearbeitungsziel={bearbeitungsziel}
              teams={teams}
              fehlendeBedingungen={fehlendeBedingungen}
              varianten={training.varianten}
              aktiveVarianteId={aktive?.id}
              nachLoeschen={nachLoeschen}
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
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Lozenge>{altersstufeLabels[training.altersstufe]}</Lozenge>
                  {training.stufen.map((k) => (
                    <KategorieLozenge key={k} k={k} />
                  ))}
                  {/* Die Dauer der angezeigten Variante. */}
                  <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
                    <Clock size={16} strokeWidth={2} aria-hidden />
                    {dauerText}
                  </span>
                </div>
                {training.ziel && (
                  <p className="mt-2 type-body-medium text-on-surface">
                    <span className="type-label-small text-on-surface-mittel">Ziel: </span>
                    {training.ziel}
                  </p>
                )}
              </div>

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
