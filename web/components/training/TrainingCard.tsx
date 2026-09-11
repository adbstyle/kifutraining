import Link from "next/link";
import { Clock, Layers, ListChecks } from "lucide-react";
import { Badge, Card, KategorieChip } from "@/components/ui";
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
    <Card className="group">
      <Link
        href={href}
        className="state focus-ring-inset block rounded-flaeche p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {training.stufen.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
          {/* Welchem Lehrmittel das Training folgt (Story 5 AK 3). Bewusst
              neutral statt in einer Kategorie-Farbe: die Altersstufe ist keine
              Alterskategorie und darf deren gelernte Codierung nicht borgen —
              derselbe Look wie am Übungsformular. */}
          <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
          {/* Führt das Training mehrere Varianten des Hauptteils, steht das
              schon in der Übersicht (#206 AK 1) — sonst müsste man jedes
              Training öffnen, um Alternativen zu finden. Bei genau einer
              Variante bleibt die Zeile stumm (AK 3). Der eigene Ton trägt
              Primary-Kontur statt einer Kategorie-Farbe: Die Variantenzahl ist
              keine Alterskategorie und borgt deren gelernte Codierung nicht —
              umrandet heisst hier wie überall «gilt», und was gilt, ist die
              Wahl zwischen mehreren Hauptteilen. Plural immer, die Marke
              erscheint erst ab zwei. */}
          {training.variantenZahl > 1 && (
            <Badge tone="varianten">
              <Layers size={12} strokeWidth={2.5} aria-hidden />
              {training.variantenZahl} Varianten
            </Badge>
          )}
          {/* Nur am eigenen Eintrag: bei fremden ist der Zustand immer
              öffentlich und die Marke sagte nichts. */}
          {training.istEigen && (
            <Badge tone={training.visibility === "public" ? "oeffentlich" : "entwurf"}>
              {training.visibility === "public" ? "Öffentlich" : "✎ Entwurf"}
            </Badge>
          )}
        </div>

        <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
          {training.name}
        </h3>

        {/* Urheber: der Anzeigename, nie die E-Mail. Bei anonymisierten
            Trainings (Konto gelöscht) entfällt die Zeile ganz (Story 15). */}
        {zeigeUrheber && training.urheber && (
          <p className="mt-1 type-body-small text-on-surface-mittel">
            von {training.urheber}
          </p>
        )}

        {/* Übungszahl und Dauer der ERSTEN Variante (#206 AK 2) — ein Training
            spielt nur eine Variante, die Summe über alle wäre eine Dauer, die
            es nie hat. Gerechnet wird das in `mapListRow`. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 type-label-medium text-on-surface-mittel">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={15} strokeWidth={2} aria-hidden />
            {training.exerciseCount} {training.exerciseCount === 1 ? "Übung" : "Übungen"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2} aria-hidden />
            {training.hasAnyDuration ? formatDuration(training.totalDuration) : "Keine Dauer"}
          </span>
        </div>

        {updatedLabel && (
          <p className="mt-2 type-label-small text-on-surface-mittel">
            Geändert: {updatedLabel}
          </p>
        )}
      </Link>
    </Card>
  );
}
