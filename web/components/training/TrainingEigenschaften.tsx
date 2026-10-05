import type { ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Eigenschaft,
  EigenschaftBreit,
  Eigenschaften,
  KategorieChip,
} from "@/components/ui";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { GESAMTDAUER_JUNIOREN } from "@/lib/junioren";
import { formatDuration, gesamtDauer } from "@/lib/training";
import { datumKurz } from "@/lib/zeit";
import { GesamtAbgleich } from "./ZeitAbgleich";
import { GesamtMaterialInhalt, traegtGesamtMaterial } from "./GesamtMaterialListe";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings";

/**
 * Die Eigenschaften eines Trainings gesammelt in der Spalte neben seinen
 * Übungen (Epic #369, Story #370) — beim Zusammenstellen wie in der Ansicht,
 * dieselbe Liste wie die Einordnung einer Übung auf ihrer Seite (#350).
 *
 * Gezeigt wird nur, was das Training führt (AK 3). Die Reihenfolge folgt dem
 * Auftrag: wofür (Altersstufe, Alterskategorien, Ziel), wie lange und womit
 * (Gesamtdauer, Material), wo es zuhause ist (Team, Termin, Sichtbarkeit) und
 * zuletzt, von wem — die Herkunft ordnet auch an der Übung am wenigsten ein.
 *
 * `zielFeld` und `stufenFeld`: Wer das Training bearbeitet, ändert Ziel und
 * Alterskategorien hier (AK 10, #375). Die Felder kommen fertig vom Aufrufer,
 * denn gespeichert wird dort; ohne sie stehen die Werte als Text. Das Ziel
 * steht beim Bearbeiten auch leer da (AK 4) — sonst gäbe es keinen Ort, es
 * zu erfassen.
 *
 * `hinweise`: Übungen ohne Dauer und der Abgleich mit den neunzig Minuten des
 * Juniorenfussballs sind Arbeitshinweise — nur für Bearbeitende (AK 6).
 *
 * Ohne Hooks: Die Ansicht rendert sie auf dem Server, der Editor im Client.
 */
export function TrainingEigenschaften({
  training,
  sichtbar,
  stufen,
  ziel,
  zielFeld,
  stufenFeld,
  hinweise = false,
}: {
  training: Pick<
    TrainingDetail,
    "altersstufe" | "team" | "terminDatum" | "visibility" | "urheber" | "exercises" | "varianten"
  >;
  /** Die Übungen der angezeigten Hauptteil-Variante samt allem ausserhalb —
   *  Grundlage der Gesamtdauer (AK 5). Das Material rechnet dagegen über alle
   *  Varianten (`training.exercises`). */
  sichtbar: readonly Pick<TrainingExerciseItem, "trainingsteil" | "durationMin">[];
  stufen: readonly string[];
  ziel: string | null;
  zielFeld?: ReactNode;
  stufenFeld?: ReactNode;
  hinweise?: boolean;
}) {
  const dauer = gesamtDauer(sichtbar);
  const junioren = training.altersstufe === "juniorenfussball";
  const zielText = ziel?.trim() ? ziel : null;

  return (
    <Eigenschaften titel="Eigenschaften">
      <Eigenschaft label="Altersstufe">{altersstufeLabels[training.altersstufe]}</Eigenschaft>

      {stufenFeld ? (
        <EigenschaftBreit label="Alterskategorien">{stufenFeld}</EigenschaftBreit>
      ) : (
        stufen.length > 0 && (
          <Eigenschaft label="Alterskategorien">
            <span className="flex flex-wrap gap-1.5">
              {stufen.map((k) => (
                <KategorieChip key={k} k={k as never} />
              ))}
            </span>
          </Eigenschaft>
        )
      )}

      {zielFeld ? (
        <EigenschaftBreit label="Ziel">{zielFeld}</EigenschaftBreit>
      ) : (
        zielText && (
          <Eigenschaft label="Ziel">
            <span className="whitespace-pre-line">{zielText}</span>
          </Eigenschaft>
        )
      )}

      <Eigenschaft label="Gesamtdauer">
        <span className="flex flex-col gap-0.5">
          <span>{dauer.erfasst ? formatDuration(dauer.summe) : "Keine Dauer erfasst"}</span>
          {hinweise && junioren && (
            <GesamtAbgleich sum={dauer.summe} soll={GESAMTDAUER_JUNIOREN} />
          )}
          {hinweise && dauer.ohneDauer > 0 && (
            <span className="type-label-medium text-on-surface-mittel">
              {dauer.ohneDauer} {dauer.ohneDauer === 1 ? "Übung ohne" : "Übungen ohne"} Dauer
            </span>
          )}
        </span>
      </Eigenschaft>

      {traegtGesamtMaterial(training.exercises, training.varianten) && (
        <Eigenschaft label="Material">
          <GesamtMaterialInhalt exercises={training.exercises} varianten={training.varianten} />
        </Eigenschaft>
      )}

      {training.team && (
        <Eigenschaft label="Team">
          <Link
            href={`/team/${training.team.id}`}
            className="focus-ring rounded-flaeche text-primary underline-offset-2 hover:underline"
          >
            {training.team.name}
          </Link>
        </Eigenschaft>
      )}

      {training.terminDatum && (
        <Eigenschaft label="Termin">{datumKurz(training.terminDatum)}</Eigenschaft>
      )}

      {/* Ein Team-Training wird nicht veröffentlicht — es gehört dem Team, das
          sagt die Zeile darüber. Nur ein persönliches führt eine Sichtbarkeit. */}
      {!training.team && (
        <Eigenschaft label="Sichtbarkeit">
          <Badge tone={training.visibility === "public" ? "oeffentlich" : "entwurf"}>
            {training.visibility === "public" ? "Öffentlich" : "✎ Entwurf"}
          </Badge>
        </Eigenschaft>
      )}

      {training.urheber && <Eigenschaft label="Urheber">{training.urheber}</Eigenschaft>}
    </Eigenschaften>
  );
}
