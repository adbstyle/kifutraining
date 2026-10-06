import { cn } from "@/lib/cn";
import { kalenderblatt, tagOhneJahr } from "@/lib/monat";

/* Ein Tag als Kalenderblatt: Wochentag, grosse Tageszahl, Monat — wie ein
   Abreisskalender links an der Zeile (Epic #401, Muster «Kalenderblatt»). Das
   Auge findet den Tag, ohne eine Datumszeile zu lesen (#402 AK 1); das Jahr
   steht nie darauf, es gehört in die Überschrift des Monats.

   Der heutige Tag trägt die volle Primary-Fläche (AK 3) — dazu sagt es der
   Text für Vorlesehilfen, damit es nicht nur an der Farbe hängt. Sichtbar
   ist die Kurzform stumm geschaltet; vorgelesen wird der ausgeschriebene Tag.
   `as`: das Element, meist die Überschrift des Tages. */
export function Kalenderblatt({
  datum,
  heute = false,
  as: Element = "div",
  className,
}: {
  /** `YYYY-MM-DD`. */
  datum: string;
  heute?: boolean;
  as?: "div" | "h4" | "h5";
  className?: string;
}) {
  const b = kalenderblatt(datum);
  return (
    <Element
      className={cn(
        "flex w-12 shrink-0 flex-col items-center self-start rounded-klein py-1 text-center leading-none",
        heute ? "bg-primary text-on-primary" : "text-on-surface",
        className,
      )}
    >
      <span aria-hidden className={cn("type-label-small", !heute && "text-on-surface-mittel")}>{b.wochentag}</span>
      <span aria-hidden className="type-title-large">{b.tag}</span>
      <span aria-hidden className={cn("type-label-small", !heute && "text-on-surface-mittel")}>{b.monat}</span>
      <span className="sr-only">{heute ? "Heute, " : ""}{tagOhneJahr(datum)} {datum.slice(0, 4)}</span>
    </Element>
  );
}
