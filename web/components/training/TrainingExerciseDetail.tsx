import { Clock } from "lucide-react";
import {
  KategorieChip,
  MethodischerFahrplan,
  UebungsBild,
} from "@/components/ui";
import { formatDuration, teilTraegtDauer } from "@/lib/training";
import {
  feldtyp as feldLabels,
  uebungstyp as uebungstypLabels,
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
   ausschliesslich Durchführungsrelevantes. */
export function TrainingExerciseDetail({ item }: { item: TrainingExerciseItem }) {
  const dur =
    teilTraegtDauer(item.trainingsteil) && item.durationMin != null
      ? formatDuration(item.durationMin)
      : null;
  const anzahl = anzahlText(item.anzahlKinder);
  // Spielfeldgrösse und Feldtyp schliessen einander aus: der Feldtyp ist eine
  // Kategorie des Manuals Fussball Kinder, die Spielfeldgrösse führt das
  // Junioren-Manual an seiner Stelle (Story 3 AK 8/10). Geschrieben wie auf der
  // Übungs-Detailseite — «35 × 20 m».
  const spielfeld =
    item.spielfeldLaengeM != null && item.spielfeldBreiteM != null
      ? `${item.spielfeldLaengeM} × ${item.spielfeldBreiteM} m`
      : null;

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

      {/* Eckdaten fürs Aufbauen — der Übungstyp gehört seit Story #124 nicht
          mehr dazu, er steht unterhalb des Ablaufs. */}
      {(item.hauptteilkategorie ||
        item.feldtyp ||
        spielfeld ||
        anzahl ||
        item.material.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {item.feldtyp && (
            <Meta label="Feldtyp">
              {feldLabels[item.feldtyp as keyof typeof feldLabels] ?? item.feldtyp}
            </Meta>
          )}
          {spielfeld && <Meta label="Spielfeldgrösse">{spielfeld}</Meta>}
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

      {/* Übungstyp — hinter dem Ablauf (Story #124, PO 2026-08-31): er ordnet
          die Übung ein und speist die Filter, für die Durchführung auf dem Platz
          sagt er nichts. Die Erscheinungsform bleibt hier weiterhin ganz weg,
          Durchführungs- wie Druckansicht zeigen nur Durchführungsrelevantes. */}
      {item.uebungstyp && (
        <div className="mt-4">
          <Meta label="Übungstyp">
            {uebungstypLabels[item.uebungstyp as keyof typeof uebungstypLabels] ??
              item.uebungstyp}
          </Meta>
        </div>
      )}
    </article>
  );
}
