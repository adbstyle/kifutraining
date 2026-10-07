import { cn } from "@/lib/cn";
import { kalenderblatt, tagOhneJahr } from "@/lib/monat";

/** Was der Termin hinter dem Blatt trägt — dieselben Zustände wie die
 *  Marken des Mini-Monats. */
export type BlattZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

/* Die Tönung je Zustand — leise, damit die Liste ruhig bleibt (PO
   2026-10-06): eine schwache Fläche in der Farbe des Zustands und die
   Tageszahl in ihr selbst. Mit Training Primary, ohne vorbereitetes Training
   die Warnfarbe, ausgefallen grau mit durchgestrichener Zahl; vergangen ohne
   Training bleibt das Blatt ohne Fläche. Die Schrift trägt 4.5:1 und besser
   (pruefe-farben.ts). */
const TOENUNG: Record<BlattZustand, string> = {
  training: "bg-primary/12 text-primary",
  "noch-nicht": "bg-icon-warning/12 text-icon-warning",
  ausgefallen: "bg-elev-08 text-on-surface-mittel",
  ohne: "text-on-surface",
};

/* Ein Termin als Kalenderblatt: Wochentag, grosse Tageszahl, Monat — wie ein
   Abreisskalender links an der Zeile (Epic #401, Muster «Kalenderblatt»). Das
   Auge findet den Tag, ohne eine Datumszeile zu lesen (#402 AK 1); das Jahr
   steht nie darauf, es gehört in die Überschrift des Monats.

   Die Tönung sagt, was der Termin trägt (`zustand`, PO 2026-10-06): So fällt
   eine unvorbereitete Einheit schon am Blatt auf. Die Farbe trägt es nie
   allein — die Zeile daneben sagt es in Worten. Heute hebt das Blatt nicht
   hervor; dafür steht der nächste Termin zuoberst (PO 2026-10-06).

   Sichtbar ist die Kurzform stumm geschaltet; vorgelesen wird der
   ausgeschriebene Tag. `as`: das Element, etwa die Überschrift des Tages. */
export function Kalenderblatt({
  datum,
  zustand = "ohne",
  as: Element = "div",
  className,
}: {
  /** `YYYY-MM-DD`. */
  datum: string;
  zustand?: BlattZustand;
  as?: "div" | "h5";
  className?: string;
}) {
  const b = kalenderblatt(datum);
  const leise = zustand !== "ausgefallen" && "text-on-surface-mittel";
  return (
    <Element
      className={cn(
        "flex w-12 shrink-0 flex-col items-center self-start rounded-klein py-1 text-center leading-none",
        TOENUNG[zustand],
        className,
      )}
    >
      <span aria-hidden className={cn("type-label-small", leise)}>{b.wochentag}</span>
      <span aria-hidden className={cn("type-title-large", zustand === "ausgefallen" && "line-through")}>{b.tag}</span>
      <span aria-hidden className={cn("type-label-small", leise)}>{b.monat}</span>
      <span className="sr-only">{tagOhneJahr(datum)} {datum.slice(0, 4)}</span>
    </Element>
  );
}
