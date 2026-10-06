import { cn } from "@/lib/cn";
import { kalenderblatt, tagOhneJahr } from "@/lib/monat";

/** Was der Termin hinter dem Blatt trägt — dieselben Zustände wie die
 *  Marken des Mini-Monats. */
export type BlattZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

/* Die Fläche je Zustand: mit Training die volle Primary-Fläche, ohne
   vorbereitetes Training die Tönung der Warn-Lozenge, ausgefallen eine graue
   Fläche mit durchgestrichener Tageszahl; vergangen ohne Training bleibt das
   Blatt ohne Fläche. Die Paare sind die des gefüllten Knopfs und der Lozenge —
   jedes trägt seine Schrift mit 4.5:1 und besser. */
const FLAECHE: Record<BlattZustand, string> = {
  training: "bg-primary text-on-primary",
  "noch-nicht": "bg-lozenge-warning text-on-lozenge-warning",
  ausgefallen: "bg-elev-08 text-on-surface-mittel",
  ohne: "text-on-surface",
};

/* Ein Termin als Kalenderblatt: Wochentag, grosse Tageszahl, Monat — wie ein
   Abreisskalender links an der Zeile (Epic #401, Muster «Kalenderblatt»). Das
   Auge findet den Tag, ohne eine Datumszeile zu lesen (#402 AK 1); das Jahr
   steht nie darauf, es gehört in die Überschrift des Monats.

   Die Fläche sagt, was der Termin trägt (`zustand`, PO 2026-10-06): So fällt
   eine unvorbereitete Einheit schon am Blatt auf. Die Farbe trägt es nie
   allein — die Zeile daneben sagt es in Worten.

   Heute steht statt des Wochentags «Heute», dazu eine helle Kontur, die auf
   jeder Fläche sichtbar bleibt (AK 3). Sichtbar ist die Kurzform stumm
   geschaltet; vorgelesen wird der ausgeschriebene Tag. `as`: das Element,
   etwa die Überschrift des Tages. */
export function Kalenderblatt({
  datum,
  heute = false,
  zustand = "ohne",
  as: Element = "div",
  className,
}: {
  /** `YYYY-MM-DD`. */
  datum: string;
  heute?: boolean;
  zustand?: BlattZustand;
  as?: "div" | "h5";
  className?: string;
}) {
  const b = kalenderblatt(datum);
  const leise = zustand === "ohne" && "text-on-surface-mittel";
  return (
    <Element
      className={cn(
        "flex w-12 shrink-0 flex-col items-center self-start rounded-klein py-1 text-center leading-none",
        FLAECHE[zustand],
        heute && "kontur border-on-surface",
        className,
      )}
    >
      <span aria-hidden className={cn("type-label-small", leise)}>{heute ? "Heute" : b.wochentag}</span>
      <span aria-hidden className={cn("type-title-large", zustand === "ausgefallen" && "line-through")}>{b.tag}</span>
      <span aria-hidden className={cn("type-label-small", leise)}>{b.monat}</span>
      <span className="sr-only">{heute ? "Heute, " : ""}{tagOhneJahr(datum)} {datum.slice(0, 4)}</span>
    </Element>
  );
}
