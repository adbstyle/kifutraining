import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { Badge, KategorieChip } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { Flash } from "@/components/Flash";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { InBibliothekButton } from "@/components/training/InBibliothekButton";
import { TrainingAktionen } from "@/components/training/TrainingAktionen";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { TrainingEigenschaften } from "@/components/training/TrainingEigenschaften";
import {
  AnsichtFlaeche,
  AnsichtSpalte,
  AnsichtUebungsName,
  AnsichtZeile,
} from "@/components/training/AnsichtFlaeche";
import { uebungAus } from "@/lib/offene-uebung";
import { AnsichtName, AnsichtStufen, AnsichtZiel } from "@/components/training/AnsichtEingaben";
import { getTrainingView } from "@/lib/queries/trainings";
import { getMeineTeams } from "@/lib/queries/teams";
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { fehlendeBedingungenAus } from "@/lib/training-bedingungen";
import { createClient } from "@/lib/supabase/server";
import { leseGliederung, formatDuration, gesamtDauer } from "@/lib/training";
import {
  abschnittMitVariante,
  sichtbareZuordnungen,
  varianteAnhang,
  varianteAus,
} from "@/lib/varianten";
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
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bearbeitungsziel = user
    ? bearbeitungszielVon(
        {
          owner_id: training.ownerId,
          team_id: training.team?.id ?? null,
        },
        user.id,
      )
    : null;
  // Die Teams sind Ziel zweier Aktionen: Übernehmen (an jedem öffentlichen
  // Training) und Ins-Team-Stellen (am eigenen, auch am privaten). Darum für
  // jeden Angemeldeten geladen, nicht mehr nur bei öffentlichen.
  const teams = user ? await getMeineTeams() : [];
  // Was dem Training zum Veröffentlichen fehlt — dieselbe Funktion, die der
  // Editor und die Server Action nutzen. Gebraucht wird sie nur, wo die Aktion
  // überhaupt offensteht: am eigenen, nicht dem Team gehörenden Training.
  const fehlendeBedingungen =
    bearbeitungsziel?.art === "persoenlich"
      ? fehlendeBedingungenAus(
          training.altersstufe,
          training.stufen,
          training.exercises,
          training.varianten,
        )
      : [];

  // Angesehen wird genau eine Variante des Hauptteils, zu Beginn die erste
  // (#203 AK 1/7). Die Wahl steht im Suchparameter und nicht im Zustand: Diese
  // Seite sehen auch Betrachter ohne Konto, und ein Link braucht keine Rechte.
  //
  // Meint die Adresse eine geöffnete Übung des Hauptteils, gilt deren Variante
  // (#371 AK 10) — sonst stünde die Übung gar nicht da.
  const anfangsUebung = uebungAus(sp.uebung, training.exercises);
  const aktive = anfangsUebung?.varianteId
    ? training.varianten.find((v) => v.id === anfangsUebung.varianteId)
    : varianteAus(sp.variante, training.varianten);
  const sichtbar = sichtbareZuordnungen(training.exercises, aktive?.id);
  const sections = leseGliederung(training.altersstufe, sichtbar);
  // Dieselbe Rechnung wie in der Spalte (`TrainingEigenschaften`).
  const dauer = gesamtDauer(sichtbar);
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
            angemeldet={!!user}
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
            uebungen={sichtbar}
            altersstufe={training.altersstufe}
            variante={aktive?.id}
            kopierbar={!!user}
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Die Altersstufe benennen, nicht nur andeuten (Story 5 AK 3):
                  Derselbe neutrale Badge wie im Editor und auf der Trainingskarte.
                  Für ein fremdes öffentliches Training ist diese Seite die einzige
                  Sicht — dort stünde die Angabe sonst nirgends. */}
              <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
              {training.stufen.map((k) => (
                <KategorieChip key={k} k={k} />
              ))}
              <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
                <Clock size={16} strokeWidth={2} aria-hidden />
                {dauer.erfasst ? formatDuration(dauer.summe) : "Keine Dauer erfasst"}
              </span>
            </div>

            {/* Das Ziel sehen auch Betrachter eines veröffentlichten Trainings:
                feldweises Verbergen kennt das Zugriffsmodell nicht (Story 10
                PC 1). Ohne Ziel bleibt der Bereich weg (PC 2). */}
            {training.ziel && (
              <p className="mt-3 type-body-medium text-on-surface">
                <span className="type-label-small text-on-surface-mittel">Ziel: </span>
                {training.ziel}
              </p>
            )}
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

        <div className="flex flex-col gap-4">
          {sections.map((s) => {
            const blocks = s.bloecke;
            return (
              <section
                key={s.key}
                className="rounded-flaeche bg-elev-01 p-4 sm:p-5"
              >
                <h2 className="mb-3 type-title-medium text-on-surface">
                  {/* Welche Variante hier steht, gehört an den Hauptteil selbst —
                      nicht nur an die Wahl darüber (#203 AK 5). */}
                  {abschnittMitVariante(s.key, s.label, aktive, training.varianten)}
                  {s.sum > 0 && (
                    <span className="ml-2 type-label-medium text-on-surface-mittel">
                      {formatDuration(s.sum)}
                    </span>
                  )}
                </h2>
                <div className="flex flex-col gap-4">
                  {blocks.map((b) => (
                    <div key={b.key}>
                      {b.label && (
                        <h3 className="mb-2 type-title-small text-on-surface-mittel">
                          {b.label}
                          {b.sum > 0 && (
                            <span className="ml-2 type-label-medium text-on-surface-mittel">
                              {formatDuration(b.sum)}
                            </span>
                          )}
                        </h3>
                      )}
                      <ol className="flex flex-col gap-2">
                        {b.items.map((item) => {
                          const dur =
                            s.traegtDauer && item.durationMin != null
                              ? formatDuration(item.durationMin)
                              : null;
                          return (
                            // Die Übung im Training ist eine eigenständige Fassung
                            // und verlinkt bewusst nicht auf einen Bibliotheks-
                            // Eintrag: sie hängt von ihm nicht mehr ab, und ihr
                            // Inhalt kann inzwischen abweichen (Story 6 AK 10).
                            <AnsichtZeile
                              key={item.id}
                              id={item.id}
                              className="flex items-center gap-3 px-2 py-2"
                            >
                              <ExerciseThumb
                                bildUrl={item.bildUrl}
                                diagramm={item.diagramm}
                                bildQuelle={item.bildQuelle}
                                name={item.name}
                              />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5 self-start">
                                <AnsichtUebungsName id={item.id} name={item.name} />
                              </span>
                              {dur && (
                                <span className="shrink-0 type-label-medium text-on-surface-mittel">
                                  {dur}
                                </span>
                              )}
                              {/* Auch aus einem fremden öffentlichen Training
                                  kopierbar (Story 7 AK 2) — hier gibt es keinen
                                  Editor, darum steht die Aktion in der Ansicht.
                                  Breit im Detail der geöffneten Übung, hier nur
                                  schmal (`InBibliothekButton`). */}
                              {user && (
                                <InBibliothekButton
                                  fassungId={item.id}
                                  name={item.name}
                                  className="xl:hidden"
                                />
                              )}
                            </AnsichtZeile>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {!user && (
          <div className="mt-8 flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3">
            <Sparkles size={18} className="shrink-0 text-primary" aria-hidden />
            <p className="type-body-small text-on-surface-mittel">
              Mit einem Konto kannst du eigene Trainings erstellen und
              verwalten.{" "}
              <Link href="/login" className="text-primary underline">
                Anmelden
              </Link>
            </p>
          </div>
        )}
      </Seitenrahmen>
    </AnsichtFlaeche>
  );
}
