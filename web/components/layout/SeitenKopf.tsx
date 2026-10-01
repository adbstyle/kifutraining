import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SlimSchalter } from "./AppRahmen";

/**
 * Kopfzeile jeder Seite: der Umschalter der Seitenleiste, die Brotkrumen und
 * rechts optional Aktionen (Training: Bearbeiten, Kopieren, …). Im Druck
 * nicht zu sehen.
 *
 * Auf Server-Seiten keine `icon`-Funktionen in `krumen` reichen — sie lassen
 * sich nicht an den Client übergeben.
 */
export function SeitenKopf({
  krumen,
  aktionen,
  className,
}: {
  krumen: BreadcrumbItem[];
  aktionen?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 print:hidden", className)}>
      <SlimSchalter />
      <Breadcrumbs items={krumen} />
      {aktionen}
    </div>
  );
}
