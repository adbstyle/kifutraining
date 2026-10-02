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
 * Ab `lg` ist sie mindestens so hoch wie der Kopf der Seitenleiste (64 px)
 * und steht ohne Rand am oberen Rand: So liegen Umschalter und Brotkrumen auf
 * einer Linie mit der Marke. Ein langer Pfad darf umbrechen, dann wächst sie.
 * Die Seite setzt darum ab `lg` keinen oberen Rand vor sie.
 *
 * Sie bleibt beim Scrollen oben stehen (Epic #350) — unter `lg` unter der
 * Kopfzeile mit dem Menüknopf (56 px). Ihre Fläche ist der Grund der Seite, so
 * verschwindet der Inhalt darunter; den Abstand zum Inhalt setzt der Aufrufer
 * darum als Innenabstand, nicht als Rand. `mitlaufend={false}` für Seiten mit
 * eigenen klebenden Überschriften (Durchführung).
 *
 * Auf Server-Seiten keine `icon`-Funktionen in `krumen` reichen — sie lassen
 * sich nicht an den Client übergeben.
 */
export function SeitenKopf({
  krumen,
  aktionen,
  imDruck,
  mitlaufend = true,
  className,
}: {
  krumen: BreadcrumbItem[];
  aktionen?: ReactNode;
  imDruck?: boolean;
  mitlaufend?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 lg:min-h-16",
        mitlaufend && "sticky top-14 z-20 bg-elev-00 max-lg:pt-3 lg:top-0 print:static",
        !imDruck && "print:hidden",
        className,
      )}
    >
      <SlimSchalter />
      <Breadcrumbs items={krumen} />
      {aktionen}
    </div>
  );
}
