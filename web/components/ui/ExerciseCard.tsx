import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Badge } from "./Badge";
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
    <Card className="group overflow-hidden transition-colors hover:border-chalk/45">
      <Link
        href={`/uebung/${ex.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {/* Diagramm */}
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-chalk/15">
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

          {/* Herkunft / Status — oben rechts */}
          <div className="absolute right-2 top-2">
            {ex.herkunft === "manual" ? (
              <Badge tone="manual" />
            ) : ex.visibility === "public" ? (
              <Badge tone="oeffentlich" />
            ) : (
              <Badge tone="entwurf">✎ Entwurf</Badge>
            )}
          </div>
        </div>

        {/* Inhalt */}
        <div className="p-3">
          <h3 className="text-xl text-chalk transition-colors group-hover:text-signal-bright">
            {ex.name}
          </h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-chalk-faint">
            {meta}
          </p>
          {ex.kategorien.length > 0 && (
            <div className="mt-3 flex gap-1">
              {ex.kategorien.map((k) => (
                <KategorieChip key={k} k={k} />
              ))}
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}
