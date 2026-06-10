import Image from "next/image";
import { BookOpen, Clock } from "lucide-react";
import {
  KategorieChip,
  FieldPlaceholder,
  MethodischerFahrplan,
} from "@/components/ui";
import { formatDuration, teilTraegtDauer } from "@/lib/training";
import {
  feldtyp as feldLabels,
  hauptteilkategorie as hkatLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

function anzahlText(a: { min?: number | null; max?: number | null } | null): string | null {
  if (!a) return null;
  const { min, max } = a;
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  if (min != null) return `ab ${min}`;
  if (max != null) return `bis ${max}`;
  return null;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label-small text-on-surface-variant">{label}</p>
      <div className="type-body-medium mt-1 text-on-surface">{children}</div>
    </div>
  );
}

/* Vollständige Durchführungs-Details einer Trainings-Zuordnung (Stories #17/#18):
   Übungsablauf, Feld-Diagramm, Eckdaten und Dauer. Präsentational, daher in
   Durchführungs- (Client) wie Druck-Ansicht (Server) nutzbar. Eine für den
   Betrachter nicht verfügbare Übung fällt auf Platzhalter-Name + Dauer zurück. */
export function TrainingExerciseDetail({
  item,
  showSource = false,
}: {
  item: TrainingExerciseItem;
  showSource?: boolean;
}) {
  const ex = item.exercise;
  const dur =
    teilTraegtDauer(item.trainingsteil) && item.durationMin != null
      ? formatDuration(item.durationMin)
      : null;
  const anzahl = anzahlText(ex?.anzahl_kinder ?? null);

  return (
    <article className="break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-title-large text-on-surface">{item.name}</h3>
        {dur && (
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-variant">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {dur}
          </span>
        )}
      </div>

      {!item.available || !ex ? (
        <p className="type-body-medium text-on-surface-variant">
          Diese Übung ist nicht mehr verfügbar.
        </p>
      ) : (
        <>
          {ex.kategorien.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ex.kategorien.map((k) => (
                <KategorieChip key={k} k={k as KategorieSlug} />
              ))}
            </div>
          )}

          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[6px] border border-outline-variant">
            {ex.bild_url ? (
              <Image
                src={ex.bild_url}
                alt={`Feld-Diagramm: ${ex.name}`}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain"
              />
            ) : (
              <FieldPlaceholder className="h-full w-full" />
            )}
          </div>

          {(ex.hauptteilkategorie || ex.feldtyp || anzahl || ex.material.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {ex.feldtyp && (
                <Meta label="Feldtyp">
                  {feldLabels[ex.feldtyp as keyof typeof feldLabels] ?? ex.feldtyp}
                </Meta>
              )}
              {ex.hauptteilkategorie && (
                <Meta label="Hauptteilkategorie">
                  {hkatLabels[ex.hauptteilkategorie as keyof typeof hkatLabels] ??
                    ex.hauptteilkategorie}
                </Meta>
              )}
              {anzahl && <Meta label="Anzahl Kinder">{anzahl}</Meta>}
              {ex.material.length > 0 && (
                <Meta label="Material">{ex.material.join(", ")}</Meta>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="type-label-medium mb-2 text-on-surface-variant">Übungsablauf</p>
            {ex.methodischer_fahrplan ? (
              <MethodischerFahrplan fahrplan={ex.methodischer_fahrplan} />
            ) : ex.aufbau ? (
              <p className="type-body-medium whitespace-pre-line text-on-surface-variant">
                {ex.aufbau}
              </p>
            ) : (
              <p className="type-body-medium text-on-surface-variant">Kein Ablauf erfasst.</p>
            )}
          </div>

          {showSource && ex.source === "manual" && (
            <p className="mt-4 flex items-start gap-2 type-body-small text-on-surface-variant">
              <BookOpen size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
              Offizielle Übung aus dem Manual Kinderfussball des Schweizerischen
              Fussballverbands (SFV).
            </p>
          )}
        </>
      )}
    </article>
  );
}
