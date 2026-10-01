import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SlimSchalter } from "./AppRahmen";

/**
 * Kopfzeile jeder Seite: der Umschalter der Seitenleiste, die Brotkrumen und
 * rechts optional Aktionen (Training: Bearbeiten, Kopieren, …). Im Druck
 * fehlt sie, ausser `imDruck`: Dann steht der Pfad auf dem Papier (Umschalter
 * und Aktionen blenden sich selbst aus).
 *
 * Auf Server-Seiten keine `icon`-Funktionen in `krumen` reichen — sie lassen
 * sich nicht an den Client übergeben.
 */
export function SeitenKopf({
  krumen,
  aktionen,
  imDruck,
  className,
}: {
  krumen: BreadcrumbItem[];
  aktionen?: ReactNode;
  imDruck?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", !imDruck && "print:hidden", className)}>
      <SlimSchalter />
      <Breadcrumbs items={krumen} />
      {aktionen}
    </div>
  );
}
