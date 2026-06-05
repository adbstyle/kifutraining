import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { HerkunftBadge } from "./Badge";
import { KategorieChip } from "./Chip";
import { Card } from "./Card";
import { FieldPlaceholder } from "./FieldPlaceholder";
import type { KategorieSlug } from "@/lib/vocab";

export interface ExerciseCardData {
  slug: string;
  name: string;
  trainingsteilLabel: string;
  feldtypLabel?: string | null;
  kategorien: KategorieSlug[];
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
  bildUrl?: string | null;
}

export function ExerciseCard({ ex }: { ex: ExerciseCardData }) {
  const meta = [ex.trainingsteilLabel, ex.feldtypLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="group overflow-hidden transition-colors hover:border-on-surface/45">
      <Link
        href={`/uebung/${ex.slug}`}
        className="focus-ring-inset block rounded-[4px]"
      >
        {/* Diagramm */}
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-outline-variant">
          {ex.bildUrl ? (
            <Image
              src={ex.bildUrl}
              alt={`Feld-Diagramm: ${ex.name} (${ex.trainingsteilLabel})`}
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-contain"
            />
          ) : (
            <FieldPlaceholder className="h-full w-full" />
          )}

          {/* Lesbarkeits-Scrim für die Overlays oben — auf der dunklen
              Kreide-Skizze kaum sichtbar, sorgt auf hellen Diagramm-Bildern
              für Kontrast. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent"
          />

          {/* Overlay-Zeile oben: Alterskategorien links, Status rechts —
              gemeinsame Höhe, mittig zueinander ausgerichtet. */}
          <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
            {ex.kategorien.length > 0 ? (
              <div className="flex gap-1">
                {ex.kategorien.map((k) => (
                  <KategorieChip key={k} k={k} />
                ))}
              </div>
            ) : (
              <span />
            )}
            <HerkunftBadge herkunft={ex.herkunft} visibility={ex.visibility} />
          </div>
        </div>

        {/* Inhalt */}
        <div className="p-3">
          <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
            {ex.name}
          </h3>
          <p className="type-label-small mt-1 text-on-surface-variant">
            {meta}
          </p>
        </div>
      </Link>
    </Card>
  );
}
