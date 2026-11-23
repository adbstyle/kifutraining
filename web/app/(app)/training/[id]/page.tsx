import type { Metadata } from "next";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { Flash } from "@/components/Flash";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { InBibliothekButton } from "@/components/training/InBibliothekButton";
import { KontoGrenzenLage } from "@/components/konto/BestandStufe";
import { TrainingAktionen } from "@/components/training/TrainingAktionen";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { TrainingTeile } from "@/components/training/TrainingTeile";
import { TrainingKopfAngaben } from "@/components/training/TrainingKopfAngaben";
import { TrainingEigenschaften } from "@/components/training/TrainingEigenschaften";
import {
  AnsichtFlaeche,
  AnsichtSpalte,
  AnsichtUebungsName,
  AnsichtZeile,
} from "@/components/training/AnsichtFlaeche";
import { uebungAus } from "@/lib/offene-uebung";
import { AnsichtName, AnsichtStufen, AnsichtZiel } from "@/components/training/AnsichtEingaben";
import { angezeigteVariante, ladeTrainingAnsicht } from "@/lib/queries/training-ansicht";
import { varianteAnhang, varianteAus } from "@/lib/varianten";
import { trainingsKrumen } from "@/lib/brotkrumen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training - KiFu",
  robots: { index: false },
};

