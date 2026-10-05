import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Die Gruppen, die eine Übung durchlaufen, in Wechselreihenfolge (Stories
 * #150/#153) — in der Durchführung, im Druck und im Detail der geöffneten
 * Übung (#371).
 *
 * Der Pfeil steckt im nachfolgenden Listenpunkt statt in einem eigenen:
 * Optisch dasselbe, aber die Liste zählt genau so viele Einträge, wie Gruppen
 * durchlaufen. Er trägt keinen Namen — vorgelesen wird die Reihenfolge, nicht
 * die Trenner. `beschriftetVon` verweist auf die sichtbare Beschriftung, so
 * heisst die Liste auch für Vorlesehilfen «Durchlauf».
 */
export function DurchlaufListe({
  gruppen,
  beschriftetVon,
  className,
}: {
  gruppen: readonly { id: string; name: string }[];
  beschriftetVon: string;
  className?: string;
}) {
  return (
    <ol aria-labelledby={beschriftetVon} className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {gruppen.map((g, i) => (
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
  );
}
