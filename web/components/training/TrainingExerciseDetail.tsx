import { Clock } from "lucide-react";
import {
  KategorieChip,
  MethodischerFahrplan,
  UebungsBild,
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

/* Vollständige Durchführungs-Details einer Fassung im Training (Stories #17/#18):
   Übungsablauf, Feld-Diagramm, Eckdaten und Dauer. Präsentational, daher in
   Durchführungs- (Client) wie Druck-Ansicht (Server) nutzbar.

   Beide Ansichten sind fürs Training auf dem Platz gedacht und zeigen darum
   ausschliesslich Durchführungsrelevantes — keine Herkunftsangabe (PO-Entscheid
   2026-08-22, Story 6 Out of Scope 1). */
export function TrainingExerciseDetail({ item }: { item: TrainingExerciseItem }) {
  const dur =
    teilTraegtDauer(item.trainingsteil) && item.durationMin != null
      ? formatDuration(item.durationMin)
      : null;
  const anzahl = anzahlText(item.anzahlKinder);

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

      {item.kategorien.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {item.kategorien.map((k) => (
            <KategorieChip key={k} k={k as KategorieSlug} />
          ))}
        </div>
      )}

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[6px] border border-outline-variant">
        <UebungsBild
          name={item.name}
          bildUrl={item.bildUrl}
          diagramm={item.diagramm}
          bildQuelle={item.bildQuelle}
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      {(item.hauptteilkategorie || item.feldtyp || anzahl || item.material.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {item.feldtyp && (
            <Meta label="Feldtyp">
              {feldLabels[item.feldtyp as keyof typeof feldLabels] ?? item.feldtyp}
            </Meta>
          )}
          {item.hauptteilkategorie && (
            <Meta label="Hauptteilkategorie">
              {hkatLabels[item.hauptteilkategorie as keyof typeof hkatLabels] ??
                item.hauptteilkategorie}
            </Meta>
          )}
          {anzahl && <Meta label="Anzahl Kinder">{anzahl}</Meta>}
          {item.material.length > 0 && (
            <Meta label="Material">{item.material.join(", ")}</Meta>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="type-label-medium mb-2 text-on-surface-variant">Übungsablauf</p>
        {item.fahrplan ? (
          <MethodischerFahrplan fahrplan={item.fahrplan} />
        ) : item.aufbau ? (
          <p className="type-body-medium whitespace-pre-line text-on-surface-variant">
            {item.aufbau}
          </p>
        ) : (
          <p className="type-body-medium text-on-surface-variant">Kein Ablauf erfasst.</p>
        )}
      </div>
    </article>
  );
}
