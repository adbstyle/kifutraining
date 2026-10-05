import type { ReactNode } from "react";
import { ArrowRight, Clock, X } from "lucide-react";
import {
  Card,
  Freitext,
  IconButton,
  MethodischerFahrplan,
  Tooltip,
  UebungsBild,
} from "@/components/ui";
import { EinordnungsLeiste, type EinordnungsQuelle } from "@/components/exercise/EinordnungsLeiste";
import { formatDuration, teilTraegtDauer } from "@/lib/training";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Eine Übung im Training in der Form, die die Einordnungs-Liste liest. */
export function einordnungAusFassung(
  item: TrainingExerciseItem,
  altersstufe: Altersstufe,
): EinordnungsQuelle {
  return {
    altersstufe,
    trainingsteil: item.trainingsteil,
    kategorien: item.kategorien,
    hauptteilkategorie: item.hauptteilkategorie,
    feldtyp: item.feldtyp,
    spielfeld_laenge_m: item.spielfeldLaengeM,
    spielfeld_breite_m: item.spielfeldBreiteM,
    anzahl_kinder: item.anzahlKinder,
    material_liste: item.materialListe,
    material: item.material,
    uebungstyp: item.uebungstyp,
    erscheinungsform: item.erscheinungsform,
  };
}

/**
 * Eine geöffnete Übung des Trainings in der Spalte neben den übrigen
 * (Epic #369, Story #371) — anstelle der Eigenschaften des Trainings.
 *
 * Unter dem Namen, was sie in DIESEM Training trägt — Dauer, Durchlauf und
 * Notiz (AK 4). Dann, was zeigt, ob die Übung passt: Diagramm oder Bild,
 * Beschreibung und die Varianten der Übung, und zuletzt Einordnung und
 * Material wie auf der Übungsseite (AK 3). Eine Herkunft gibt es nicht
 * (OOS 1).
 *
 * Dauer, Notiz und Durchlauf kommen als eigene Angaben herein und nicht aus
 * `item`: Beim Zusammenstellen liegen sie lokal über dem Serverstand, und das
 * Detail soll zeigen, was der Trainer eben geändert hat (PC 1).
 *
 * `aktionen`: was neben dem Schliessen steht (Bearbeiten, #372). Ohne Hooks —
 * die Ansicht wie der Editor rendern es.
 */
export function UebungImTraining({
  item,
  altersstufe,
  dauer,
  notiz,
  durchlauf,
  aktionen,
  onSchliessen,
}: {
  item: TrainingExerciseItem;
  altersstufe: Altersstufe;
  dauer: number | null;
  notiz: string | null;
  durchlauf: readonly { id: string; name: string }[];
  aktionen?: ReactNode;
  onSchliessen: () => void;
}) {
  const dauerText =
    teilTraegtDauer(item.trainingsteil) && dauer != null ? formatDuration(dauer) : null;

  return (
    <article aria-labelledby={`uebung-${item.id}`} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h2 id={`uebung-${item.id}`} className="type-title-large min-w-0 flex-1 text-on-surface">
            {item.name}
          </h2>
          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            {aktionen}
            <Tooltip label="Übung schliessen">
              <IconButton icon={X} label="Übung schliessen" onClick={onSchliessen} />
            </Tooltip>
          </div>
        </div>
        {/* Was die Übung in DIESEM Training trägt, steht ohne eigene Fläche
            unter ihrem Namen (PO 2026-10-05) — wie in der Durchführung. */}
        {dauerText && (
          <p className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {dauerText}
          </p>
        )}
        {durchlauf.length > 0 && (
          <div className="flex gap-3">
            <span id={`durchlauf-${item.id}`} className="type-label-small w-16 shrink-0 pt-0.5 text-on-surface-mittel">
              Durchlauf
            </span>
            <ol aria-labelledby={`durchlauf-${item.id}`} className="type-body-medium flex flex-wrap items-baseline gap-x-2 text-on-surface">
              {durchlauf.map((g, i) => (
                <li key={g.id}>
                  {i > 0 && (
                    <ArrowRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className="mr-2 inline-block align-middle text-on-surface-mittel"
                    />
                  )}
                  {g.name}
                </li>
              ))}
            </ol>
          </div>
        )}
        {notiz && (
          <div className="flex gap-3">
            <span className="type-label-small w-16 shrink-0 pt-0.5 text-on-surface-mittel">Notiz</span>
            <p className="type-body-medium whitespace-pre-line text-on-surface">{notiz}</p>
          </div>
        )}
      </header>

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-flaeche border border-linie">
        <UebungsBild
          name={item.name}
          bildUrl={item.bildUrl}
          diagramm={item.diagramm}
          bildQuelle={item.bildQuelle}
          sizes="(min-width: 1280px) 40vw, 100vw"
        />
      </div>

      <section>
        <h3 className="type-title-small mb-2 text-on-surface-mittel">Übungsablauf</h3>
        <Card className="p-4">
          {item.fahrplan ? (
            <MethodischerFahrplan fahrplan={item.fahrplan} />
          ) : item.aufbau ? (
            <Freitext text={item.aufbau} />
          ) : (
            <p className="type-body-medium text-on-surface-mittel">Kein Ablauf erfasst.</p>
          )}
        </Card>
      </section>

      {item.uebungsvarianten && (
        <section>
          <h3 className="type-title-small mb-2 text-on-surface-mittel">Varianten</h3>
          <Card className="p-4">
            <Freitext text={item.uebungsvarianten} />
          </Card>
        </section>
      )}

      <EinordnungsLeiste ex={einordnungAusFassung(item, altersstufe)} />
    </article>
  );
}