export default async function TrainingViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    uebernommen?: string;
    variante?: string;
    uebung?: string;
    bearbeiten?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Bearbeitungsrecht, Teams, Grenzen-Lage und fehlende Bedingungen — dieselbe
  // Zusammenstellung wie im Detail der Trainingsübersicht (#630). Die Teams
  // sind Ziel zweier Aktionen: Übernehmen (an jedem öffentlichen Training) und
  // Ins-Team-Stellen (am eigenen, auch am privaten).
  const ansicht = await ladeTrainingAnsicht(id);
  if (!ansicht) return <TrainingNotAvailable />;
  const { training, bearbeitungsziel, teams, mitGrenzen, fehlendeBedingungen } = ansicht;

  // Angesehen wird genau eine Variante des Hauptteils, zu Beginn die erste
  // (#203 AK 1/7). Die Wahl steht im Suchparameter und nicht im Zustand: Ein
  // Link auf die Variante braucht keine Rechte am Training.
  //
  // Meint die Adresse eine geöffnete Übung des Hauptteils, gilt deren Variante
  // (#371 AK 10) — sonst stünde die Übung gar nicht da.
  const anfangsUebung = uebungAus(sp.uebung, training.exercises);
  const aktive = anfangsUebung?.varianteId
    ? training.varianten.find((v) => v.id === anfangsUebung.varianteId)
    : varianteAus(sp.variante, training.varianten);
  // Dieselbe Rechnung wie in der Spalte (`TrainingEigenschaften`).
  const { sichtbar, sections, dauerText } = angezeigteVariante(training, aktive);
  // Ab `xl` stehen die Eigenschaften gesammelt in der Spalte neben den Übungen
  // (Epic #369, Story #370) — dieselbe Liste wie beim Zusammenstellen. Die
  // Arbeitshinweise zur Dauer bekommt nur, wer das Training bearbeiten darf
  // (AK 6).
  const eigenschaften = (
    <TrainingEigenschaften
      training={training}
      sichtbar={sichtbar}
      stufen={training.stufen}
      ziel={training.ziel}
      hinweise={!!bearbeitungsziel}
      // Wer bearbeiten darf, ändert Ziel und Alterskategorien hier (#375).
      zielZeile={
        bearbeitungsziel && <AnsichtZiel trainingId={training.id} ziel={training.ziel} />
      }
      stufenZeile={
        bearbeitungsziel && (
          <AnsichtStufen
            trainingId={training.id}
            altersstufe={training.altersstufe}
            stufen={training.stufen}
            varianten={training.varianten}
          />
        )
      }
    />
  );

  // Die Aktionen stehen auf der Brotkrumen-Zeile, rechtsbündig — dieselbe
  // Stelle wie im Editor (#249 AK 8). Dort oben gehören sie hin: Sie
  // betreffen das Training als Ganzes, nicht seine Überschrift, und der Kopf
  // darunter bleibt ungestört.
  return (
    // Je Variante ein neuer Rahmen: Ihr Wechsel schliesst die Übung (EK 14).
    <KontoGrenzenLage mitGrenzen={mitGrenzen}>
      <AnsichtFlaeche
        key={aktive?.id ?? "ohne"}
        anfangsOffenId={anfangsUebung?.id ?? null}
        anfangsBearbeiten={!!sp.bearbeiten}
        uebungParam={sp.uebung}
        // Bearbeiten in der Ansicht nur mit Bearbeitungsrecht (#374 AK 7) —
        // die Server Action und die RLS prüfen es ohnehin noch einmal.
        bearbeitbar={!!bearbeitungsziel}
        uebungen={sichtbar}
      >
        <Seitenrahmen
          breite="3xl"
          krumen={trainingsKrumen(training)}
          aktionen={
            <TrainingAktionen
              ort="ansicht"
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
            />
          }
          kopfImDruck
          spalte={
            <AnsichtSpalte
              altersstufe={training.altersstufe}
              variante={aktive?.id}
              eigenschaften={eigenschaften}
            />
          }
          spalteNurBreit
          spaltenName="Spalte"
          // Wer bearbeiten darf, findet in der Spalte Eingabefelder — dann ist
          // sie keine Nebensache für Vorlesehilfen.
          spalteBeiseite={!bearbeitungsziel}
        >
          {sp.uebernommen && (
            <Flash
              message="Kopie liegt in deinem Bestand - du kannst sie jetzt anpassen."
              param="uebernommen"
            />
          )}
          <header className="mb-6">
            {/* Wer bearbeiten darf, ändert den Namen dort, wo er steht — wie beim
                Zusammenstellen (#375 AK 1). */}
            {bearbeitungsziel ? (
              <AnsichtName trainingId={training.id} name={training.name} />
            ) : (
              <h1 className="type-headline-large text-on-surface">{training.name}</h1>
            )}
            {/* Breit steht all das in der Spalte daneben — hier nicht ein
                zweites Mal (#370 AK 7). Schmal und auf Papier wie bisher. */}
            <div className="xl:hidden print:block">
              {/* Urheber: der Anzeigename, nie die E-Mail. Bei anonymisierten
                  Trainings (Konto gelöscht) entfällt die Zeile ganz (Story 15). */}
              {training.urheber && (
                <p className="mt-1 type-body-medium text-on-surface-mittel">
                  von {training.urheber}
                </p>
              )}
              {/* Die Altersstufe benennen, nicht nur andeuten (Story 5 AK 3): Für
                  ein fremdes öffentliches Training ist diese Seite die einzige
                  Sicht — dort stünde die Angabe sonst nirgends. */}
              <TrainingKopfAngaben
                className="mt-3"
                zielClassName="mt-3"
                altersstufe={training.altersstufe}
                stufen={training.stufen}
                dauerText={dauerText}
                ziel={training.ziel}
              />
            </div>
          </header>

          {/* Über den Trainingsteilen, weil die Variante entscheidet, WAS darunter
              steht (#203 AK 2/7). Links statt Chips: Jede Variante hat eine eigene
              Adresse — so wechselt auch, wer das Training bloss ansehen darf. */}
          <VariantenLinks
            varianten={training.varianten}
            aktiv={aktive?.id}
            hrefFuer={(v) => `/training/${training.id}${varianteAnhang(v)}`}
            className="mb-4"
          />

          <TrainingTeile
            sections={sections}
            aktive={aktive}
            varianten={training.varianten}
            zeile={(item, dur) => (
              // Die Übung im Training ist eine eigenständige Fassung und
              // verlinkt bewusst nicht auf einen Bibliotheks-Eintrag: sie hängt
              // von ihm nicht mehr ab, und ihr Inhalt kann inzwischen abweichen
              // (Story 6 AK 10).
              <AnsichtZeile key={item.id} id={item.id} className="flex items-center gap-3 px-2 py-2">
                <ExerciseThumb bildUrl={item.bildUrl} diagramm={item.diagramm} bildQuelle={item.bildQuelle} name={item.name} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 self-start">
                  <AnsichtUebungsName id={item.id} name={item.name} />
                </span>
                {dur && <span className="shrink-0 type-label-medium text-on-surface-mittel">{dur}</span>}
                {/* Auch aus einem fremden öffentlichen Training kopierbar (Story 7
                    AK 2) — hier gibt es keinen Editor, darum steht die Aktion in
                    der Ansicht. Breit im Detail der geöffneten Übung, hier nur
                    schmal (`InBibliothekButton`). */}
                <InBibliothekButton fassungId={item.id} name={item.name} className="xl:hidden" />
              </AnsichtZeile>
            )}
          />
        </Seitenrahmen>
      </AnsichtFlaeche>
    </KontoGrenzenLage>
  );
}
