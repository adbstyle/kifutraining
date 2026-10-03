import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SlimSchalter } from "./AppRahmen";

/**
 * Kopfzeile jeder Seite: der Umschalter der Seitenleiste, die Brotkrumen und
 * rechtsbündig optional Aktionen (Übersichten: Erstellen; Training:
 * Bearbeiten, Kopieren, …). Im Druck fehlt sie, ausser `imDruck`: Dann steht
 * der Pfad auf dem Papier (Umschalter und Aktionen blenden sich aus).
 *
 * Ab `lg` ist sie mindestens so hoch wie der Kopf der Seitenleiste (64 px)
 * und steht ohne Rand am oberen Rand: So liegen Umschalter und Brotkrumen auf
 * einer Linie mit der Marke. Ein langer Pfad darf umbrechen, dann wächst sie.
 * Die Seite setzt darum ab `lg` keinen oberen Rand vor sie.
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
    <div className={cn("flex items-center gap-3 lg:min-h-16", !imDruck && "print:hidden", className)}>
      <SlimSchalter />
      <Breadcrumbs items={krumen} />
      {aktionen && <div className="ml-auto flex shrink-0 items-center print:hidden">{aktionen}</div>}
    </div>
  );
}
