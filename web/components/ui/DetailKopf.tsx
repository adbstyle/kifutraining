import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButtonLink } from "./IconButton";

/* Der Kopf eines Detail neben einer Liste (Muster «DetailKopf», #630): links
   der Name als Überschrift, rechts auf Titelhöhe die Aktionen als
   Icon-Knöpfe, dann ein senkrechter Trenner und zuletzt das X, das das Detail
   schliesst.

   Der Trenner scheidet, was man MIT dem Eintrag tut, vom Schliessen, das nur
   die Ansicht betrifft — ohne ihn läge das X wie eine weitere Aktion in der
   Reihe. Das X ist ein Link (`scroll={false}`): Das Detail hat eine Adresse,
   Schliessen ist die Adresse ohne Auswahl, und die Liste behält ihre Stelle.

   Die Aktionen kommen fertig vom Aufrufer (eine Icon-Reihe wie
   `TrainingAktionen`); vorne steht Bearbeiten am eigenen bzw. Öffnen am
   fremden Eintrag. Der Name bricht um, statt die Knöpfe zu verdrängen. */
export function DetailKopf({
  titel,
  aktionen,
  schliessenHref,
  schliessenLabel = "Detail schliessen",
  className,
}: {
  titel: ReactNode;
  aktionen?: ReactNode;
  /** Die Adresse ohne Auswahl — die Liste allein. */
  schliessenHref: string;
  schliessenLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {/* `py-1`: Die Zeile des Titels steht auf der Höhe der Knöpfe (36 px). */}
      <h2 className="min-w-0 flex-1 break-words py-1 type-title-large text-on-surface">{titel}</h2>
      <div className="flex shrink-0 items-center gap-0.5 print:hidden">
        {aktionen}
        {aktionen && <span aria-hidden className="mx-1 h-5 w-px bg-linie" />}
        <IconButtonLink href={schliessenHref} scroll={false} icon={X} label={schliessenLabel} />
      </div>
    </div>
  );
}
