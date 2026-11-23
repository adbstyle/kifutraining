import { cn } from "@/lib/cn";
import { kalenderblatt, tagOhneJahr } from "@/lib/monat";
import type { BlattStand } from "@/lib/termin-status";

/* Die Fläche je Stand (Epic #490): Ein Spiel, das bevorsteht, trägt ein
   weisses Blatt (die umgekehrte Fläche, `umkehr`); ein Training, das
   bevorsteht, ein leiseres — nur hell umrandet, damit die Spiele
   hervortreten (`leise`, PO 2026-10-22); einer, der nicht oder nicht mehr
   zählt, ein graues — vergangen ohne Strich, gestrichen (ausgefallen, am
   privaten Link auch abgemeldet oder nicht aufgeboten) mit durchgestrichener
   Tageszahl. Was der Termin trägt, sagt nicht das Blatt, sondern die
   Status-Lozenge daneben. */
const FLAECHE: Record<BlattStand, string> = {
  aktiv: "umkehr text-on-surface",
  leise: "kontur border-on-surface-mittel text-on-surface",
  vergangen: "betont text-on-surface-mittel",
  gestrichen: "betont text-on-surface-mittel",
};

/* Ein Termin als Kalenderblatt: Wochentag, grosse Tageszahl, Monat — wie ein
   Abreisskalender links an der Zeile (Epic #401, Muster «Kalenderblatt»). Das
   Auge findet den Tag, ohne eine Datumszeile zu lesen (#402 AK 1); das Jahr
   steht nie darauf, es gehört in die Überschrift des Monats. Heute hebt das
   Blatt nicht hervor; dafür steht der nächste Termin zuoberst.

   Sichtbar ist die Kurzform stumm geschaltet; vorgelesen wird der
   ausgeschriebene Tag. `as`: das Element, etwa die Überschrift des Tages. */
export function Kalenderblatt({
  datum,
  stand = "aktiv",
  as: Element = "div",
  className,
}: {
  /** `YYYY-MM-DD`. */
  datum: string;
  stand?: BlattStand;
  as?: "div" | "h5";
  className?: string;
}) {
  const b = kalenderblatt(datum);
  return (
    <Element
      className={cn(
        "flex w-12 shrink-0 flex-col items-center self-start rounded-klein py-1 text-center leading-none",
        FLAECHE[stand],
        className,
      )}
    >
      <span aria-hidden className="type-label-small">{b.wochentag}</span>
      <span aria-hidden className={cn("type-title-large", stand === "gestrichen" && "line-through")}>{b.tag}</span>
      <span aria-hidden className="type-label-small">{b.monat}</span>
      <span className="sr-only">{tagOhneJahr(datum)} {datum.slice(0, 4)}</span>
    </Element>
  );
}
