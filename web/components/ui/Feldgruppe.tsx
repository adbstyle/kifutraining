import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Zusammengehörige Felder in einem Rahmen mit gemeinsamer Legende (#533) —
 * nach dem Vorbild der Feldgruppe (Fieldset) anderer Design-Systeme. Anlass
 * waren Ort und Kartenlink eines Termins: Der Link gehört zum Ort und fällt
 * mit ihm weg; der Rahmen zeigt dieses Paar auf einen Blick, stärker als eine
 * Abschnittsüberschrift (`FormAbschnitt`), die nur trennt.
 *
 * Neu, weil kein Baustein Felder umrandet zusammenfasst (PO 2026-10-27). Für
 * Felder, die voneinander abhängen — nicht für lose verwandte; die gliedert
 * weiter `FormAbschnitt`. Die Legende sitzt auf der Kontur (natives
 * `<legend>`), in `type-label-medium`; die Vorlesehilfe liest die Felder als
 * eine Gruppe. Kontur `kante` wie ein Feld, Radius `flaeche`.
 */
export function Feldgruppe({
  legende,
  children,
  className,
}: {
  legende: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn("kontur m-0 flex min-w-0 flex-col gap-4 rounded-flaeche border-kante px-2 pb-3 pt-1", className)}
    >
      <legend className="type-label-medium mx-1.5 px-1.5 text-on-surface">{legende}</legend>
      {children}
    </fieldset>
  );
}
