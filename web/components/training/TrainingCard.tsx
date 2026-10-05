import Link from "next/link";
import { Clock, Layers, ListChecks } from "lucide-react";
import { Card, KategorieLozenge, Lozenge, SichtbarkeitLozenge } from "@/components/ui";
import { formatDuration } from "@/lib/training";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import type { TrainingListRow } from "@/lib/queries/trainings";

/* Trainings-Kachel für die Übersichten.
   Domänenfrei über `href`: eigene Trainings verlinken in den Editor, fremde in
   die Ansicht.

   Die Marke trägt die Kachel selbst, weil die Übersicht beide Bestände
   gemeinsam zeigt (Story B AK 3/4): am eigenen Eintrag steht, ob er ein Entwurf
   oder öffentlich ist. Aus der Ansicht allein liesse sich das nicht mehr
   ablesen. */
export function TrainingCard({
  training,
  href,
  /** Am eigenen Eintrag überflüssig — dort ist der Urheber man selbst. */
  zeigeUrheber = true,
  updatedLabel,
}: {
  training: TrainingListRow;
  href: string;
  zeigeUrheber?: boolean;
  /** Optionaler „Geändert"-Hinweis (eigene Übersicht, Story #13 AC2). */
  updatedLabel?: string;
}) {
  // Die Kachel hat keinen Rand mehr, den ein Hover aufhellen könnte — das
  // übernimmt die Zustands-Ebene: Sie liegt in der Farbe des Inhalts über der
  // Fläche und hellt Karte und Schrift im selben Ton auf. Sie sitzt auf dem
  // LINK, nicht auf der Karte: Der Link deckt die ganze Kachel, und nur er
  // kann Fokus und Druck überhaupt melden — auf dem <div> bliebe die Ebene
  // beim Tabben und beim Drücken stumm.
  return (
    <Card>
      <Link
        href={href}
        className="state focus-ring-inset block rounded-flaeche p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieLozenge key={k} k={k} />
          ))}
          {/* Welchem Lehrmittel das Training folgt (Story 5 AK 3), liest sich
              schon an den Alterskategorien ab — G/F/E ist Kinder-, D–A
              Juniorenfussball. Die Marke steht darum nur noch, wo keine
              Kategorie gewählt ist (Entwurf). Neutral statt in einem Akzent:
              die Altersstufe ist keine Alterskategorie. */}
          {training.stufen.length === 0 && (
            <Lozenge>{altersstufeLabels[training.altersstufe]}</Lozenge>
          )}
          {/* Führt das Training mehrere Varianten des Hauptteils, steht das
              schon in der Übersicht (#206 AK 1) — sonst müsste man jedes
              Training öffnen, um Alternativen zu finden. Bei genau einer
              Variante bleibt die Zeile stumm (AK 3). Als `discovery`-Lozenge: Sie
              meldet etwas Zusätzliches, die Wahl zwischen mehreren
              Hauptteilen. Plural immer, die Marke erscheint erst ab zwei. */}
          {training.variantenZahl > 1 && (
            <Lozenge appearance="discovery" iconBefore={Layers}>
              {training.variantenZahl} Varianten
            </Lozenge>
          )}
          {/* Nur am eigenen Eintrag: bei fremden ist der Zustand immer
              öffentlich und die Marke sagte nichts. */}
          {training.istEigen && (
            <SichtbarkeitLozenge oeffentlich={training.visibility === "public"} />
          )}
        </div>

        <h3 className="type-title-medium text-on-surface">
          {training.name}
        </h3>

        {/* Übungszahl und Dauer der ERSTEN Variante (#206 AK 2) — ein Training
            spielt nur eine Variante, die Summe über alle wäre eine Dauer, die
            es nie hat. Gerechnet wird das in `mapListRow`. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-body-medium text-on-surface-mittel">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={16} strokeWidth={2} aria-hidden />
            {training.exerciseCount} {training.exerciseCount === 1 ? "Übung" : "Übungen"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {training.hasAnyDuration ? formatDuration(training.totalDuration) : "Keine Dauer"}
          </span>
        </div>

        {/* Herkunft und Stand schliessen die Kachel ab — sie ordnen ein, der
            Inhalt steht darüber. Urheber: der Anzeigename, nie die E-Mail; bei
            anonymisierten Trainings (Konto gelöscht) entfällt er ganz
            (Story 15). */}
        {((zeigeUrheber && training.urheber) || updatedLabel) && (
          <div className="mt-3 flex flex-wrap gap-x-2 type-body-small text-on-surface-mittel">
            {zeigeUrheber && training.urheber && <span>von {training.urheber}</span>}
            {zeigeUrheber && training.urheber && updatedLabel && (
              <span aria-hidden>·</span>
            )}
            {updatedLabel && <span>Geändert am {updatedLabel}</span>}
          </div>
        )}
      </Link>
    </Card>
  );
}
