import { datumKurz } from "@/lib/zeit";
import type { TrainingNavKontext } from "@/lib/queries/trainings";
import type { BreadcrumbItem } from "@/components/ui";

/**
 * Der Rückweg aus einem geöffneten Training.
 *
 * Ein Training gehört entweder einer Person oder einem Team — und die
 * Brotkrumen führen dorthin, wo es tatsächlich liegt. Für ein Team-Training
 * war das bisher die allgemeine Trainingsübersicht, in der Team-Trainings
 * grundsätzlich nie erscheinen (#156).
 *
 * Drei Fälle:
 *
 * - **Persönlich oder öffentlich** — `Trainings › ‹Name›` wie bisher (AK 11).
 * - **Team, angesetzt** — `Teams › ‹Team› › ‹Name (Datum)›`. Die Team-Stufe
 *   führt in den Trainingsplan, denn das ist die Basis-Adresse des Teams;
 *   eine eigene Plan-Stufe gäbe es deshalb doppelt (AK 4/5). Das Datum
 *   unterscheidet die Einheiten desselben Trainings (AK 6).
 * - **Team, nicht angesetzt** — `Teams › ‹Team› › Trainings › ‹Name›`: dort
 *   liegt das Training, solange kein Termin daran hängt (AK 3).
 *
 * `blatt` hängt tiefere Stufen an (Fassung, Feld-Diagramm). Die bisher
 * letzte Stufe wird dann verlinkt und führt in den Editor des Trainings — nur
 * dort ist die Fassung überhaupt erreichbar.
 *
 * Rein und synchron: die Kette hängt allein am Kontext, nicht daran, über
 * welchen Weg jemand die Seite geöffnet hat (PC 1).
 */
export function trainingsKrumen(
  k: TrainingNavKontext,
  blatt: { label: string; href?: string }[] = [],
): BreadcrumbItem[] {
  const kette: BreadcrumbItem[] = k.team
    ? [
        { label: "Teams", href: "/teams" },
        { label: k.team.name, href: `/team/${k.team.id}` },
        ...(k.terminDatum
          ? []
          : [{ label: "Trainings", href: `/team/${k.team.id}/trainings` }]),
        {
          label: k.terminDatum ? `${k.name} (${datumKurz(k.terminDatum)})` : k.name,
        },
      ]
    : [{ label: "Trainings", href: "/trainings" }, { label: k.name }];

  if (blatt.length === 0) return kette;

  // Die Trainings-Stufe ist von hier aus nicht mehr die aktuelle Seite und
  // bekommt darum ein Ziel: den Editor, aus dem die Fassung geöffnet wurde.
  const bisher = kette.slice(0, -1);
  const training = kette[kette.length - 1];
  return [
    ...bisher,
    { ...training, href: `/training/${k.id}/edit` },
    ...blatt,
  ];
}
