import Link from "next/link";
import type { ReactNode } from "react";
import { HerkunftBadge } from "./Badge";
import { KategorieChip } from "./Chip";
import { Card } from "./Card";
import { UebungsBild } from "./UebungsBild";
import type { KategorieSlug } from "@/lib/vocab";

export interface ExerciseCardData {
  slug: string;
  name: string;
  trainingsteilLabel: string;
  hauptteilkategorieLabel?: string | null;
  kategorien: KategorieSlug[];
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
  bildUrl?: string | null;
  diagramm?: unknown;
  bildQuelle?: "foto" | "diagramm" | null;
}

export function ExerciseCard({
  ex,
  actionSlot,
}: {
  ex: ExerciseCardData;
  /** Optionaler Aktions-Slot oben rechts (z. B. Favoriten-Button). Wird vom
   *  Feature-Layer befüllt, damit dieses UI-Kit domänenfrei bleibt. */
  actionSlot?: ReactNode;
}) {
  const meta = [ex.trainingsteilLabel, ex.hauptteilkategorieLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="group overflow-hidden">
      {/* Die ganze Karte ist eine Trefferfläche — darum trägt der Link die
          Zustands-Ebene (`state`) und nicht der Kartenrand: die Karte hat
          keinen mehr, und ein Overlay über der gesamten Fläche zeigt
          deutlicher, was angefasst wird, als ein aufgehellter Strich. */}
      <Link
        href={`/uebung/${ex.slug}`}
        className="state focus-ring-inset block rounded-flaeche"
      >
        {/* Aktives Bild: Diagramm, Foto oder Platzhalter */}
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-linie">
          <UebungsBild
            name={ex.name}
            bildUrl={ex.bildUrl}
            diagramm={ex.diagramm}
            bildQuelle={ex.bildQuelle}
            sizes="(max-width: 640px) 100vw, 320px"
          />

          {/* Lesbarkeits-Scrim für die Overlays oben — auf der dunklen
              Platzhalter-Skizze kaum sichtbar, sorgt auf hellen
              Diagramm-Bildern für Kontrast. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-scrim/55 to-transparent"
          />

          {/* Alterskategorien oben links. Der Aktions-Slot liegt oben rechts
              (ausserhalb des Links, s. u.), die Herkunft unten links. */}
          {ex.kategorien.length > 0 && (
            <div className="absolute left-2 top-2 flex gap-1">
              {ex.kategorien.map((k) => (
                <KategorieChip key={k} k={k} />
              ))}
            </div>
          )}
          <div className="absolute bottom-2 left-2">
            <HerkunftBadge herkunft={ex.herkunft} visibility={ex.visibility} />
          </div>
        </div>

        {/* Inhalt */}
        <div className="p-3">
          <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
            {ex.name}
          </h3>
          <p className="type-label-small mt-1 text-on-surface-mittel">
            {meta}
          </p>
        </div>
      </Link>

      {/* Aktions-Slot als Geschwister des Links (kein <button> in <a>),
          oben rechts über dem Diagramm. Inhalt liefert der Feature-Layer. */}
      {actionSlot && (
        <div className="absolute right-2 top-2 z-10">{actionSlot}</div>
      )}
    </Card>
  );
}
