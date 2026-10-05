import type { ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import {
  Card,
  Eigenschaft,
  Eigenschaften,
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
 * Vorne, was zeigt, ob die Übung passt: Diagramm oder Bild, Beschreibung und
 * die Varianten der Übung. Danach, was sie in DIESEM Training trägt — Dauer,
 * Durchlauf und Notiz (AK 4) —, und zuletzt Einordnung und Material wie auf
 * der Übungsseite (AK 3). Eine Herkunft gibt es nicht (OOS 1).
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
  const imTraining = dauerText || notiz || durchlauf.length > 0;

  return (
    <article aria-labelledby={`uebung-${item.id}`} className="flex flex-col gap-6">
      <header className="flex items-start gap-2">
        <h2 id={`uebung-${item.id}`} className="type-title-large min-w-0 flex-1 text-on-surface">
          {item.name}
        </h2>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {aktionen}
          <Tooltip label="Übung schliessen">
            <IconButton icon={X} label="Übung schliessen" onClick={onSchliessen} />
          </Tooltip>
        </div>
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

      {imTraining && (
        <Eigenschaften titel="Im Training">
          {dauerText && <Eigenschaft label="Dauer">{dauerText}</Eigenschaft>}
          {durchlauf.length > 0 && (
            <Eigenschaft label="Durchlauf">
              <ol className="flex flex-wrap items-baseline gap-x-2">
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
            </Eigenschaft>
          )}
          {notiz && (
            <Eigenschaft label="Notiz">
              <span className="whitespace-pre-line">{notiz}</span>
            </Eigenschaft>
          )}
        </Eigenschaften>
      )}

      <EinordnungsLeiste ex={einordnungAusFassung(item, altersstufe)} />
    </article>
  );
}
